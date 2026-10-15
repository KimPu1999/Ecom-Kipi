<?php

namespace App\Http\Controllers\Api\V1\Marketplace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\SellerApplicationRequest;
use App\Models\SellerApplication;
use App\Services\SellerApprovalService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SellerApplicationController extends Controller
{
    public function index(Request $request)
    {
        return ApiResponse::success($request->user()->sellerApplications()->with('documents')->latest()->get(), 'Seller applications retrieved');
    }

    public function store(SellerApplicationRequest $request, SellerApprovalService $approval)
    {
        $active = $request->user()->sellerApplications()->whereIn('application_status', [SellerApplication::STATUS_PENDING, 'submitted', 'under_review'])->exists();
        if ($active) {
            throw ValidationException::withMessages(['application' => 'You already have an application under review.']);
        }

        $data = $request->validated();
        $documents = $request->file('documents', []);
        $application = DB::transaction(function () use ($request, $approval, $data, $documents) {
            $application = $request->user()->sellerApplications()->create([
                'business_name' => $data['business_name'],
                'business_type' => $data['business_type'] ?? null,
                'business_details' => $data['business_details'] ?? null,
                'contact_details' => $data['contact_details'] ?? null,
                'application_status' => SellerApplication::STATUS_PENDING,
                'submitted_at' => now(),
            ]);
            foreach ($documents as $index => $document) {
                $application->documents()->create([
                    'document_type' => $data['document_types'][$index] ?? 'verification',
                    'storage_path' => $document->store('seller-verification', 'local'),
                    'status' => 'pending',
                ]);
            }
            $approval->recordApplicationSubmission($application, $request->user(), $request);

            return $application;
        });

        return ApiResponse::success($application->load('documents'), 'Seller application submitted', 201);
    }

    public function show(Request $request, SellerApplication $application)
    {
        abort_unless($application->user_id === $request->user()->id, 404);

        return ApiResponse::success($application->load('documents'), 'Seller application retrieved');
    }
}
