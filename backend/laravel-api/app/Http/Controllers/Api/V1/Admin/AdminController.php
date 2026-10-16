<?php

namespace App\Http\Controllers\Api\V1\Admin;

use Carbon\CarbonPeriod;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AdminUserRoleRequest;
use App\Http\Requests\Api\V1\AdminUserUpdateRequest;
use App\Http\Requests\Api\V1\BrandRequest;
use App\Http\Requests\Api\V1\CategoryRequest;
use App\Http\Requests\Api\V1\InventoryAdjustmentRequest;
use App\Http\Requests\Api\V1\OrderNoteRequest;
use App\Http\Requests\Api\V1\OrderStatusRequest;
use App\Http\Requests\Api\V1\ProductImageRequest;
use App\Http\Requests\Api\V1\ProductRequest;
use App\Http\Requests\Api\V1\VariantRequest;
use App\Http\Resources\BrandResource;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\OrderResource;
use App\Http\Resources\ProductResource;
use App\Http\Resources\UserResource;
use App\Models\AuditLog;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use App\Models\Role;
use App\Models\User;
use App\Services\InventoryReservationService;
use App\Services\InventoryService;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AdminController extends Controller
{
    public function dashboard(Request $request)
    {
        [$from, $to] = $this->dashboardRange($request);
        $dateQuery = fn ($query) => $query->whereBetween('created_at', [$from, $to]);
        $paidOrders = Order::query()
            ->where('payment_status', 'paid')
            ->whereNotIn('fulfillment_status', ['cancelled'])
            ->whereBetween('created_at', [$from, $to]);

        $salesTrendByDate = (clone $paidOrders)
            ->selectRaw('DATE(created_at) as date, SUM(grand_total_minor) as revenue, COUNT(*) as orders')
            ->groupByRaw('DATE(created_at)')
            ->orderBy('date')
            ->get()
            ->keyBy('date');

        $salesTrend = collect(CarbonPeriod::create($from->copy()->startOfDay(), $to->copy()->startOfDay()))
            ->map(function ($date) use ($salesTrendByDate) {
                $dateKey = $date->toDateString();
                $row = $salesTrendByDate->get($dateKey);

                return [
                    'date' => $dateKey,
                    'revenue' => (int) ($row?->revenue ?? 0),
                    'orders' => (int) ($row?->orders ?? 0),
                ];
            })
            ->values();

        $topProducts = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.payment_status', 'paid')
            ->whereNotIn('orders.fulfillment_status', ['cancelled'])
            ->whereBetween('orders.created_at', [$from, $to])
            ->select('order_items.product_name as name')
            ->selectRaw('SUM(order_items.quantity) as quantity, SUM(order_items.line_total_minor) as revenue')
            ->groupBy('order_items.product_name')
            ->orderByDesc('quantity')
            ->limit(5)
            ->get()
            ->map(fn ($row) => ['name' => $row->name, 'quantity' => (int) $row->quantity, 'revenue' => (int) $row->revenue]);

        $statusDistribution = (clone $dateQuery(Order::query()))
            ->select('fulfillment_status as status')
            ->selectRaw('COUNT(*) as count')
            ->groupBy('fulfillment_status')
            ->orderByDesc('count')
            ->get()
            ->map(fn ($row) => ['status' => $row->status, 'count' => (int) $row->count]);

        $lowStock = Inventory::query()
            ->with('variant.product')
            ->whereRaw('(quantity - reserved_quantity) <= low_stock_threshold')
            ->orderByRaw('(quantity - reserved_quantity) asc')
            ->limit(6)
            ->get()
            ->map(fn (Inventory $inventory) => [
                'variant_id' => $inventory->product_variant_id,
                'product' => $inventory->variant?->product?->name,
                'sku' => $inventory->variant?->sku,
                'available_quantity' => $inventory->availableQuantity(),
                'threshold' => $inventory->low_stock_threshold,
            ]);

        return ApiResponse::success([
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'metrics' => [
                'customers' => User::query()->whereHas('roles', fn ($query) => $query->where('name', 'customer'))->count(),
                'products' => Product::query()->whereNot('status', 'archived')->count(),
                'orders' => (clone $dateQuery(Order::query()))->count(),
                'paid_revenue' => (int) $paidOrders->sum('grand_total_minor'),
                'pending_orders' => Order::query()->where('fulfillment_status', 'pending')->count(),
                'low_stock_products' => $lowStock->count(),
            ],
            'sales_trend' => $salesTrend,
            'status_distribution' => $statusDistribution,
            'top_products' => $topProducts,
            'recent_orders' => OrderResource::collection(Order::query()->with('user')->latest()->limit(6)->get()),
            'latest_customers' => User::query()->with('roles')->whereHas('roles', fn ($query) => $query->where('name', 'customer'))->latest()->limit(6)->get(),
            'low_stock' => $lowStock,
            'recent_activity' => AuditLog::query()->with('actor')->latest()->limit(8)->get(),
        ], 'Dashboard retrieved');
    }

    public function users(Request $request)
    {
        $query = User::query()->with('roles');
        $query->when($request->filled('q'), fn ($builder) => $builder->where(function ($inner) use ($request) {
            $term = $request->string('q')->toString();
            $inner->where('name', 'like', "%{$term}%")->orWhere('email', 'like', "%{$term}%");
        }));
        $query->when($request->filled('status'), fn ($builder) => $builder->where('status', $request->string('status')));
        $query->when($request->filled('role'), fn ($builder) => $builder->whereHas('roles', fn ($roles) => $roles->where('name', $request->string('role'))));
        $sort = $request->string('sort', 'created_at')->toString();
        $sort = in_array($sort, ['created_at', 'name', 'email', 'status'], true) ? $sort : 'created_at';
        $direction = $request->string('direction', 'desc')->toString() === 'asc' ? 'asc' : 'desc';
        $users = $query->orderBy($sort, $direction)->paginate(min($request->integer('per_page', 20), 100));

        return ApiResponse::paginated($users, UserResource::collection($users->items()), 'Users retrieved');
    }

    public function showUser(User $user)
    {
        return ApiResponse::success(new UserResource($user->load(['roles', 'orders' => fn ($query) => $query->latest()->limit(10)])), 'User retrieved');
    }

    public function updateUser(AdminUserUpdateRequest $request, User $user)
    {
        $before = $user->only(['name', 'email', 'phone', 'status']);
        $user->update($request->validated());
        $this->audit($request, 'user.updated', $user, $before, $user->only(['name', 'email', 'phone', 'status']));

        return ApiResponse::success(new UserResource($user->fresh('roles')), 'User updated');
    }

    public function updateUserStatus(AdminUserUpdateRequest $request, User $user)
    {
        $request->validate(['status' => ['required', 'in:active,suspended']]);
        if ($user->is($request->user()) && $request->string('status')->toString() === 'suspended') {
            throw ValidationException::withMessages(['status' => 'You cannot suspend your own account.']);
        }

        return $this->updateUser($request, $user);
    }

    public function updateUserRoles(AdminUserRoleRequest $request, User $user)
    {
        if (in_array('seller', $request->input('roles', []), true) && ! $user->ownedSellers()->approved()->exists() && ! $user->sellerMemberships()->where('status', 'active')->whereHas('seller', fn ($query) => $query->approved())->exists()) {
            throw ValidationException::withMessages(['roles' => 'Seller access requires an approved seller application.']);
        }
        if ($user->is($request->user()) && ! in_array('super_admin', $request->input('roles', []), true)) {
            throw ValidationException::withMessages(['roles' => 'You cannot remove your own super administrator role.']);
        }
        if ($user->hasRole('super_admin') && ! in_array('super_admin', $request->input('roles', []), true)) {
            $activeSuperAdmins = User::query()->where('status', 'active')->whereHas('roles', fn ($query) => $query->where('name', 'super_admin'))->count();
            if ($activeSuperAdmins <= 1) {
                throw ValidationException::withMessages(['roles' => 'The last active super administrator cannot be removed.']);
            }
        }

        $before = $user->roles()->pluck('name')->all();
        $user->roles()->sync(Role::query()->whereIn('name', $request->input('roles'))->pluck('id'));
        $this->audit($request, 'user.roles_updated', $user, ['roles' => $before], ['roles' => $request->input('roles')]);

        return ApiResponse::success(new UserResource($user->fresh('roles')), 'User roles updated');
    }

    public function categories(Request $request)
    {
        $categories = Category::query()->with('parent')->when($request->filled('q'), fn ($query) => $query->where('name', 'like', '%'.$request->string('q').'%'))->latest()->paginate(min($request->integer('per_page', 50), 100));

        return ApiResponse::paginated($categories, CategoryResource::collection($categories->items()), 'Categories retrieved');
    }

    public function showCategory(Category $category)
    {
        return ApiResponse::success(new CategoryResource($category->load(['parent', 'children'])), 'Category retrieved');
    }

    public function storeCategory(CategoryRequest $request)
    {
        $category = Category::query()->create($request->validated());
        $this->audit($request, 'category.created', $category, null, $category->toArray());

        return ApiResponse::success(new CategoryResource($category), 'Category created', 201);
    }

    public function updateCategory(CategoryRequest $request, Category $category)
    {
        $before = $category->toArray();
        $category->update($request->validated());
        $this->audit($request, 'category.updated', $category, $before, $category->fresh()->toArray());

        return ApiResponse::success(new CategoryResource($category->fresh()), 'Category updated');
    }

    public function destroyCategory(Category $category)
    {
        if ($category->products()->exists() || $category->children()->exists()) {
            throw ValidationException::withMessages(['category' => 'Categories with products or child categories cannot be deleted.']);
        }
        $before = $category->toArray();
        $category->delete();
        $this->audit(request(), 'category.deleted', null, $before, null);

        return ApiResponse::success(null, 'Category deleted', 204);
    }

    public function brands(Request $request)
    {
        $brands = Brand::query()->when($request->filled('q'), fn ($query) => $query->where('name', 'like', '%'.$request->string('q').'%'))->latest()->paginate(min($request->integer('per_page', 50), 100));

        return ApiResponse::paginated($brands, BrandResource::collection($brands->items()), 'Brands retrieved');
    }

    public function showBrand(Brand $brand)
    {
        return ApiResponse::success(new BrandResource($brand), 'Brand retrieved');
    }

    public function storeBrand(BrandRequest $request)
    {
        $brand = Brand::query()->create($request->validated());
        $this->audit($request, 'brand.created', $brand, null, $brand->toArray());

        return ApiResponse::success(new BrandResource($brand), 'Brand created', 201);
    }

    public function updateBrand(BrandRequest $request, Brand $brand)
    {
        $before = $brand->toArray();
        $brand->update($request->validated());
        $this->audit($request, 'brand.updated', $brand, $before, $brand->fresh()->toArray());

        return ApiResponse::success(new BrandResource($brand->fresh()), 'Brand updated');
    }

    public function destroyBrand(Brand $brand)
    {
        if ($brand->products()->exists()) {
            throw ValidationException::withMessages(['brand' => 'Brands with products cannot be deleted. Archive the brand instead.']);
        }
        $before = $brand->toArray();
        $brand->delete();
        $this->audit(request(), 'brand.deleted', null, $before, null);

        return ApiResponse::success(null, 'Brand deleted', 204);
    }

    public function products(Request $request)
    {
        $query = Product::query()->with(['category', 'brand', 'seller', 'images', 'variants.inventory']);
        $query->when($request->filled('q'), fn ($builder) => $builder->where(function ($inner) use ($request) {
            $term = $request->string('q')->toString();
            $inner->where('name', 'like', "%{$term}%")->orWhere('slug', 'like', "%{$term}%");
        }));
        $query->when($request->filled('category_id'), fn ($builder) => $builder->where('category_id', $request->integer('category_id')));
        $query->when($request->filled('brand_id'), fn ($builder) => $builder->where('brand_id', $request->integer('brand_id')));
        $query->when($request->filled('status'), fn ($builder) => $builder->where('status', $request->string('status')));
        $products = $query->latest()->paginate(min($request->integer('per_page', 20), 100));

        return ApiResponse::paginated($products, ProductResource::collection($products->items()), 'Products retrieved');
    }

    public function showProduct(Product $product)
    {
        return ApiResponse::success(new ProductResource($product->load(['category', 'brand', 'images', 'variants.inventory'])), 'Product retrieved');
    }

    public function storeProduct(ProductRequest $request)
    {
        $product = Product::query()->create($request->validated());
        $this->audit($request, 'product.created', $product, null, $product->toArray());

        return ApiResponse::success(new ProductResource($product->load(['category', 'brand', 'variants', 'images'])), 'Product created', 201);
    }

    public function updateProduct(ProductRequest $request, Product $product)
    {
        $before = $product->toArray();
        $product->update($request->validated());
        $this->audit($request, 'product.updated', $product, $before, $product->fresh()->toArray());

        return ApiResponse::success(new ProductResource($product->fresh()->load(['category', 'brand', 'variants', 'images'])), 'Product updated');
    }

    public function destroyProduct(Product $product)
    {
        $before = $product->toArray();
        $product->update(['status' => 'archived']);
        $this->audit(request(), 'product.archived', $product, $before, $product->fresh()->toArray());

        return ApiResponse::success(null, 'Product archived');
    }

    public function storeVariant(VariantRequest $request, Product $product)
    {
        $variant = $product->variants()->create($request->validated());
        $variant->inventory()->create();
        $this->audit($request, 'variant.created', $variant, null, $variant->toArray());

        return ApiResponse::success($variant->load('inventory'), 'Variant created', 201);
    }

    public function updateVariant(VariantRequest $request, ProductVariant $variant)
    {
        $before = $variant->toArray();
        $variant->update($request->validated());
        $this->audit($request, 'variant.updated', $variant, $before, $variant->fresh()->toArray());

        return ApiResponse::success($variant->fresh('inventory'), 'Variant updated');
    }

    public function destroyVariant(ProductVariant $variant)
    {
        $before = $variant->toArray();
        $variant->delete();
        $this->audit(request(), 'variant.deleted', null, $before, null);

        return ApiResponse::success(null, 'Variant deleted', 204);
    }

    public function storeImage(ProductImageRequest $request, Product $product)
    {
        $data = $request->validated();
        if ($request->hasFile('file')) {
            $data['url'] = Storage::disk('public')->url($request->file('file')->store('products', 'public'));
        }
        unset($data['file']);
        if (($data['is_primary'] ?? false)) {
            $product->images()->update(['is_primary' => false]);
        }

        $image = $product->images()->create($data);
        $this->audit($request, 'product_image.created', $image, null, $image->toArray());

        return ApiResponse::success($image, 'Product image created', 201);
    }

    public function destroyImage(ProductImage $image)
    {
        $before = $image->toArray();
        $image->delete();
        $this->audit(request(), 'product_image.deleted', null, $before, null);

        return ApiResponse::success(null, 'Product image deleted', 204);
    }

    public function adjustInventory(InventoryAdjustmentRequest $request, ProductVariant $variant, InventoryService $inventory)
    {
        $data = $request->validated();
        $result = $inventory->adjust($variant, $data['delta'], 'admin_adjustment', $request->user()->id, $data['note'] ?? null);
        if (array_key_exists('low_stock_threshold', $data)) {
            $result->update(['low_stock_threshold' => $data['low_stock_threshold']]);
        }
        $this->audit($request, 'inventory.adjusted', $result, ['delta' => $data['delta']], $result->fresh()->toArray());

        return ApiResponse::success($result->fresh('variant'), 'Inventory adjusted');
    }

    public function inventory(ProductVariant $variant)
    {
        return ApiResponse::success($variant->load('inventory')->inventory, 'Inventory retrieved');
    }

    public function inventoryList(Request $request)
    {
        $query = Inventory::query()->with('variant.product');
        $query->when($request->filled('q'), fn ($builder) => $builder->whereHas('variant', fn ($variant) => $variant->where('sku', 'like', '%'.$request->string('q').'%')->orWhereHas('product', fn ($product) => $product->where('name', 'like', '%'.$request->string('q').'%'))));
        $query->when($request->boolean('low_stock'), fn ($builder) => $builder->whereRaw('(quantity - reserved_quantity) <= low_stock_threshold'));
        $inventories = $query->latest()->paginate(min($request->integer('per_page', 25), 100));

        return ApiResponse::paginated($inventories, $inventories->getCollection()->map(fn (Inventory $inventory) => $this->inventoryPayload($inventory)), 'Inventory retrieved');
    }

    public function inventoryMovements(ProductVariant $variant)
    {
        return ApiResponse::success($variant->inventory?->movements()->latest()->get(), 'Inventory movements retrieved');
    }

    public function orders(Request $request)
    {
        $query = Order::query()->with(['user', 'items.seller']);
        $query->when($request->filled('q'), fn ($builder) => $builder->where('order_number', 'like', '%'.$request->string('q').'%'));
        $query->when($request->filled('payment_status'), fn ($builder) => $builder->where('payment_status', $request->string('payment_status')));
        $query->when($request->filled('fulfillment_status'), fn ($builder) => $builder->where('fulfillment_status', $request->string('fulfillment_status')));
        $query->when($request->filled('from'), fn ($builder) => $builder->whereDate('created_at', '>=', $request->date('from')));
        $query->when($request->filled('to'), fn ($builder) => $builder->whereDate('created_at', '<=', $request->date('to')));
        $orders = $query->latest()->paginate(min($request->integer('per_page', 20), 100));

        return ApiResponse::paginated($orders, OrderResource::collection($orders->items()), 'Orders retrieved');
    }

    public function showOrder(Order $order)
    {
        return ApiResponse::success(new OrderResource($order->load(['user', 'items.seller', 'sellerOrders.seller', 'sellerOrders.items', 'statusHistory', 'notes.user', 'shippingMethod', 'payments', 'shipments.tracking', 'shipments.carrierRecord', 'shipments.rider', 'refunds'])), 'Order retrieved');
    }

    public function updateOrderStatus(OrderStatusRequest $request, Order $order, InventoryReservationService $reservations)
    {
        $next = $request->string('status')->toString();
        $allowed = [
            'pending' => ['confirmed', 'processing', 'cancelled'],
            'confirmed' => ['processing', 'cancelled'],
            'processing' => ['shipped', 'cancelled'],
            'shipped' => ['delivered'],
            'delivered' => [],
            'cancelled' => [],
        ];
        if (! in_array($next, $allowed[$order->fulfillment_status] ?? [], true)) {
            throw ValidationException::withMessages(['status' => 'Invalid order status transition.']);
        }
        $from = $order->fulfillment_status;
        DB::transaction(function () use ($order, $next, $from, $request, $reservations) {
            if ($next === 'cancelled') {
                $reservations->releaseOrder($order, $request->user()->id);
            }
            $order->update([
                'fulfillment_status' => $next,
                'cancelled_at' => $next === 'cancelled' ? now() : $order->cancelled_at,
            ]);
            $order->statusHistory()->create([
                'status_type' => 'fulfillment',
                'from_status' => $from,
                'to_status' => $next,
                'changed_by' => $request->user()->id,
                'note' => $request->input('note'),
            ]);
        });
        $this->audit($request, 'order.status_updated', $order, ['fulfillment_status' => $from], ['fulfillment_status' => $next]);

        return ApiResponse::success(new OrderResource($order->fresh(['items', 'statusHistory'])), 'Order status updated');
    }

    public function addOrderNote(OrderNoteRequest $request, Order $order)
    {
        $note = $order->notes()->create(['user_id' => $request->user()->id, 'note' => $request->string('note')->toString()]);
        $this->audit($request, 'order.note_added', $order, null, ['note_id' => $note->id]);

        return ApiResponse::success($note->load('user'), 'Order note added', 201);
    }

    public function auditLogs(Request $request)
    {
        $logs = AuditLog::query()
            ->with('actor')
            ->when($request->filled('q'), fn ($query) => $query->where(function ($inner) use ($request) {
                $term = $request->string('q')->toString();
                $inner->where('action', 'like', "%{$term}%")->orWhere('resource_type', 'like', "%{$term}%");
            }))
            ->latest()
            ->paginate(min($request->integer('per_page', 30), 100));

        return ApiResponse::paginated($logs, $logs->items(), 'Audit logs retrieved');
    }

    public function showAuditLog(AuditLog $auditLog)
    {
        return ApiResponse::success($auditLog->load('actor'), 'Audit log retrieved');
    }

    private function dashboardRange(Request $request): array
    {
        $period = $request->string('period', '30d')->toString();
        $to = $request->date('to')?->endOfDay() ?? now()->endOfDay();
        $from = match ($period) {
            'today' => now()->startOfDay(),
            '7d' => now()->subDays(6)->startOfDay(),
            '90d' => now()->subDays(89)->startOfDay(),
            'month' => now()->startOfMonth(),
            'custom' => $request->date('from')?->startOfDay() ?? now()->subDays(29)->startOfDay(),
            default => now()->subDays(29)->startOfDay(),
        };

        return [$from, $to];
    }

    private function inventoryPayload(Inventory $inventory): array
    {
        return [
            'id' => $inventory->id,
            'variant_id' => $inventory->product_variant_id,
            'product' => $inventory->variant?->product?->name,
            'sku' => $inventory->variant?->sku,
            'quantity' => $inventory->quantity,
            'reserved_quantity' => $inventory->reserved_quantity,
            'available_quantity' => $inventory->availableQuantity(),
            'low_stock_threshold' => $inventory->low_stock_threshold,
            'is_low_stock' => $inventory->availableQuantity() <= $inventory->low_stock_threshold,
        ];
    }

    private function audit(Request $request, string $action, ?Model $resource, ?array $before, ?array $after): void
    {
        AuditLog::query()->create([
            'actor_user_id' => $request->user()?->id,
            'action' => $action,
            'resource_type' => $resource ? $resource::class : null,
            'resource_id' => $resource?->getKey(),
            'ip_address' => $request->ip(),
            'request_id' => Str::isUuid($request->header('X-Request-Id', '')) ? $request->header('X-Request-Id') : Str::uuid(),
            'before' => $before,
            'after' => $after,
        ]);
    }
}
