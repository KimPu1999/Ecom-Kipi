<?php

namespace App\Services;

use App\Models\CommissionRule;
use App\Models\Order;
use App\Models\SellerLedgerEntry;

class MarketplaceOrderService
{
    public function createSellerOrders(Order $order): void
    {
        $items = $order->items()->with('variant.product')->get();
        $groups = $items->filter(fn ($item) => $item->seller_id)->groupBy('seller_id');

        foreach ($groups as $sellerId => $sellerItems) {
            $subtotal = (int) $sellerItems->sum('line_total_minor');
            $sellerOrder = $order->sellerOrders()->create([
                'seller_id' => $sellerId,
                'order_number' => $order->order_number.'-S'.$sellerId,
                'status' => 'pending',
                'payment_status' => 'pending',
                'fulfillment_status' => 'pending',
                'subtotal_minor' => $subtotal,
                'shipping_minor' => 0,
                'commission_minor' => 0,
                'net_minor' => 0,
                'currency' => $order->currency,
            ]);

            $commissionTotal = 0;
            foreach ($sellerItems as $item) {
                $sellerItem = $sellerOrder->items()->create([
                    'order_item_id' => $item->id,
                    'product_variant_id' => $item->product_variant_id,
                    'product_name' => $item->product_name,
                    'sku' => $item->sku,
                    'quantity' => $item->quantity,
                    'unit_price_minor' => $item->unit_price_minor,
                    'line_total_minor' => $item->line_total_minor,
                ]);
                $rule = CommissionRule::query()
                    ->where(fn ($query) => $query->whereNull('seller_id')->orWhere('seller_id', $sellerId))
                    ->where('is_active', true)
                    ->where('currency', $order->currency)
                    ->where(fn ($query) => $query->whereNull('starts_at')->orWhere('starts_at', '<=', now()))
                    ->where(fn ($query) => $query->whereNull('ends_at')->orWhere('ends_at', '>=', now()))
                    ->orderByRaw('seller_id IS NULL')
                    ->latest('id')
                    ->first();
                $bps = $rule?->percentage_bps ?? config('marketplace.default_commission_bps', 1000);
                $fixed = $rule?->fixed_minor ?? 0;
                $commission = min($item->line_total_minor, (int) floor($item->line_total_minor * $bps / 10000) + $fixed);
                $commissionTotal += $commission;
                $sellerOrder->commissions()->create([
                    'seller_order_item_id' => $sellerItem->id,
                    'commission_rule_id' => $rule?->id,
                    'percentage_bps' => $bps,
                    'fixed_minor' => $fixed,
                    'gross_minor' => $item->line_total_minor,
                    'commission_minor' => $commission,
                    'net_minor' => $item->line_total_minor - $commission,
                    'currency' => $order->currency,
                    'snapshot' => ['percentage_bps' => $bps, 'fixed_minor' => $fixed],
                ]);
            }
            $sellerOrder->update(['commission_minor' => $commissionTotal, 'net_minor' => $subtotal - $commissionTotal]);
            $sellerOrder->statusHistory()->create(['to_status' => 'pending', 'note' => 'Seller order created from parent checkout.']);
        }
    }

    public function markPaid(Order $order): void
    {
        foreach ($order->sellerOrders()->with('seller')->get() as $sellerOrder) {
            $sellerOrder->update(['payment_status' => 'paid', 'status' => 'confirmed']);
            $sellerOrder->statusHistory()->create(['from_status' => 'pending', 'to_status' => 'confirmed', 'note' => 'Parent order payment verified.']);
            SellerLedgerEntry::query()->firstOrCreate([
                'idempotency_key' => 'seller-sale:'.$sellerOrder->id,
            ], [
                'seller_id' => $sellerOrder->seller_id,
                'seller_order_id' => $sellerOrder->id,
                'type' => 'sale_credit',
                'amount_minor' => $sellerOrder->subtotal_minor,
                'currency' => $sellerOrder->currency,
                'reference_type' => Order::class,
                'reference_id' => $order->id,
                'metadata' => ['commission_minor' => $sellerOrder->commission_minor, 'net_minor' => $sellerOrder->net_minor],
                'occurred_at' => now(),
            ]);
            SellerLedgerEntry::query()->firstOrCreate([
                'idempotency_key' => 'seller-commission:'.$sellerOrder->id,
            ], [
                'seller_id' => $sellerOrder->seller_id,
                'seller_order_id' => $sellerOrder->id,
                'type' => 'commission_debit',
                'amount_minor' => -$sellerOrder->commission_minor,
                'currency' => $sellerOrder->currency,
                'reference_type' => Order::class,
                'reference_id' => $order->id,
                'occurred_at' => now(),
            ]);
        }
    }

    public function earnings(int $sellerId): array
    {
        $entries = SellerLedgerEntry::query()->where('seller_id', $sellerId)->get();
        $gross = (int) $entries->where('type', 'sale_credit')->sum('amount_minor');
        $available = (int) $entries->sum('amount_minor');

        return ['gross_minor' => $gross, 'available_minor' => max(0, $available), 'currency' => $entries->first()?->currency ?? 'MMK'];
    }
}
