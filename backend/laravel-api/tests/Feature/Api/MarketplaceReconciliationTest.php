<?php

namespace Tests\Feature\Api;

use App\Models\Order;
use App\Models\Seller;
use App\Models\SellerLedgerEntry;
use App\Models\SellerOrder;
use App\Models\SellerOrderItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MarketplaceReconciliationTest extends TestCase
{
    use RefreshDatabase;

    public function test_marketplace_reconciliation_reports_clean_paid_seller_order(): void
    {
        $seller = Seller::query()->create(['owner_user_id' => User::factory()->create()->id, 'store_name' => 'Ledger Store', 'slug' => 'ledger-store', 'status' => 'active']);
        $parent = Order::query()->create(['user_id' => $seller->owner_user_id, 'order_number' => 'ORD-LEDGER', 'shipping_address' => ['city' => 'Yangon'], 'subtotal_minor' => 1000, 'discount_minor' => 0, 'shipping_minor' => 0, 'tax_minor' => 0, 'grand_total_minor' => 1000, 'currency' => 'MMK', 'payment_status' => 'paid', 'fulfillment_status' => 'confirmed']);
        $parentItem = $parent->items()->create(['product_name' => 'Ledger item', 'sku' => 'LEDGER-1', 'quantity' => 1, 'unit_price_minor' => 1000, 'line_total_minor' => 1000]);
        $order = SellerOrder::query()->create(['order_id' => $parent->id, 'seller_id' => $seller->id, 'order_number' => 'ORD-LEDGER-S1', 'status' => 'confirmed', 'payment_status' => 'paid', 'fulfillment_status' => 'pending', 'subtotal_minor' => 1000, 'shipping_minor' => 0, 'commission_minor' => 100, 'net_minor' => 900, 'currency' => 'MMK']);
        SellerOrderItem::query()->create(['seller_order_id' => $order->id, 'order_item_id' => $parentItem->id, 'product_name' => 'Ledger item', 'sku' => 'LEDGER-1', 'quantity' => 1, 'unit_price_minor' => 1000, 'line_total_minor' => 1000]);
        $order->commissions()->create(['seller_order_item_id' => $order->items()->first()->id, 'percentage_bps' => 1000, 'fixed_minor' => 0, 'gross_minor' => 1000, 'commission_minor' => 100, 'net_minor' => 900, 'currency' => 'MMK']);
        SellerLedgerEntry::query()->create(['seller_id' => $seller->id, 'seller_order_id' => $order->id, 'type' => 'sale_credit', 'amount_minor' => 1000, 'currency' => 'MMK', 'idempotency_key' => 'test-ledger-sale', 'occurred_at' => now()]);
        SellerLedgerEntry::query()->create(['seller_id' => $seller->id, 'seller_order_id' => $order->id, 'type' => 'commission_debit', 'amount_minor' => -100, 'currency' => 'MMK', 'idempotency_key' => 'test-ledger-commission', 'occurred_at' => now()]);

        $this->artisan('commerce:reconcile-marketplace', ['--json' => true])->assertExitCode(0);
    }
}
