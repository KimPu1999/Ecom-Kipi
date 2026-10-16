<?php

use App\Http\Controllers\Api\V1\Admin\AdminController;
use App\Http\Controllers\Api\V1\Admin\CouponController;
use App\Http\Controllers\Api\V1\Admin\FulfillmentController;
use App\Http\Controllers\Api\V1\Admin\MarketplaceController;
use App\Http\Controllers\Api\V1\Admin\RefundController;
use App\Http\Controllers\Api\V1\Admin\ShippingManagementController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Cart\CartController;
use App\Http\Controllers\Api\V1\Catalog\CatalogController;
use App\Http\Controllers\Api\V1\Checkout\CheckoutController;
use App\Http\Controllers\Api\V1\Customer\ProfileController;
use App\Http\Controllers\Api\V1\DeviceController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\Marketplace\SellerApplicationController;
use App\Http\Controllers\Api\V1\Marketplace\SellerController;
use App\Http\Controllers\Api\V1\Marketplace\StoreController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\Order\OrderController;
use App\Http\Controllers\Api\V1\PaymentController;
use App\Http\Controllers\Api\V1\ReviewController;
use App\Http\Controllers\Api\V1\RiderController;
use App\Http\Controllers\Api\V1\ShippingController;
use App\Http\Controllers\Api\V1\WebhookController;
use App\Http\Controllers\Api\V1\WishlistController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->middleware('throttle:api')->group(function () {
    Route::get('health', [HealthController::class, 'health']);
    Route::get('health/ready', [HealthController::class, 'ready']);

    Route::prefix('auth')->middleware('throttle:10,1')->group(function () {
        Route::post('register', [AuthController::class, 'register']);
        Route::post('login', [AuthController::class, 'login']);
        Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
        Route::post('reset-password', [AuthController::class, 'resetPassword']);
    });

    Route::get('categories', [CatalogController::class, 'categories']);
    Route::get('categories/{slug}', [CatalogController::class, 'category']);
    Route::get('brands', [CatalogController::class, 'brands']);
    Route::get('brands/{slug}', [CatalogController::class, 'brand']);
    Route::get('products', [CatalogController::class, 'products']);
    Route::get('products/featured', [CatalogController::class, 'featured']);
    Route::get('products/search', [CatalogController::class, 'products']);
    Route::get('products/{product}/reviews', [ReviewController::class, 'index']);
    Route::get('products/{slug}', [CatalogController::class, 'product']);
    Route::get('stores', [StoreController::class, 'index']);
    Route::get('stores/{slug}', [StoreController::class, 'show']);
    Route::post('webhooks/payments/{provider}', [WebhookController::class, 'payment']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::get('profile', [ProfileController::class, 'show']);
        Route::put('profile', [ProfileController::class, 'update']);
        Route::post('devices/push-tokens', [DeviceController::class, 'store']);
        Route::delete('devices/push-tokens', [DeviceController::class, 'destroy']);
        Route::get('notification-preferences', [NotificationController::class, 'preferences']);
        Route::put('notification-preferences', [NotificationController::class, 'updatePreferences']);
        Route::get('notifications', [NotificationController::class, 'index']);
        Route::post('notifications/read-all', [NotificationController::class, 'readAll']);
        Route::post('notifications/{id}/read', [NotificationController::class, 'read']);
        Route::get('addresses', [ProfileController::class, 'addresses']);
        Route::post('addresses', [ProfileController::class, 'storeAddress']);
        Route::put('addresses/{id}', [ProfileController::class, 'updateAddress']);
        Route::delete('addresses/{id}', [ProfileController::class, 'destroyAddress']);
        Route::get('wishlist', [WishlistController::class, 'index']);
        Route::post('wishlist/{product}', [WishlistController::class, 'store']);
        Route::delete('wishlist/{product}', [WishlistController::class, 'destroy']);
        Route::delete('wishlist', [WishlistController::class, 'clear']);
        Route::post('products/{product}/reviews', [ReviewController::class, 'store']);

        Route::get('cart', [CartController::class, 'show']);
        Route::post('cart/items', [CartController::class, 'store']);
        Route::patch('cart/items/{id}', [CartController::class, 'update']);
        Route::delete('cart/items/{id}', [CartController::class, 'destroy']);
        Route::delete('cart', [CartController::class, 'clear']);
        Route::post('checkout/preview', [CheckoutController::class, 'preview']);
        Route::post('checkout/confirm', [CheckoutController::class, 'confirm']);
        Route::post('payments/initialize', [PaymentController::class, 'initialize']);
        Route::get('payments/{payment}/status', [PaymentController::class, 'status']);
        Route::post('payments/{payment}/retry', [PaymentController::class, 'retry']);
        Route::get('shipping/methods', [ShippingController::class, 'methods']);
        Route::get('orders/{id}/shipments', [ShippingController::class, 'shipments']);
        Route::get('shipments/{id}/tracking', [ShippingController::class, 'tracking']);

        Route::post('orders', [OrderController::class, 'store']);
        Route::get('orders', [OrderController::class, 'index']);
        Route::get('orders/{id}', [OrderController::class, 'show']);
        Route::post('orders/{id}/cancel', [OrderController::class, 'cancel']);
        Route::get('seller/applications', [SellerApplicationController::class, 'index']);
        Route::post('seller/applications', [SellerApplicationController::class, 'store']);
        Route::get('seller/applications/{application}', [SellerApplicationController::class, 'show']);
    });

    Route::prefix('seller')->middleware(['auth:sanctum', 'seller'])->group(function () {
        Route::get('dashboard', [SellerController::class, 'dashboard']);
        Route::get('products', [SellerController::class, 'products']);
        Route::post('products', [SellerController::class, 'storeProduct']);
        Route::get('products/{product}', [SellerController::class, 'showProduct']);
        Route::put('products/{product}', [SellerController::class, 'updateProduct']);
        Route::patch('products/{product}', [SellerController::class, 'updateProduct']);
        Route::delete('products/{product}', [SellerController::class, 'destroyProduct']);
        Route::post('products/{product}/variants', [SellerController::class, 'storeVariant']);
        Route::put('variants/{variant}', [SellerController::class, 'updateVariant']);
        Route::post('variants/{variant}/inventory/adjust', [SellerController::class, 'adjustVariantInventory']);
        Route::post('products/{product}/images', [SellerController::class, 'storeImage']);
        Route::get('inventory', [SellerController::class, 'inventory']);
        Route::get('orders', [SellerController::class, 'orders']);
        Route::get('riders', [SellerController::class, 'riders']);
        Route::post('orders/{sellerOrder}/shipments', [SellerController::class, 'createShipment']);
        Route::get('shipments/{shipment}', [SellerController::class, 'showShipment']);
        Route::patch('shipments/{shipment}/status', [SellerController::class, 'updateShipment']);
        Route::get('earnings', [SellerController::class, 'earnings']);
        Route::get('payouts', [SellerController::class, 'payouts']);
        Route::post('payouts', [SellerController::class, 'requestPayout']);
        Route::get('settings', [SellerController::class, 'settings']);
        Route::put('settings', [SellerController::class, 'updateSettings']);
    });

    Route::prefix('rider')->middleware('auth:sanctum')->group(function () {
        Route::get('shipments', [RiderController::class, 'shipments']);
        Route::patch('shipments/{shipment}/status', [RiderController::class, 'updateShipment']);
    });

    Route::prefix('admin')->middleware(['auth:sanctum', 'admin'])->group(function () {
        Route::get('dashboard', [AdminController::class, 'dashboard']);

        Route::middleware('permission:manage_users')->group(function () {
            Route::get('users', [AdminController::class, 'users']);
            Route::get('users/{user}', [AdminController::class, 'showUser']);
            Route::patch('users/{user}', [AdminController::class, 'updateUser']);
            Route::patch('users/{user}/status', [AdminController::class, 'updateUserStatus']);
        });
        Route::middleware('super_admin')->patch('users/{user}/roles', [AdminController::class, 'updateUserRoles']);

        Route::middleware('permission:manage_catalog')->group(function () {
            Route::get('categories', [AdminController::class, 'categories']);
            Route::post('categories', [AdminController::class, 'storeCategory']);
            Route::get('categories/{category}', [AdminController::class, 'showCategory']);
            Route::put('categories/{category}', [AdminController::class, 'updateCategory']);
            Route::delete('categories/{category}', [AdminController::class, 'destroyCategory']);
            Route::get('brands', [AdminController::class, 'brands']);
            Route::post('brands', [AdminController::class, 'storeBrand']);
            Route::get('brands/{brand}', [AdminController::class, 'showBrand']);
            Route::put('brands/{brand}', [AdminController::class, 'updateBrand']);
            Route::delete('brands/{brand}', [AdminController::class, 'destroyBrand']);
            Route::get('products', [AdminController::class, 'products']);
            Route::post('products', [AdminController::class, 'storeProduct']);
            Route::get('products/{product}', [AdminController::class, 'showProduct']);
            Route::put('products/{product}', [AdminController::class, 'updateProduct']);
            Route::delete('products/{product}', [AdminController::class, 'destroyProduct']);
            Route::post('products/{product}/variants', [AdminController::class, 'storeVariant']);
            Route::put('variants/{variant}', [AdminController::class, 'updateVariant']);
            Route::delete('variants/{variant}', [AdminController::class, 'destroyVariant']);
            Route::post('products/{product}/images', [AdminController::class, 'storeImage']);
            Route::delete('images/{image}', [AdminController::class, 'destroyImage']);
            Route::get('coupons', [CouponController::class, 'index']);
            Route::post('coupons', [CouponController::class, 'store']);
            Route::put('coupons/{coupon}', [CouponController::class, 'update']);
            Route::delete('coupons/{coupon}', [CouponController::class, 'destroy']);
        });

        Route::middleware('permission:manage_inventory')->group(function () {
            Route::get('inventory', [AdminController::class, 'inventoryList']);
            Route::get('variants/{variant}/inventory', [AdminController::class, 'inventory']);
            Route::get('variants/{variant}/inventory/movements', [AdminController::class, 'inventoryMovements']);
            Route::post('variants/{variant}/inventory/adjust', [AdminController::class, 'adjustInventory']);
        });

        Route::middleware('permission:manage_orders')->group(function () {
            Route::get('orders', [AdminController::class, 'orders']);
            Route::get('orders/{order}', [AdminController::class, 'showOrder']);
            Route::patch('orders/{order}/status', [AdminController::class, 'updateOrderStatus']);
            Route::post('orders/{order}/notes', [AdminController::class, 'addOrderNote']);
            Route::post('orders/{order}/shipments', [FulfillmentController::class, 'createShipment']);
            Route::patch('shipments/{shipment}/status', [FulfillmentController::class, 'updateShipment']);
            Route::get('orders/{order}/refunds', [RefundController::class, 'index']);
            Route::post('orders/{order}/refunds', [RefundController::class, 'store']);
            Route::post('payments/{payment}/collect-cod', [PaymentController::class, 'collectCod']);
            Route::post('payments/{payment}/verify-manual', [PaymentController::class, 'verifyManual']);
            Route::get('shipping/methods', [ShippingManagementController::class, 'methods']);
            Route::post('shipping/methods', [ShippingManagementController::class, 'storeMethod']);
            Route::patch('shipping/methods/{method}', [ShippingManagementController::class, 'updateMethod']);
            Route::get('shipping/carriers', [ShippingManagementController::class, 'carriers']);
            Route::post('shipping/carriers', [ShippingManagementController::class, 'storeCarrier']);
            Route::patch('shipping/carriers/{carrier}', [ShippingManagementController::class, 'updateCarrier']);
            Route::get('shipping/riders', [ShippingManagementController::class, 'riders']);
            Route::post('shipping/riders', [ShippingManagementController::class, 'storeRider']);
            Route::patch('shipping/riders/{rider}', [ShippingManagementController::class, 'updateRider']);
        });

        Route::middleware('permission:view_audit_logs')->group(function () {
            Route::get('audit-logs', [AdminController::class, 'auditLogs']);
            Route::get('audit-logs/{auditLog}', [AdminController::class, 'showAuditLog']);
        });
        Route::prefix('marketplace')->middleware('permission:manage_marketplace')->group(function () {
            Route::get('applications', [MarketplaceController::class, 'applications']);
            Route::get('applications/{application}', [MarketplaceController::class, 'showApplication']);
            Route::get('sellers', [MarketplaceController::class, 'sellers']);
            Route::get('sellers/{seller}/brands', [MarketplaceController::class, 'sellerBrands']);
            Route::get('commission-settings', [MarketplaceController::class, 'commissionSettings']);
            Route::get('commission-rules', [MarketplaceController::class, 'commissionRules']);
            Route::get('payouts', [MarketplaceController::class, 'payouts']);
        });
        Route::prefix('marketplace')->middleware('super_admin')->group(function () {
            Route::put('commission-settings', [MarketplaceController::class, 'updateCommissionSettings']);
            Route::post('commission-rules', [MarketplaceController::class, 'storeCommissionRule']);
            Route::put('commission-rules/{commissionRule}', [MarketplaceController::class, 'updateCommissionRule']);
            Route::get('applications/{application}/documents/{document}', [MarketplaceController::class, 'downloadDocument']);
            Route::post('applications/{application}/approve', [MarketplaceController::class, 'approve']);
            Route::post('applications/{application}/reject', [MarketplaceController::class, 'reject']);
            Route::patch('sellers/{seller}/status', [MarketplaceController::class, 'updateSellerStatus']);
        });
    });
});
