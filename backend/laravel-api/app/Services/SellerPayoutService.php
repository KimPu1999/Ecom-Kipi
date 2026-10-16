<?php

namespace App\Services;

use App\Models\Seller;
use App\Models\SellerPayout;
use App\Models\SellerPayoutMethod;
use App\Models\SellerPayoutStatusHistory;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class SellerPayoutService
{
    private const TRANSITIONS = [
        'pending' => ['approved', 'rejected', 'cancelled'],
        'approved' => ['processing', 'rejected', 'cancelled'],
        'processing' => ['paid', 'rejected'],
        'rejected' => [],
        'cancelled' => [],
        'paid' => [],
        'processed' => [],
        'succeeded' => [],
        'completed' => [],
    ];

    public function __construct(private readonly MarketplaceOrderService $marketplace) {}

    public function ensurePayoutMethodStorage(): void
    {
        if (! Schema::hasTable('seller_payout_methods')) {
            throw ValidationException::withMessages([
                'payout_methods' => 'Payout method storage is not initialized. Review and run the additive seller payout migration before managing payout methods.',
            ]);
        }
    }

    public function ensureStatusStorage(): void
    {
        if (! Schema::hasTable('seller_payout_status_history')) {
            throw ValidationException::withMessages([
                'payouts' => 'Payout status history storage is not initialized. Review and run the additive seller payout migration before changing payout statuses.',
            ]);
        }
    }

    public function methods(Seller $seller): array
    {
        $this->ensurePayoutMethodStorage();

        return $seller->payoutMethods()
            ->where('is_active', true)
            ->latest()
            ->get()
            ->map(fn (SellerPayoutMethod $method): array => $method->safeArray())
            ->values()
            ->all();
    }

    public function createMethod(Seller $seller, array $data): SellerPayoutMethod
    {
        $this->ensurePayoutMethodStorage();

        return DB::transaction(function () use ($seller, $data): SellerPayoutMethod {
            $lockedSeller = Seller::query()->lockForUpdate()->findOrFail($seller->id);
            $method = SellerPayoutMethod::query()->create([
                'seller_id' => $lockedSeller->id,
                'method' => strtolower($data['method']),
                'provider_name' => $data['provider_name'] ?? null,
                'account_holder_name' => trim($data['account_holder_name']),
                'account_identifier' => $this->normalizeIdentifier($data['account_identifier']),
                'account_last4' => substr($this->normalizeIdentifier($data['account_identifier']), -4),
                'verification_status' => 'unverified',
                'is_default' => (bool) ($data['is_default'] ?? false),
                'is_active' => true,
            ]);

            if ($method->is_default || ! SellerPayoutMethod::query()->where('seller_id', $lockedSeller->id)->where('id', '<>', $method->id)->where('is_active', true)->exists()) {
                SellerPayoutMethod::query()->where('seller_id', $lockedSeller->id)->where('id', '<>', $method->id)->update(['is_default' => false]);
                $method->update(['is_default' => true]);
            }

            return $method->fresh();
        });
    }

    public function updateMethod(Seller $seller, int $methodId, array $data): SellerPayoutMethod
    {
        $this->ensurePayoutMethodStorage();

        return DB::transaction(function () use ($seller, $methodId, $data): SellerPayoutMethod {
            $method = SellerPayoutMethod::query()->where('seller_id', $seller->id)->lockForUpdate()->find($methodId);
            if (! $method) {
                throw (new ModelNotFoundException())->setModel(SellerPayoutMethod::class, [$methodId]);
            }

            $attributes = [];
            foreach (['method', 'provider_name', 'account_holder_name'] as $key) {
                if (array_key_exists($key, $data)) {
                    $attributes[$key] = $key === 'method' ? strtolower($data[$key]) : ($key === 'account_holder_name' ? trim($data[$key]) : $data[$key]);
                }
            }
            if (array_key_exists('account_identifier', $data) && trim((string) $data['account_identifier']) !== '') {
                $identifier = $this->normalizeIdentifier($data['account_identifier']);
                $attributes['account_identifier'] = $identifier;
                $attributes['account_last4'] = substr($identifier, -4);
                $attributes['verification_status'] = 'unverified';
                $attributes['verified_at'] = null;
                $attributes['verified_by'] = null;
            }
            if (array_key_exists('is_default', $data)) {
                $attributes['is_default'] = (bool) $data['is_default'];
            }
            if (array_key_exists('is_active', $data)) {
                $attributes['is_active'] = (bool) $data['is_active'];
            }
            $method->update($attributes);

            if ($method->is_default) {
                SellerPayoutMethod::query()->where('seller_id', $seller->id)->where('id', '<>', $method->id)->update(['is_default' => false]);
            } elseif (! SellerPayoutMethod::query()->where('seller_id', $seller->id)->where('is_active', true)->where('is_default', true)->exists()) {
                $replacement = SellerPayoutMethod::query()->where('seller_id', $seller->id)->where('is_active', true)->where('id', '<>', $method->id)->latest()->first();
                $replacement?->update(['is_default' => true]);
            }

            return $method->fresh();
        });
    }

    public function verifyMethod(int $methodId, User $actor, string $status): SellerPayoutMethod
    {
        $this->ensurePayoutMethodStorage();

        return DB::transaction(function () use ($methodId, $actor, $status): SellerPayoutMethod {
            $method = SellerPayoutMethod::query()->lockForUpdate()->findOrFail($methodId);
            $method->update([
                'verification_status' => $status,
                'verified_at' => $status === 'verified' ? now() : null,
                'verified_by' => $status === 'verified' ? $actor->id : null,
            ]);

            return $method->fresh();
        });
    }

    /**
     * Create a payout request while serializing requests for the seller. The
     * seller row lock makes the balance reservation check safe for concurrent
     * requests; the unique idempotency key handles network retries.
     */
    public function request(Seller $seller, int $amountMinor, ?int $methodId, string $idempotencyKey): array
    {
        $this->ensureStatusStorage();

        return DB::transaction(function () use ($seller, $amountMinor, $methodId, $idempotencyKey): array {
            $lockedSeller = Seller::query()->lockForUpdate()->findOrFail($seller->id);
            $scopedIdempotencyKey = 'seller:'.$lockedSeller->id.':'.$idempotencyKey;
            $existing = SellerPayout::query()->where('seller_id', $lockedSeller->id)->where('idempotency_key', $scopedIdempotencyKey)->first();
            if ($existing) {
                return ['payout' => $this->loadPayout($existing), 'replayed' => true];
            }

            $method = null;
            if ($methodId !== null) {
                $this->ensurePayoutMethodStorage();
                if (! Schema::hasColumn('seller_payouts', 'payout_method_id')) {
                    throw ValidationException::withMessages(['payout_method_id' => 'Payout method linkage is not initialized. Review and run the additive seller payout migration before requesting a method-based payout.']);
                }
                $method = SellerPayoutMethod::query()
                    ->where('seller_id', $lockedSeller->id)
                    ->where('is_active', true)
                    ->find($methodId);
                if (! $method) {
                    throw ValidationException::withMessages(['payout_method_id' => 'The selected payout method does not belong to this seller or is inactive.']);
                }
            }

            if (! $method && (! config('marketplace.stripe_connect_enabled') || ! $lockedSeller->payout_provider_account_id)) {
                throw ValidationException::withMessages(['payout_method_id' => 'Select an active payout method or complete provider onboarding before requesting a payout.']);
            }

            $earnings = $this->marketplace->earnings($lockedSeller->id);
            $minimum = (int) config('marketplace.payout_min_minor', 1);
            $maximum = (int) config('marketplace.payout_max_minor', 0);
            if ($amountMinor < $minimum) {
                throw ValidationException::withMessages(['amount_minor' => "The minimum payout is {$minimum} minor units."]);
            }
            if ($maximum > 0 && $amountMinor > $maximum) {
                throw ValidationException::withMessages(['amount_minor' => "The maximum payout is {$maximum} minor units."]);
            }
            if ($amountMinor > $earnings['available_minor']) {
                throw ValidationException::withMessages(['amount_minor' => 'Requested payout exceeds the available balance.']);
            }

            $payoutData = [
                'seller_id' => $lockedSeller->id,
                'status' => 'pending',
                'amount_minor' => $amountMinor,
                'currency' => $earnings['currency'],
                'provider' => $method?->provider_name ?? $method?->method ?? $lockedSeller->payout_provider ?? 'manual',
                'idempotency_key' => $scopedIdempotencyKey,
                'requested_at' => now(),
            ];
            if (Schema::hasColumn('seller_payouts', 'payout_method_id')) {
                $payoutData['payout_method_id'] = $method?->id;
            }
            $payout = SellerPayout::query()->create($payoutData);
            SellerPayoutStatusHistory::query()->create([
                'seller_payout_id' => $payout->id,
                'actor_id' => $lockedSeller->owner_user_id,
                'from_status' => null,
                'to_status' => 'pending',
                'note' => 'Payout request submitted by seller.',
            ]);

            return ['payout' => $this->loadPayout($payout), 'replayed' => false];
        });
    }

    public function transition(SellerPayout $payout, User $actor, string $toStatus, ?string $note = null, ?string $providerReference = null): SellerPayout
    {
        $this->ensureStatusStorage();

        return DB::transaction(function () use ($payout, $actor, $toStatus, $note, $providerReference): SellerPayout {
            $locked = SellerPayout::query()->lockForUpdate()->findOrFail($payout->id);
            $from = strtolower((string) $locked->status);
            $toStatus = strtolower($toStatus);
            if ($from === $toStatus) {
                return $this->loadPayout($locked);
            }
            if (! in_array($toStatus, self::TRANSITIONS[$from] ?? [], true)) {
                throw ValidationException::withMessages(['status' => "Cannot change payout status from {$from} to {$toStatus}."]);
            }
            if ($toStatus === 'paid' && trim((string) $providerReference) === '') {
                throw ValidationException::withMessages(['provider_reference' => 'A confirmed payment reference is required before marking a payout paid.']);
            }

            $attributes = ['status' => $toStatus];
            if ($providerReference !== null && trim($providerReference) !== '') {
                $attributes['provider_payout_id'] = trim($providerReference);
            }
            if ($toStatus === 'paid') {
                $attributes['processed_at'] = now();
            }
            if (in_array($toStatus, ['rejected', 'cancelled'], true) && $note !== null) {
                $attributes['failure_message'] = trim($note);
            }
            $locked->update($attributes);
            SellerPayoutStatusHistory::query()->create([
                'seller_payout_id' => $locked->id,
                'actor_id' => $actor->id,
                'from_status' => $from,
                'to_status' => $toStatus,
                'note' => $note,
                'provider_reference' => $providerReference,
            ]);

            return $this->loadPayout($locked);
        });
    }

    public function loadPayout(SellerPayout $payout): SellerPayout
    {
        if (Schema::hasColumn('seller_payouts', 'payout_method_id') && Schema::hasTable('seller_payout_methods')) {
            $payout->loadMissing('payoutMethod');
        }
        if (Schema::hasTable('seller_payout_status_history')) {
            $payout->loadMissing('statusHistory');
        }

        return $payout;
    }

    public function safePayout(SellerPayout $payout): array
    {
        $payout = $this->loadPayout($payout);
        $method = $payout->relationLoaded('payoutMethod') ? $payout->payoutMethod : null;

        return [
            'id' => $payout->id,
            'seller_id' => $payout->seller_id,
            'payout_method_id' => $payout->getAttribute('payout_method_id'),
            'payout_method' => $method?->safeArray(),
            'status' => $payout->status,
            'amount_minor' => (int) $payout->amount_minor,
            'currency' => $payout->currency,
            'provider' => $payout->provider,
            'provider_payout_id' => $payout->provider_payout_id,
            'failure_message' => $payout->failure_message,
            'requested_at' => $payout->requested_at?->toISOString(),
            'processed_at' => $payout->processed_at?->toISOString(),
            'created_at' => $payout->created_at?->toISOString(),
            'updated_at' => $payout->updated_at?->toISOString(),
            'status_history' => $payout->relationLoaded('statusHistory')
                ? $payout->statusHistory->map(fn (SellerPayoutStatusHistory $event): array => [
                    'id' => $event->id,
                    'from_status' => $event->from_status,
                    'to_status' => $event->to_status,
                    'note' => $event->note,
                    'provider_reference' => $event->provider_reference,
                    'actor_id' => $event->actor_id,
                    'created_at' => $event->created_at?->toISOString(),
                ])->values()->all()
                : [],
        ];
    }

    private function normalizeIdentifier(string $identifier): string
    {
        return preg_replace('/\s+/', '', trim($identifier)) ?: '';
    }
}
