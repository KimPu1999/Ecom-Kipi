<?php

namespace App\Services;

use App\Models\Order;
use App\Models\SellerPayout;
use App\Models\SellerRefundAllocation;
use App\Models\SellerLedgerEntry;
use App\Models\SellerOrder;
use Illuminate\Support\Collection;

class MarketplaceOrderService
{
    public function __construct(private readonly CommissionService $commissionService) {}

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
            }
            $sellerOrder->statusHistory()->create(['to_status' => 'pending', 'note' => 'Seller order created from parent checkout.']);
        }
    }

    public function markPaid(Order $order): void
    {
        foreach ($order->sellerOrders()->with('seller')->get() as $sellerOrder) {
            $this->commissionService->confirmSellerOrder($sellerOrder);
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
        $sellerOrders = SellerOrder::query()
            ->where('seller_id', $sellerId)
            ->with([
                'order',
                'items.variant.product.brand',
                'commissions.item.variant.product.brand',
            ])
            ->latest()
            ->get();
        $sellerOrderIds = $sellerOrders->pluck('id');
        $entries = SellerLedgerEntry::query()
            ->where('seller_id', $sellerId)
            ->get();
        $payouts = SellerPayout::query()->where('seller_id', $sellerId)->get()->keyBy('id');
        $refundAllocations = $sellerOrderIds->isEmpty()
            ? collect()
            : SellerRefundAllocation::query()
                ->whereIn('seller_order_id', $sellerOrderIds)
                ->get()
                ->groupBy('seller_order_item_id');

        $gross = (int) $entries->where('type', 'sale_credit')->sum('amount_minor');
        $commissionDebits = abs((int) $entries->where('type', 'commission_debit')->sum('amount_minor'));
        $commissionRefunds = (int) $entries->where('type', 'commission_refund')->sum('amount_minor');
        $refundAdjustments = abs((int) $entries->where('type', 'refund_debit')->sum('amount_minor'));
        $net = (int) $entries->sum('amount_minor');
        $paidPayoutStatuses = ['paid', 'processed', 'succeeded', 'completed'];
        $paid = (int) $payouts
            ->filter(fn (SellerPayout $payout): bool => in_array(strtolower((string) $payout->status), $paidPayoutStatuses, true))
            ->sum('amount_minor');
        $reservedPayoutStatuses = ['pending', 'approved', 'processing'];
        $reserved = (int) $payouts
            ->filter(fn (SellerPayout $payout): bool => in_array(strtolower((string) $payout->status), $reservedPayoutStatuses, true))
            ->sum('amount_minor');
        $pendingPayouts = $payouts->filter(fn (SellerPayout $payout): bool => strtolower((string) $payout->status) === 'pending');
        $processingPayouts = $payouts->filter(fn (SellerPayout $payout): bool => in_array(strtolower((string) $payout->status), ['approved', 'processing'], true));

        $history = $sellerOrders->flatMap(function (SellerOrder $sellerOrder) use ($entries, $payouts, $refundAllocations): Collection {
            $orderEntries = $entries->where('seller_order_id', $sellerOrder->id);
            $payoutStatus = $orderEntries
                ->pluck('payout_id')
                ->filter()
                ->map(fn ($payoutId) => $payouts->get($payoutId)?->status)
                ->filter()
                ->unique()
                ->values()
                ->implode(', ');

            return $sellerOrder->commissions->map(function ($commission) use ($sellerOrder, $payoutStatus, $refundAllocations): array {
                $snapshot = is_array($commission->snapshot) ? $commission->snapshot : [];
                $item = $commission->item;
                $brand = $item?->variant?->product?->brand;
                $allocations = $refundAllocations->get($commission->seller_order_item_id, collect());
                $status = $commission->getAttribute('status') ?: ($snapshot['status'] ?? 'legacy');
                $ruleSource = $commission->getAttribute('rule_source') ?: ($snapshot['rule_source'] ?? 'legacy');
                $confirmedAt = $commission->getAttribute('confirmed_at')?->toISOString() ?? ($snapshot['confirmed_at'] ?? null);

                return [
                    'id' => $commission->id,
                    'order_id' => $sellerOrder->order_id,
                    'seller_order_id' => $sellerOrder->id,
                    'order_number' => $sellerOrder->order_number,
                    'brand' => $brand ? ['id' => $brand->id, 'name' => $brand->name] : null,
                    'eligible_subtotal_minor' => (int) ($snapshot['eligible_subtotal_minor'] ?? $commission->gross_minor),
                    'percentage_bps' => (int) ($snapshot['percentage_bps'] ?? $commission->percentage_bps),
                    'fixed_minor' => (int) ($snapshot['fixed_minor'] ?? $commission->fixed_minor),
                    'commission_minor' => (int) $commission->commission_minor,
                    'net_minor' => (int) $commission->net_minor,
                    'currency' => $commission->currency,
                    'payment_status' => $sellerOrder->payment_status ?: $sellerOrder->order?->payment_status,
                    'payout_status' => $payoutStatus !== '' ? $payoutStatus : null,
                    'status' => $status,
                    'rule_source' => $ruleSource,
                    'confirmed_at' => $confirmedAt,
                    'refund_adjustments_minor' => (int) $allocations->sum('amount_minor'),
                    'commission_reversed_minor' => (int) $allocations->sum('commission_reversed_minor'),
                ];
            });
        })->values();

        $currency = $entries->first()?->currency ?? $sellerOrders->first()?->currency ?? 'MMK';

        return [
            'total_sales_minor' => $gross,
            'commission_deducted_minor' => max(0, $commissionDebits - $commissionRefunds),
            'commission_refunds_minor' => $commissionRefunds,
            'net_earnings_minor' => $net,
            'pending_earnings_minor' => max(0, $net - $paid),
            'paid_earnings_minor' => $paid,
            'refund_adjustments_minor' => $refundAdjustments,
            // Keep these legacy keys for the existing dashboard contract.
            'gross_minor' => $gross,
            'total_earnings_minor' => $net,
            'available_minor' => max(0, $net - $paid - $reserved),
            'available_balance_minor' => max(0, $net - $paid - $reserved),
            'reserved_payout_minor' => $reserved,
            'pending_payout_requests' => $pendingPayouts->count(),
            'pending_payout_amount_minor' => (int) $pendingPayouts->sum('amount_minor'),
            'processing_payouts' => $processingPayouts->count(),
            'processing_payout_amount_minor' => (int) $processingPayouts->sum('amount_minor'),
            'total_paid_out_minor' => $paid,
            'payout_min_minor' => (int) config('marketplace.payout_min_minor', 1),
            'payout_max_minor' => (int) config('marketplace.payout_max_minor', 0),
            'currency' => $currency,
            'payout_processing_configured' => (bool) config('marketplace.stripe_connect_enabled'),
            'commission_history' => $history,
        ];
    }
}
