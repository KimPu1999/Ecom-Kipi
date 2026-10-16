<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\CommissionRule;
use App\Models\Seller;
use App\Models\SellerApplication;
use App\Models\SellerDocument;
use App\Models\SellerPayout;
use App\Services\SellerApprovalService;
use App\Services\CommissionService;
use App\Services\SellerPayoutService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class MarketplaceController extends Controller
{
    public function applications()
    {
        return ApiResponse::success(SellerApplication::with(['user', 'documents', 'approvalHistory.changedBy'])->latest()->paginate(30), 'Seller applications retrieved');
    }

    public function showApplication(SellerApplication $application)
    {
        return ApiResponse::success($application->load(['user', 'documents', 'approvalHistory.changedBy']), 'Seller application retrieved');
    }

    public function approve(Request $request, SellerApplication $application, SellerApprovalService $approval)
    {
        $data = $request->validate(['store_name' => ['required', 'string', 'max:150'], 'slug' => ['required', 'string', 'max:150', 'unique:sellers,slug'], 'description' => ['nullable', 'string'], 'support_email' => ['nullable', 'email'], 'support_phone' => ['nullable', 'string', 'max:30']]);
        $seller = $approval->approve($application, $request->user(), $request, $data);

        return ApiResponse::success($seller->load('owner'), 'Seller application approved');
    }

    public function reject(Request $request, SellerApplication $application, SellerApprovalService $approval)
    {
        $data = $request->validate(['rejection_reason' => ['required', 'string', 'max:1000']]);
        $application = $approval->reject($application, $request->user(), $request, $data['rejection_reason']);

        return ApiResponse::success($application, 'Seller application rejected');
    }

    public function sellers()
    {
        return ApiResponse::success(Seller::withCount(['products', 'orders'])->latest()->paginate(30), 'Sellers retrieved');
    }

    public function updateSellerStatus(Request $request, Seller $seller, SellerApprovalService $approval)
    {
        $data = $request->validate(['status' => ['required', 'in:approved,suspended,active'], 'reason' => ['nullable', 'string', 'max:1000']]);
        $seller = $approval->setSellerStatus($seller, $request->user(), $request, $data['status'], $data['reason'] ?? null);

        return ApiResponse::success($seller, 'Seller status updated');
    }

    public function downloadDocument(SellerApplication $application, SellerDocument $document)
    {
        abort_unless($document->seller_application_id === $application->id, 404);
        abort_unless(Storage::disk('local')->exists($document->storage_path), 404);

        return Storage::disk('local')->download($document->storage_path, basename($document->storage_path));
    }

    public function commissionSettings(Request $request, CommissionService $commissions)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403, 'Super administrator access required.');

        return ApiResponse::success($commissions->settings(), 'Commission settings retrieved');
    }

    public function updateCommissionSettings(Request $request, CommissionService $commissions)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403, 'Super administrator access required.');
        $data = $request->validate([
            'commission_enabled' => ['required', 'boolean'],
            'default_percentage_bps' => ['required', 'integer', 'min:0', 'max:10000'],
        ]);

        return ApiResponse::success($commissions->updateSettings((bool) $data['commission_enabled'], (int) $data['default_percentage_bps'], $request->user()->id), 'Commission settings updated');
    }

    public function sellerBrands(Request $request, Seller $seller)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403, 'Super administrator access required.');

        $brands = Brand::query()
            ->whereHas('products', fn ($query) => $query->where('seller_id', $seller->id))
            ->orderBy('name')
            ->get(['brands.id', 'brands.name', 'brands.slug', 'brands.logo_url']);

        return ApiResponse::success($brands, 'Seller brands retrieved');
    }

    public function commissionRules(Request $request)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403, 'Super administrator access required.');

        $hasBrandColumn = Schema::hasColumn('commission_rules', 'brand_id');
        $query = CommissionRule::with(['seller', 'category']);
        if ($hasBrandColumn) {
            $query->with('brand');
        }
        if ($request->filled('seller_id')) {
            $query->where('seller_id', $request->integer('seller_id'));
        }
        if ($hasBrandColumn && $request->filled('brand_id')) {
            $query->where('brand_id', $request->integer('brand_id'));
        }
        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }
        if ($request->filled('q')) {
            $search = '%'.$request->string('q')->toString().'%';
            $query->where(function ($builder) use ($search, $hasBrandColumn): void {
                $builder->whereHas('seller', fn ($seller) => $seller->where('store_name', 'like', $search));
                if ($hasBrandColumn) {
                    $builder->orWhereHas('brand', fn ($brand) => $brand->where('name', 'like', $search));
                }
            });
        }
        $rules = $query->latest()->paginate(min(100, max(1, $request->integer('per_page', 30))));
        $items = collect($rules->items())->map(function (CommissionRule $rule) use ($hasBrandColumn): CommissionRule|array {
            if ($hasBrandColumn) {
                return $rule;
            }

            // Keep the response contract stable for legacy databases while the
            // additive commission migration is still pending.
            $data = $rule->toArray();
            $data['brand_id'] = null;
            $data['brand'] = null;

            return $data;
        });

        return ApiResponse::paginated($rules, $items, 'Commission rules retrieved');
    }

    public function storeCommissionRule(Request $request)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403, 'Super administrator access required.');
        $this->ensureCommissionStorage();
        $data = $request->validate([
            'seller_id' => ['nullable', 'exists:sellers,id'],
            'brand_id' => ['nullable', 'exists:brands,id'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'percentage_bps' => ['required', 'integer', 'min:0', 'max:10000'],
            'fixed_minor' => ['nullable', 'integer', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $this->validateCommissionScope($data);
        $data['currency'] = strtoupper($data['currency'] ?? 'MMK');
        $data['fixed_minor'] = (int) ($data['fixed_minor'] ?? 0);
        $data['is_active'] = (bool) ($data['is_active'] ?? true);
        $this->ensureUniqueCommissionScope($data);

        return ApiResponse::success(CommissionRule::create($data), 'Commission rule created', 201);
    }

    public function updateCommissionRule(Request $request, CommissionRule $commissionRule)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403, 'Super administrator access required.');
        $this->ensureCommissionStorage();
        $data = $request->validate([
            'seller_id' => ['sometimes', 'nullable', 'exists:sellers,id'],
            'brand_id' => ['sometimes', 'nullable', 'exists:brands,id'],
            'category_id' => ['sometimes', 'nullable', 'exists:categories,id'],
            'percentage_bps' => ['required', 'integer', 'min:0', 'max:10000'],
            'fixed_minor' => ['nullable', 'integer', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $data['currency'] = strtoupper($data['currency'] ?? $commissionRule->currency);
        $scope = array_merge($commissionRule->only(['seller_id', 'brand_id', 'category_id']), $data);
        $this->validateCommissionScope($scope);
        $this->ensureUniqueCommissionScope($scope, $commissionRule->id);

        $commissionRule->update($data);

        return ApiResponse::success($commissionRule->fresh(['seller', 'brand', 'category']), 'Commission rule updated');
    }

    private function validateCommissionScope(array $data): void
    {
        if (! empty($data['brand_id']) && empty($data['seller_id'])) {
            throw ValidationException::withMessages(['brand_id' => 'A brand commission rule must belong to a seller.']);
        }
        if (! empty($data['brand_id']) && ! empty($data['category_id'])) {
            throw ValidationException::withMessages(['brand_id' => 'Choose a seller brand rule or a legacy category rule, not both.']);
        }
        if (! empty($data['brand_id']) && ! Brand::query()->whereKey($data['brand_id'])->whereHas('products', fn ($query) => $query->where('seller_id', $data['seller_id']))->exists()) {
            throw ValidationException::withMessages(['brand_id' => 'The selected brand is not owned by the selected seller.']);
        }
    }

    private function ensureUniqueCommissionScope(array $data, ?int $ignoreId = null): void
    {
        if (! empty($data['category_id'])) {
            return;
        }
        $query = CommissionRule::query()
            ->where('seller_id', $data['seller_id'] ?? null)
            ->where('brand_id', $data['brand_id'] ?? null)
            ->whereNull('category_id')
            ->where('currency', strtoupper($data['currency'] ?? 'MMK'));
        if ($ignoreId) {
            $query->where('id', '<>', $ignoreId);
        }
        if ($query->exists()) {
            throw ValidationException::withMessages(['scope' => 'A commission rule already exists for this seller and brand scope. Edit or disable it instead.']);
        }
    }

    private function ensureCommissionStorage(): void
    {
        if (! Schema::hasTable('marketplace_settings') || ! Schema::hasColumn('commission_rules', 'brand_id')) {
            throw ValidationException::withMessages([
                'commission' => 'Commission control storage is not initialized. Review and run the additive commission migration before saving settings or rules.',
            ]);
        }
    }

    public function payouts(SellerPayoutService $payouts)
    {
        $query = SellerPayout::with('seller')->latest();
        if (Schema::hasColumn('seller_payouts', 'payout_method_id') && Schema::hasTable('seller_payout_methods')) {
            $query->with('payoutMethod');
        }
        $page = $query->paginate(30);
        $rows = collect($page->items())->map(function (SellerPayout $payout) use ($payouts): array {
            $row = $payouts->safePayout($payout);
            $row['seller'] = $payout->seller ? [
                'id' => $payout->seller->id,
                'store_name' => $payout->seller->store_name,
            ] : null;

            return $row;
        });

        return ApiResponse::paginated($page, $rows, 'Marketplace payouts retrieved');
    }

    public function updatePayoutStatus(Request $request, SellerPayout $sellerPayout, SellerPayoutService $payouts)
    {
        $data = $request->validate([
            'status' => ['required', 'in:approved,processing,paid,rejected,cancelled'],
            'note' => ['nullable', 'string', 'max:1000'],
            'provider_reference' => ['nullable', 'string', 'max:255'],
        ]);
        $updated = $payouts->transition($sellerPayout, $request->user(), $data['status'], $data['note'] ?? null, $data['provider_reference'] ?? null);

        return ApiResponse::success($payouts->safePayout($updated), 'Payout status updated');
    }

    public function verifyPayoutMethod(Request $request, int $payoutMethod, SellerPayoutService $payouts)
    {
        $data = $request->validate(['verification_status' => ['required', 'in:unverified,verified,rejected']]);
        $method = $payouts->verifyMethod($payoutMethod, $request->user(), $data['verification_status']);

        return ApiResponse::success($method->safeArray(), 'Payout method verification updated');
    }
}
