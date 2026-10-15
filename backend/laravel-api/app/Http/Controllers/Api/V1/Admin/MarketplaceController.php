<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\CommissionRule;
use App\Models\Seller;
use App\Models\SellerApplication;
use App\Models\SellerDocument;
use App\Models\SellerPayout;
use App\Services\SellerApprovalService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

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

    public function commissionRules(Request $request)
    {
        $rules = CommissionRule::with(['seller', 'category'])->latest()->paginate(30);

        return ApiResponse::paginated($rules, $rules->items(), 'Commission rules retrieved');
    }

    public function storeCommissionRule(Request $request)
    {
        $data = $request->validate(['seller_id' => ['nullable', 'exists:sellers,id'], 'category_id' => ['nullable', 'exists:categories,id'], 'percentage_bps' => ['required', 'integer', 'min:0', 'max:10000'], 'fixed_minor' => ['nullable', 'integer', 'min:0'], 'currency' => ['nullable', 'string', 'size:3'], 'starts_at' => ['nullable', 'date'], 'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at']]);

        return ApiResponse::success(CommissionRule::create($data + ['currency' => 'MMK', 'fixed_minor' => 0, 'is_active' => true]), 'Commission rule created', 201);
    }

    public function updateCommissionRule(Request $request, CommissionRule $commissionRule)
    {
        $data = $request->validate([
            'percentage_bps' => ['required', 'integer', 'min:0', 'max:10000'],
            'fixed_minor' => ['nullable', 'integer', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $commissionRule->update($data);

        return ApiResponse::success($commissionRule->fresh(['seller', 'category']), 'Commission rule updated');
    }

    public function payouts()
    {
        return ApiResponse::success(SellerPayout::with('seller')->latest()->paginate(30), 'Marketplace payouts retrieved');
    }
}
