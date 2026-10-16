<?php

namespace App\Http\Controllers\Api\V1\Marketplace;

use Carbon\Carbon;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ProductImageRequest;
use App\Http\Requests\Api\V1\InventoryAdjustmentRequest;
use App\Http\Requests\Api\V1\VariantRequest;
use App\Http\Resources\ProductResource;
use App\Models\Inventory;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Rider;
use App\Models\Seller;
use App\Models\SellerOrderItem;
use App\Models\SellerLedgerEntry;
use App\Models\SellerOrder;
use App\Models\Shipment;
use App\Services\MarketplaceOrderService;
use App\Services\SellerFulfillmentService;
use App\Services\InventoryService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SellerController extends Controller
{
    public function __construct(private readonly MarketplaceOrderService $marketplace, private readonly SellerFulfillmentService $fulfillment) {}

    private function seller(Request $request): Seller
    {
        return $request->attributes->get('seller');
    }

    public function dashboard(Request $request)
    {
        $seller = $this->seller($request);
        $view = $request->string('view', 'daily')->toString();
        $view = in_array($view, ['daily', 'weekly', 'monthly'], true) ? $view : 'daily';
        [$from, $to] = $this->sellerDashboardRange($view);
        $orders = $seller->orders();
        $totalOrders = (clone $orders)->count();
        $pendingOrders = (clone $orders)->where('fulfillment_status', 'pending')->count();
        $awaitingShipment = (clone $orders)
            ->where('payment_status', 'paid')
            ->whereIn('fulfillment_status', ['pending', 'confirmed', 'processing'])
            ->whereDoesntHave('shipments')
            ->count();
        $paymentIssues = (clone $orders)->whereIn('payment_status', ['failed', 'cancelled'])->count();
        $products = $seller->products()->count();
        $inventory = Inventory::query()
            ->join('product_variants', 'inventories.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->where('products.seller_id', $seller->id);
        $lowStockProducts = (clone $inventory)
            ->whereRaw('inventories.quantity > inventories.reserved_quantity')
            ->whereRaw('(inventories.quantity - inventories.reserved_quantity) <= inventories.low_stock_threshold')
            ->distinct()
            ->count('product_variants.product_id');
        $outOfStockProducts = (clone $inventory)
            ->whereRaw('inventories.quantity <= inventories.reserved_quantity')
            ->distinct()
            ->count('product_variants.product_id');
        $earnings = $this->marketplace->earnings($seller->id);

        return ApiResponse::success([
            'seller' => $seller,
            'products' => $products,
            'orders' => $totalOrders,
            'earnings' => $earnings,
            'metrics' => [
                'total_sales_minor' => $earnings['total_sales_minor'],
                'total_orders' => $totalOrders,
                'pending_orders' => $pendingOrders,
                'products' => $products,
                'low_stock_products' => $lowStockProducts,
                'out_of_stock_products' => $outOfStockProducts,
                'net_earnings_minor' => $earnings['net_earnings_minor'],
                'commission_deducted_minor' => $earnings['commission_deducted_minor'],
                'pending_earnings_minor' => $earnings['pending_earnings_minor'],
                'paid_earnings_minor' => $earnings['paid_earnings_minor'],
                'refund_adjustments_minor' => $earnings['refund_adjustments_minor'],
                'currency' => $earnings['currency'],
                'awaiting_shipment' => $awaitingShipment,
                'payment_issues' => $paymentIssues,
            ],
            'range' => ['view' => $view, 'from' => $from->toDateString(), 'to' => $to->toDateString()],
            'sales_trend' => $this->sellerSalesTrend($seller->id, $view, $from, $to),
            'recent_orders' => $seller->orders()->with(['order.user'])->latest()->limit(6)->get()->map(fn (SellerOrder $order) => [
                'id' => $order->id,
                'order_id' => $order->order_id,
                'order_number' => $order->order_number,
                'customer_name' => $order->order?->user?->name,
                'created_at' => $order->created_at?->toISOString(),
                'subtotal_minor' => (int) $order->subtotal_minor,
                'currency' => $order->currency,
                'payment_status' => $order->payment_status,
                'fulfillment_status' => $order->fulfillment_status,
            ]),
            'top_products' => $this->sellerTopProducts($seller->id),
        ], 'Seller dashboard retrieved');
    }

    private function sellerDashboardRange(string $view): array
    {
        $now = now();

        return match ($view) {
            'weekly' => [$now->copy()->startOfWeek()->subWeeks(7), $now->copy()->endOfWeek()],
            'monthly' => [$now->copy()->startOfMonth()->subMonths(5), $now->copy()->endOfMonth()],
            default => [$now->copy()->subDays(6)->startOfDay(), $now->copy()->endOfDay()],
        };
    }

    private function sellerSalesTrend(int $sellerId, string $view, Carbon $from, Carbon $to): array
    {
        $entries = SellerLedgerEntry::query()
            ->where('seller_id', $sellerId)
            ->where('type', 'sale_credit')
            ->whereBetween('occurred_at', [$from, $to])
            ->get();
        $grouped = $entries->groupBy(function (SellerLedgerEntry $entry) use ($view): string {
            $occurredAt = $entry->occurred_at;

            return match ($view) {
                'weekly' => $occurredAt->copy()->startOfWeek()->toDateString(),
                'monthly' => $occurredAt->copy()->startOfMonth()->toDateString(),
                default => $occurredAt->toDateString(),
            };
        });
        $step = match ($view) {
            'weekly' => 'addWeek',
            'monthly' => 'addMonth',
            default => 'addDay',
        };
        $cursor = $from->copy();
        $trend = [];

        while ($cursor->lte($to)) {
            $date = $cursor->toDateString();
            $rows = $grouped->get($date, collect());
            $trend[] = [
                'date' => $date,
                'revenue' => (int) $rows->sum('amount_minor'),
                'orders' => $rows->pluck('seller_order_id')->filter()->unique()->count(),
            ];
            $cursor->{$step}();
        }

        return $trend;
    }

    private function sellerTopProducts(int $sellerId): array
    {
        $items = SellerOrderItem::query()
            ->whereHas('sellerOrder', fn ($query) => $query->where('seller_id', $sellerId)->where('payment_status', 'paid')->whereNotIn('fulfillment_status', ['cancelled']))
            ->with(['sellerOrder', 'variant.product.images'])
            ->get();
        $grouped = [];

        foreach ($items as $item) {
            $key = $item->product_variant_id ? 'variant:'.$item->product_variant_id : 'name:'.$item->product_name;
            $product = $item->variant?->product;
            $image = $product?->images?->firstWhere('is_primary', true) ?? $product?->images?->first();
            $grouped[$key] ??= [
                'product_id' => $product?->id,
                'name' => $item->product_name,
                'image_url' => $image?->url,
                'quantity' => 0,
                'revenue' => 0,
                'currency' => $item->sellerOrder?->currency ?? 'MMK',
            ];
            $grouped[$key]['quantity'] += (int) $item->quantity;
            $grouped[$key]['revenue'] += (int) $item->line_total_minor;
        }

        return collect($grouped)->sortByDesc('quantity')->take(5)->values()->all();
    }

    public function products(Request $request)
    {
        $query = $this->seller($request)->products()
            ->with(['category', 'brand', 'images', 'variants.inventory'])
            ->withCount(['reviews as reviews_count' => fn ($reviews) => $reviews->where('status', 'approved')])
            ->withAvg(['reviews as average_rating' => fn ($reviews) => $reviews->where('status', 'approved')], 'rating');

        $query->when($request->filled('q'), function ($products) use ($request): void {
            $search = trim((string) $request->input('q'));
            $products->where(function ($match) use ($search): void {
                $match->where('name', 'like', '%'.$search.'%')
                    ->orWhere('slug', 'like', '%'.$search.'%')
                    ->orWhereHas('variants', fn ($variants) => $variants->where('sku', 'like', '%'.$search.'%'));
            });
        });
        $query->when($request->filled('status') && in_array($request->input('status'), ['draft', 'published'], true), fn ($products) => $products->where('status', $request->input('status')));
        $query->when($request->filled('category_id') && ctype_digit((string) $request->input('category_id')), fn ($products) => $products->where('category_id', (int) $request->input('category_id')));

        $stockStatus = $request->input('stock_status');
        if (in_array($stockStatus, ['in_stock', 'limited', 'out_of_stock'], true)) {
            $query->where(function ($products) use ($stockStatus): void {
                if ($stockStatus === 'in_stock') {
                    $products->whereHas('variants.inventory', fn ($inventory) => $inventory->whereColumn('quantity', '>', 'reserved_quantity')->whereColumn('quantity', '>', 'low_stock_threshold'));
                } elseif ($stockStatus === 'limited') {
                    $products->whereHas('variants.inventory', fn ($inventory) => $inventory->whereColumn('quantity', '>', 'reserved_quantity')->whereRaw('(quantity - reserved_quantity) <= low_stock_threshold'));
                } else {
                    $products->whereDoesntHave('variants.inventory', fn ($inventory) => $inventory->whereColumn('quantity', '>', 'reserved_quantity'));
                }
            });
        }

        $sort = $request->input('sort', 'latest');
        if ($sort === 'name') {
            $query->orderBy('name');
        } elseif ($sort === 'name_desc') {
            $query->orderByDesc('name');
        } elseif (in_array($sort, ['price_asc', 'price_desc'], true)) {
            $priceQuery = Product::query()->select('price_minor')
                ->from('product_variants')
                ->whereColumn('product_variants.product_id', 'products.id')
                ->orderBy('price_minor', $sort === 'price_asc' ? 'asc' : 'desc')
                ->limit(1);
            $query->orderBy($priceQuery, $sort === 'price_asc' ? 'asc' : 'desc');
        } else {
            $query->latest();
        }

        $products = $query->paginate(min((int) $request->input('per_page', 20), 100))->withQueryString();

        return ApiResponse::paginated($products, ProductResource::collection($products->items()), 'Seller products retrieved');
    }

    public function showProduct(Request $request, Product $product)
    {
        abort_unless((int) $product->seller_id === (int) $this->seller($request)->id, 404);

        return ApiResponse::success(new ProductResource($product->load(['seller', 'category', 'brand', 'images', 'variants.inventory'])), 'Seller product retrieved');
    }

    public function storeProduct(Request $request)
    {
        $data = $request->validate([
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'name' => ['required', 'string', 'max:180'],
            'slug' => ['required', 'string', 'max:180', 'unique:products,slug'],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', 'in:draft,published'],
            'variants' => ['nullable', 'array', 'min:1', 'max:100'],
            'variants.*.sku' => ['required', 'string', 'max:100', 'distinct', 'unique:product_variants,sku'],
            'variants.*.price_minor' => ['required', 'integer', 'min:0'],
            'variants.*.compare_at_price_minor' => ['nullable', 'integer', 'min:0'],
            'variants.*.currency' => ['required', 'string', 'size:3'],
            'variants.*.attributes' => ['nullable', 'array'],
            'variants.*.attributes.*' => ['nullable', 'string', 'max:100'],
            'variants.*.quantity' => ['nullable', 'integer', 'min:0'],
            'variants.*.is_active' => ['sometimes', 'boolean'],
        ]);
        $variants = $data['variants'] ?? [];
        unset($data['variants']);

        $combinationKeys = [];
        foreach ($variants as $index => $variant) {
            $normalizedAttributes = [];
            foreach (($variant['attributes'] ?? []) as $name => $value) {
                $normalizedName = Str::lower(trim((string) $name));
                $normalizedValue = Str::lower(trim((string) $value));
                if ($normalizedName === '' || $normalizedValue === '') {
                    throw ValidationException::withMessages(["variants.{$index}.attributes" => 'Variant option names and values cannot be empty.']);
                }
                $normalizedAttributes[$normalizedName] = $normalizedValue;
            }
            ksort($normalizedAttributes);
            $combinationKey = json_encode($normalizedAttributes);
            if (isset($combinationKeys[$combinationKey])) {
                throw ValidationException::withMessages(["variants.{$index}.attributes" => 'Variant combinations must be unique.']);
            }
            $combinationKeys[$combinationKey] = true;
        }

        $product = DB::transaction(function () use ($data, $variants, $request) {
            $product = $this->seller($request)->products()->create($data + ['status' => $data['status'] ?? 'draft']);

            foreach ($variants as $variantData) {
                $quantity = (int) ($variantData['quantity'] ?? 0);
                unset($variantData['quantity']);
                $variant = $product->variants()->create($variantData + ['currency' => 'MMK']);
                $variant->inventory()->create(['quantity' => $quantity]);
            }

            return $product->load(['seller', 'variants.inventory']);
        });

        return ApiResponse::success($product->load(['seller', 'variants']), 'Seller product created', 201);
    }

    public function updateProduct(Request $request, Product $product)
    {
        abort_unless((int) $product->seller_id === (int) $this->seller($request)->id, 404);
        $data = $request->validate(['category_id' => ['sometimes', 'exists:categories,id'], 'brand_id' => ['nullable', 'exists:brands,id'], 'name' => ['sometimes', 'string', 'max:180'], 'slug' => ['sometimes', 'string', 'max:180', 'unique:products,slug,'.$product->id], 'description' => ['nullable', 'string'], 'status' => ['sometimes', 'in:draft,published']]);
        $product->update($data);

        return ApiResponse::success($product->fresh()->load('seller'), 'Seller product updated');
    }

    public function destroyProduct(Request $request, Product $product)
    {
        abort_unless((int) $product->seller_id === (int) $this->seller($request)->id, 404);

        $variantIds = $product->variants()->pluck('id');
        $hasOrders = OrderItem::query()->whereIn('product_variant_id', $variantIds)->exists();
        $hasCartItems = DB::table('cart_items')->whereIn('product_variant_id', $variantIds)->exists();

        abort_if($hasOrders || $hasCartItems, 422, 'This product cannot be deleted because it is already referenced by an order or cart. Set it to draft instead.');

        $product->delete();

        return ApiResponse::success(null, 'Seller product deleted');
    }

    public function storeVariant(Request $request, Product $product)
    {
        abort_unless((int) $product->seller_id === (int) $this->seller($request)->id, 404);
        $data = $request->validate(['sku' => ['required', 'string', 'max:80', 'unique:product_variants,sku'], 'price_minor' => ['required', 'integer', 'min:0'], 'compare_at_price_minor' => ['nullable', 'integer', 'min:0'], 'currency' => ['nullable', 'string', 'size:3'], 'attributes' => ['nullable', 'array'], 'quantity' => ['nullable', 'integer', 'min:0']]);
        $quantity = (int) ($data['quantity'] ?? 0);
        unset($data['quantity']);
        $variant = DB::transaction(function () use ($product, $data, $quantity) {
            $variant = $product->variants()->create($data + ['currency' => 'MMK']);
            $variant->inventory()->create(['quantity' => $quantity]);

            return $variant;
        });

        return ApiResponse::success($variant->load('inventory'), 'Seller variant created', 201);
    }

    public function updateVariant(VariantRequest $request, ProductVariant $variant)
    {
        abort_unless((int) $variant->product?->seller_id === (int) $this->seller($request)->id, 404);
        $variant->update($request->validated());

        return ApiResponse::success($variant->fresh('inventory'), 'Seller variant updated');
    }

    public function adjustVariantInventory(InventoryAdjustmentRequest $request, ProductVariant $variant, InventoryService $inventory)
    {
        abort_unless((int) $variant->product?->seller_id === (int) $this->seller($request)->id, 404);

        return ApiResponse::success($inventory->adjust($variant, $request->integer('delta'), 'seller_adjustment', $request->user()->id, $request->input('note')), 'Seller inventory updated');
    }

    public function storeImage(ProductImageRequest $request, Product $product)
    {
        abort_unless((int) $product->seller_id === (int) $this->seller($request)->id, 404);
        $data = $request->validated();

        if ($request->hasFile('file')) {
            $data['url'] = Storage::disk('public')->url($request->file('file')->store('products', 'public'));
        }

        unset($data['file']);
        if (($data['is_primary'] ?? false)) {
            $product->images()->update(['is_primary' => false]);
        }

        return ApiResponse::success($product->images()->create($data), 'Seller product image created', 201);
    }

    public function inventory(Request $request)
    {
        $items = $this->seller($request)->products()->with('variants.inventory')->get()->flatMap(fn ($product) => $product->variants->map(fn ($variant) => ['product_id' => $product->id, 'product_name' => $product->name, 'variant_id' => $variant->id, 'sku' => $variant->sku, 'quantity' => $variant->inventory?->quantity ?? 0, 'reserved_quantity' => $variant->inventory?->reserved_quantity ?? 0, 'available_quantity' => $variant->inventory?->availableQuantity() ?? 0]))->values();

        return ApiResponse::success($items, 'Seller inventory retrieved');
    }

    public function orders(Request $request)
    {
        $orders = $this->seller($request)->orders()->with(['order.user', 'items', 'shipments.tracking', 'shipments.items.orderItem', 'shipments.method', 'shipments.carrierRecord', 'shipments.rider'])->latest()->paginate(min((int) $request->input('per_page', 20), 100));

        return ApiResponse::paginated($orders, $orders->items(), 'Seller orders retrieved');
    }

    public function showOrder(Request $request, SellerOrder $sellerOrder)
    {
        abort_unless((int) $sellerOrder->seller_id === (int) $this->seller($request)->id, 404);

        return ApiResponse::success($sellerOrder->load([
            'order.user:id,name,email,phone',
            'order.payments:id,order_id,provider,provider_payment_id,status,amount_minor,currency,paid_at,created_at',
            'order.statusHistory:id,order_id,status_type,from_status,to_status,changed_by,note,created_at',
            'order.shippingMethod',
            'items.orderItem.variant.product.images',
            'statusHistory',
            'shipments.tracking.actor',
            'shipments.items.orderItem',
            'shipments.method',
            'shipments.carrierRecord',
            'shipments.rider',
        ]), 'Seller order retrieved');
    }

    public function riders(Request $request)
    {
        $seller = $this->seller($request);
        $riders = Rider::query()
            ->where('status', 'active')
            ->where(fn ($query) => $query->whereNull('seller_id')->orWhere('seller_id', $seller->id))
            ->orderBy('name')
            ->get(['id', 'name', 'phone', 'seller_id', 'status']);

        return ApiResponse::success($riders, 'Authorized riders retrieved');
    }

    public function createShipment(Request $request, SellerOrder $sellerOrder)
    {
        abort_unless((int) $sellerOrder->seller_id === (int) $this->seller($request)->id, 404);
        $data = $request->validate(['delivery_method' => ['sometimes', 'in:self_delivery,external_courier'], 'carrier_id' => ['nullable', 'integer', 'exists:shipping_carriers,id'], 'carrier' => ['nullable', 'string', 'max:100'], 'tracking_number' => ['required_if:delivery_method,external_courier', 'nullable', 'string', 'max:120'], 'tracking_url' => ['nullable', 'url:http,https', 'max:500'], 'rider_id' => ['nullable', 'integer', 'exists:riders,id'], 'estimated_delivery_at' => ['nullable', 'date', 'after_or_equal:today'], 'notes' => ['nullable', 'string', 'max:2000']]);
        $data['delivery_method'] = $data['delivery_method'] ?? (empty($data['tracking_number']) ? 'self_delivery' : 'external_courier');
        if ($data['delivery_method'] !== 'self_delivery' && ! empty($data['rider_id'])) {
            throw ValidationException::withMessages(['rider_id' => 'A rider can only be assigned to self delivery.']);
        }
        if (! empty($data['rider_id'])) {
            $authorizedRider = Rider::query()->whereKey($data['rider_id'])->where('status', 'active')->where(fn ($query) => $query->whereNull('seller_id')->orWhere('seller_id', $this->seller($request)->id))->exists();
            if (! $authorizedRider) {
                throw ValidationException::withMessages(['rider_id' => 'This rider is not authorized for your store.']);
            }
        }
        $data['actor_id'] = $request->user()->id;
        $data['actor_role'] = 'seller';
        $data['idempotency_key'] = substr($request->header('Idempotency-Key', ''), 0, 120) ?: null;

        return ApiResponse::success($this->fulfillment->create($sellerOrder->load(['order', 'items']), $data), 'Seller shipment created', 201);
    }

    public function showShipment(Request $request, Shipment $shipment)
    {
        abort_unless($shipment->sellerOrder && (int) $shipment->sellerOrder->seller_id === (int) $this->seller($request)->id, 404);

        return ApiResponse::success($shipment->load(['order', 'sellerOrder.seller', 'items.orderItem', 'tracking.actor', 'method', 'carrierRecord', 'rider']), 'Seller shipment retrieved');
    }

    public function updateShipment(Request $request, Shipment $shipment)
    {
        abort_unless($shipment->sellerOrder && (int) $shipment->sellerOrder->seller_id === (int) $this->seller($request)->id, 404);
        $data = $request->validate(['status' => ['required', 'string'], 'message' => ['nullable', 'string'], 'location' => ['nullable', 'string']]);

        return ApiResponse::success($this->fulfillment->transition($shipment->load('sellerOrder'), $data['status'], $data['message'] ?? null, $data['location'] ?? null, $request->user()->id, 'seller'), 'Seller shipment updated');
    }

    public function earnings(Request $request)
    {
        return ApiResponse::success($this->marketplace->earnings($this->seller($request)->id), 'Seller earnings retrieved');
    }

    public function payouts(Request $request)
    {
        return ApiResponse::success($this->seller($request)->payouts()->latest()->get(), 'Seller payouts retrieved');
    }

    public function requestPayout(Request $request)
    {
        $seller = $this->seller($request);
        if (! config('marketplace.stripe_connect_enabled') || ! $seller->payout_provider_account_id) {
            return ApiResponse::error('Payout provider onboarding is not configured for this seller.', 422);
        }
        $data = $request->validate(['amount_minor' => ['required', 'integer', 'min:1']]);
        $earnings = $this->marketplace->earnings($seller->id);
        abort_if($data['amount_minor'] > $earnings['available_minor'], 422, 'Requested payout exceeds available balance.');
        $payout = $seller->payouts()->create(['status' => 'pending', 'amount_minor' => $data['amount_minor'], 'currency' => $earnings['currency'], 'provider' => 'stripe_connect', 'idempotency_key' => 'payout:'.Str::uuid(), 'requested_at' => now()]);

        return ApiResponse::success($payout, 'Payout request queued for provider processing', 201);
    }

    public function settings(Request $request)
    {
        return ApiResponse::success($this->seller($request)->settings()->firstOrCreate(['seller_id' => $this->seller($request)->id]), 'Seller settings retrieved');
    }

    public function updateSettings(Request $request)
    {
        $data = $request->validate(['store_policies' => ['nullable', 'array'], 'shipping_configuration' => ['nullable', 'array'], 'notification_preferences' => ['nullable', 'array'], 'operational_settings' => ['nullable', 'array']]);
        $settings = $this->seller($request)->settings()->updateOrCreate(['seller_id' => $this->seller($request)->id], $data);

        return ApiResponse::success($settings, 'Seller settings updated');
    }
}
