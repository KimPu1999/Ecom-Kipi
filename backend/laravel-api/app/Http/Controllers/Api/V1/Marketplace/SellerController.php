<?php

namespace App\Http\Controllers\Api\V1\Marketplace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ProductImageRequest;
use App\Http\Requests\Api\V1\InventoryAdjustmentRequest;
use App\Http\Requests\Api\V1\VariantRequest;
use App\Http\Resources\ProductResource;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Seller;
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

        return ApiResponse::success(['seller' => $seller, 'products' => $seller->products()->count(), 'orders' => $seller->orders()->count(), 'earnings' => $this->marketplace->earnings($seller->id)], 'Seller dashboard retrieved');
    }

    public function products(Request $request)
    {
        $products = $this->seller($request)->products()->with(['category', 'brand', 'images', 'variants.inventory'])->latest()->paginate(min((int) $request->input('per_page', 20), 100));

        return ApiResponse::paginated($products, ProductResource::collection($products->items()), 'Seller products retrieved');
    }

    public function showProduct(Request $request, Product $product)
    {
        abort_unless((int) $product->seller_id === (int) $this->seller($request)->id, 404);

        return ApiResponse::success(new ProductResource($product->load(['seller', 'category', 'brand', 'images', 'variants.inventory'])), 'Seller product retrieved');
    }

    public function storeProduct(Request $request)
    {
        $data = $request->validate(['category_id' => ['required', 'exists:categories,id'], 'brand_id' => ['nullable', 'exists:brands,id'], 'name' => ['required', 'string', 'max:180'], 'slug' => ['required', 'string', 'max:180', 'unique:products,slug'], 'description' => ['nullable', 'string'], 'status' => ['nullable', 'in:draft,published']]);
        $product = $this->seller($request)->products()->create($data + ['status' => $data['status'] ?? 'draft']);

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
        $orders = $this->seller($request)->orders()->with(['order.user', 'items', 'shipments'])->latest()->paginate(min((int) $request->input('per_page', 20), 100));

        return ApiResponse::paginated($orders, $orders->items(), 'Seller orders retrieved');
    }

    public function createShipment(Request $request, SellerOrder $sellerOrder)
    {
        abort_unless((int) $sellerOrder->seller_id === (int) $this->seller($request)->id, 404);
        $data = $request->validate(['carrier' => ['nullable', 'string', 'max:100'], 'tracking_number' => ['nullable', 'string', 'max:100']]);

        return ApiResponse::success($this->fulfillment->create($sellerOrder->load(['order', 'items']), $data), 'Seller shipment created', 201);
    }

    public function updateShipment(Request $request, Shipment $shipment)
    {
        abort_unless($shipment->sellerOrder && (int) $shipment->sellerOrder->seller_id === (int) $this->seller($request)->id, 404);
        $data = $request->validate(['status' => ['required', 'string'], 'message' => ['nullable', 'string'], 'location' => ['nullable', 'string']]);

        return ApiResponse::success($this->fulfillment->transition($shipment->load('sellerOrder'), $data['status'], $data['message'] ?? null, $data['location'] ?? null, $request->user()->id), 'Seller shipment updated');
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
