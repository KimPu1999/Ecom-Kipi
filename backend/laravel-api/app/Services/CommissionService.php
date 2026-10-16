<?php

namespace App\Services;

use App\Models\CommissionAdjustment;
use App\Models\CommissionRule;
use App\Models\MarketplaceSetting;
use App\Models\OrderCommission;
use App\Models\Order;
use App\Models\Refund;
use App\Models\SellerLedgerEntry;
use App\Models\SellerOrder;
use App\Models\SellerRefundAllocation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class CommissionService
{
    public const SETTING_NAME = 'commission';

    public function settings(): array
    {
        $defaults = [
            'enabled' => true,
            'default_percentage_bps' => (int) config('marketplace.default_commission_bps', 500),
            'updated_at' => null,
            'updated_by' => null,
            'persisted' => false,
            'requires_migration' => false,
        ];

        // The commission migration is intentionally additive and may not yet have
        // been run in an existing environment. Keep the read endpoint usable and
        // make the uninitialized state explicit instead of returning a 500 error.
        if (! Schema::hasTable('marketplace_settings')) {
            $defaults['requires_migration'] = true;

            return $defaults;
        }

        $setting = MarketplaceSetting::query()->where('name', self::SETTING_NAME)->first();
        $value = $setting?->value ?? [];

        return [
            'enabled' => (bool) ($value['enabled'] ?? true),
            'default_percentage_bps' => (int) ($value['default_percentage_bps'] ?? config('marketplace.default_commission_bps', 500)),
            'updated_at' => $setting?->updated_at?->toISOString(),
            'updated_by' => $setting?->updated_by,
            'persisted' => $setting !== null,
            'requires_migration' => false,
        ];
    }

    public function updateSettings(bool $enabled, int $defaultPercentageBps, ?int $adminId = null): array
    {
        $this->validateRate($defaultPercentageBps);
        $this->ensureSettingsStorage();

        $setting = MarketplaceSetting::query()->updateOrCreate(
            ['name' => self::SETTING_NAME],
            [
                'value' => [
                    'enabled' => $enabled,
                    'default_percentage_bps' => $defaultPercentageBps,
                ],
                'updated_by' => $adminId,
            ],
        );

        return $this->settings() + ['updated_at' => $setting->fresh()->updated_at?->toISOString()];
    }

    private function ensureSettingsStorage(): void
    {
        if (! Schema::hasTable('marketplace_settings')) {
            throw ValidationException::withMessages([
                'commission' => 'Commission settings storage is not initialized. Review and run the additive commission migration before saving.',
            ]);
        }
    }

    public function confirmSellerOrder(SellerOrder $sellerOrder): void
    {
        DB::transaction(function () use ($sellerOrder): void {
            $this->assertOperationalStorage();
            $order = Order::query()->whereKey($sellerOrder->order_id)->lockForUpdate()->firstOrFail();
            $hasVerifiedPayment = $order->payments()->where('status', 'paid')->exists();
            if ($order->payment_status !== 'paid' || ! $hasVerifiedPayment) {
                throw ValidationException::withMessages([
                    'payment' => 'Commission can only be confirmed after the parent order payment is verified.',
                ]);
            }

            $sellerOrder->loadMissing([
                'items.variant.product.brand',
                'items.variant.product.category',
            ]);

            $totalCommission = 0;

            foreach ($sellerOrder->items as $sellerOrderItem) {
                $existing = OrderCommission::query()
                    ->where('seller_order_item_id', $sellerOrderItem->id)
                    ->lockForUpdate()
                    ->first();

                // Existing rows are immutable historical records. Legacy rows created
                // before this workflow remain untouched and are never recalculated.
                if ($existing) {
                    $totalCommission += (int) $existing->commission_minor;
                    continue;
                }

                $product = $sellerOrderItem->variant?->product;
                $sellerId = (int) $sellerOrder->seller_id;
                $brandId = $product?->brand_id;
                $currency = strtoupper((string) ($sellerOrder->currency ?? 'MMK'));
                $gross = max(0, (int) ($sellerOrderItem->line_total_minor ?? 0));
                $decision = $this->resolveRule($sellerId, $brandId, $currency);
                $commission = $this->calculate($gross, $decision['percentage_bps'], $decision['fixed_minor']);
                $confirmedAt = now();

                $snapshot = [
                    'seller_id' => $sellerId,
                    'brand_id' => $brandId,
                    'rule_source' => $decision['rule_source'],
                    'eligible_subtotal_minor' => $gross,
                    'percentage_bps' => $decision['percentage_bps'],
                    'fixed_minor' => $decision['fixed_minor'],
                    'commission_minor' => $commission,
                    'currency' => $currency,
                    'confirmed_at' => $confirmedAt->toISOString(),
                ];

                $commissionRecord = (new OrderCommission())->forceFill([
                    'seller_order_id' => $sellerOrder->id,
                    'seller_order_item_id' => $sellerOrderItem->id,
                    'seller_id' => $sellerId,
                    'brand_id' => $brandId,
                    'commission_rule_id' => $decision['rule']?->id,
                    'rule_source' => $decision['rule_source'],
                    'status' => 'confirmed',
                    'confirmed_at' => $confirmedAt,
                    'percentage_bps' => $decision['percentage_bps'],
                    'fixed_minor' => $decision['fixed_minor'],
                    'gross_minor' => $gross,
                    'commission_minor' => $commission,
                    'net_minor' => max(0, $gross - $commission),
                    'currency' => $currency,
                    'snapshot' => $snapshot,
                ]);
                $commissionRecord->save();
                $totalCommission += $commission;
            }

            $subtotal = (int) ($sellerOrder->subtotal_minor ?? 0);
            $sellerOrder->update([
                'commission_minor' => $totalCommission,
                'net_minor' => max(0, $subtotal - $totalCommission),
            ]);
        });
    }

    public function reverseForRefund(Refund $refund): void
    {
        DB::transaction(function () use ($refund): void {
            $refund->loadMissing('order.sellerOrders.commissions');
            $commissions = $refund->order?->sellerOrders
                ?->flatMap(fn (SellerOrder $sellerOrder) => $sellerOrder->commissions)
                ->filter(fn (OrderCommission $commission) => $commission->status === 'confirmed') ?? collect();

            if ($commissions->isEmpty()) {
                return;
            }

            // The current refund API accepts an amount rather than refund line items.
            // Allocate against eligible product subtotal, excluding shipping, and keep
            // the original snapshot plus a separate, idempotent adjustment history.
            $refundAmount = max(0, (int) $refund->amount_minor);
            $basis = max(1, (int) $commissions->sum('gross_minor'));
            $commissionCount = $commissions->count();

            foreach ($commissions->values() as $index => $commission) {
                $alreadyReversed = (int) CommissionAdjustment::query()
                    ->where('order_commission_id', $commission->id)
                    ->where('type', 'reversal')
                    ->sum('amount_minor');
                $available = max(0, (int) $commission->commission_minor - $alreadyReversed);
                if ($available === 0) {
                    continue;
                }

                $allocatedRefund = $index === $commissionCount - 1
                    ? $refundAmount
                    : intdiv($refundAmount * (int) $commission->gross_minor, $basis);
                $allocatedRefund = min((int) $commission->gross_minor, max(0, $allocatedRefund));
                $reversal = min(
                    $available,
                    intdiv(((int) $commission->commission_minor * max(0, $allocatedRefund)) + intdiv($basis, 2), $basis),
                );
                if ($reversal === 0) {
                    continue;
                }

                CommissionAdjustment::query()->firstOrCreate(
                    ['idempotency_key' => 'commission-reversal:'.$refund->id.':'.$commission->id],
                    [
                        'order_commission_id' => $commission->id,
                        'seller_order_id' => $commission->seller_order_id,
                        'seller_order_item_id' => $commission->seller_order_item_id,
                        'refund_id' => $refund->id,
                        'type' => 'reversal',
                        'amount_minor' => $reversal,
                        'currency' => $commission->currency,
                        'metadata' => [
                            'refund_amount_minor' => $allocatedRefund,
                            'basis' => 'eligible_product_subtotal_prorated',
                        ],
                    ],
                );

                $sellerOrder = $commission->sellerOrder()->firstOrFail();
                $allocationKey = 'seller-refund:'.$refund->id.':'.$commission->seller_order_item_id;
                SellerRefundAllocation::query()->firstOrCreate(
                    ['ledger_idempotency_key' => $allocationKey],
                    [
                        'refund_id' => $refund->id,
                        'seller_order_id' => $commission->seller_order_id,
                        'seller_order_item_id' => $commission->seller_order_item_id,
                        'amount_minor' => $allocatedRefund,
                        'commission_reversed_minor' => $reversal,
                    ],
                );
                SellerLedgerEntry::query()->firstOrCreate(
                    ['idempotency_key' => $allocationKey.':gross'],
                    [
                        'seller_id' => $sellerOrder->seller_id,
                        'seller_order_id' => $sellerOrder->id,
                        'type' => 'refund_debit',
                        'amount_minor' => -$allocatedRefund,
                        'currency' => $commission->currency,
                        'reference_type' => Refund::class,
                        'reference_id' => $refund->id,
                        'metadata' => ['commission_reversed_minor' => $reversal],
                        'occurred_at' => now(),
                    ],
                );
                SellerLedgerEntry::query()->firstOrCreate(
                    ['idempotency_key' => $allocationKey.':commission'],
                    [
                        'seller_id' => $sellerOrder->seller_id,
                        'seller_order_id' => $sellerOrder->id,
                        'type' => 'commission_refund',
                        'amount_minor' => $reversal,
                        'currency' => $commission->currency,
                        'reference_type' => Refund::class,
                        'reference_id' => $refund->id,
                        'occurred_at' => now(),
                    ],
                );
            }
        });
    }

    public function reverseForCancellation(Order $order, ?int $actorId = null): void
    {
        DB::transaction(function () use ($order, $actorId): void {
            $order->loadMissing('sellerOrders.commissions');
            foreach ($order->sellerOrders->flatMap(fn (SellerOrder $sellerOrder) => $sellerOrder->commissions)->filter(fn (OrderCommission $commission) => $commission->status === 'confirmed') as $commission) {
                $available = max(0, (int) $commission->commission_minor - (int) CommissionAdjustment::query()->where('order_commission_id', $commission->id)->sum('amount_minor'));
                if ($available === 0) {
                    continue;
                }

                CommissionAdjustment::query()->firstOrCreate(
                    ['idempotency_key' => 'commission-cancellation:'.$order->id.':'.$commission->id],
                    [
                        'order_commission_id' => $commission->id,
                        'seller_order_id' => $commission->seller_order_id,
                        'seller_order_item_id' => $commission->seller_order_item_id,
                        'type' => 'cancellation',
                        'amount_minor' => $available,
                        'currency' => $commission->currency,
                        'created_by' => $actorId,
                        'metadata' => ['basis' => 'full_confirmed_commission_reversal'],
                    ],
                );

                $sellerOrder = $commission->sellerOrder()->firstOrFail();
                $key = 'seller-cancellation:'.$order->id.':'.$commission->id;
                SellerLedgerEntry::query()->firstOrCreate(
                    ['idempotency_key' => $key.':gross'],
                    [
                        'seller_id' => $sellerOrder->seller_id,
                        'seller_order_id' => $sellerOrder->id,
                        'type' => 'cancellation_debit',
                        'amount_minor' => -((int) $commission->gross_minor),
                        'currency' => $commission->currency,
                        'reference_type' => Order::class,
                        'reference_id' => $order->id,
                        'metadata' => ['commission_reversed_minor' => $available],
                        'occurred_at' => now(),
                    ],
                );
                SellerLedgerEntry::query()->firstOrCreate(
                    ['idempotency_key' => $key.':commission'],
                    [
                        'seller_id' => $sellerOrder->seller_id,
                        'seller_order_id' => $sellerOrder->id,
                        'type' => 'commission_cancellation',
                        'amount_minor' => $available,
                        'currency' => $commission->currency,
                        'reference_type' => Order::class,
                        'reference_id' => $order->id,
                        'occurred_at' => now(),
                    ],
                );
            }
        });
    }

    public function resolveRule(int $sellerId, ?int $brandId, string $currency): array
    {
        $settings = $this->settings();
        if (! $settings['enabled']) {
            return $this->decision(null, 0, 0, 'global_disabled');
        }

        if ($brandId) {
            $brandRule = $this->scopeRule($sellerId, $brandId, $currency);
            if ($brandRule) {
                return $brandRule->is_active
                    ? $this->decision($brandRule, (int) $brandRule->percentage_bps, (int) $brandRule->fixed_minor, 'seller_brand')
                    : $this->decision($brandRule, 0, 0, 'seller_brand_disabled');
            }
        }

        $sellerRule = $this->scopeRule($sellerId, null, $currency);
        if ($sellerRule) {
            return $sellerRule->is_active
                ? $this->decision($sellerRule, (int) $sellerRule->percentage_bps, (int) $sellerRule->fixed_minor, 'seller')
                : $this->decision($sellerRule, 0, 0, 'seller_disabled');
        }

        return $this->decision(null, (int) $settings['default_percentage_bps'], 0, 'global_default');
    }

    public function validateRate(int $basisPoints): void
    {
        if ($basisPoints < 0 || $basisPoints > 10000) {
            throw ValidationException::withMessages([
                'percentage_bps' => 'Commission rate must be between 0% and 100%.',
            ]);
        }
    }

    private function scopeRule(?int $sellerId, ?int $brandId, string $currency): ?CommissionRule
    {
        $query = CommissionRule::query()
            ->where('seller_id', $sellerId)
            ->whereNull('category_id')
            ->whereRaw('UPPER(currency) = ?', [strtoupper($currency)])
            ->where(fn ($query) => $query->whereNull('starts_at')->orWhere('starts_at', '<=', now()))
            ->where(fn ($query) => $query->whereNull('ends_at')->orWhere('ends_at', '>=', now()));

        if (! Schema::hasColumn('commission_rules', 'brand_id')) {
            return $brandId === null ? $query->latest('id')->first() : null;
        }

        return $query->where('brand_id', $brandId)->latest('id')->first();
    }

    private function assertOperationalStorage(): void
    {
        $requiredColumns = [
            'order_commissions' => ['seller_id', 'brand_id', 'rule_source', 'status', 'confirmed_at'],
            'commission_rules' => ['brand_id'],
        ];

        if (! Schema::hasTable('marketplace_settings') || ! Schema::hasTable('commission_adjustments')) {
            throw ValidationException::withMessages([
                'commission' => 'Commission control storage is not initialized. Review and run the additive commission migration before confirming payment.',
            ]);
        }

        foreach ($requiredColumns as $table => $columns) {
            foreach ($columns as $column) {
                if (! Schema::hasColumn($table, $column)) {
                    throw ValidationException::withMessages([
                        'commission' => 'Commission control storage is incomplete. Review and run the additive commission migration before confirming payment.',
                    ]);
                }
            }
        }
    }

    private function calculate(int $gross, int $percentageBps, int $fixedMinor): int
    {
        if ($gross <= 0) {
            return 0;
        }

        $percentage = intdiv(($gross * max(0, $percentageBps)) + 5000, 10000);
        return min($gross, max(0, $percentage + max(0, $fixedMinor)));
    }

    private function decision(?CommissionRule $rule, int $percentageBps, int $fixedMinor, string $source): array
    {
        return [
            'rule' => $rule,
            'percentage_bps' => $percentageBps,
            'fixed_minor' => $fixedMinor,
            'rule_source' => $source,
        ];
    }
}
