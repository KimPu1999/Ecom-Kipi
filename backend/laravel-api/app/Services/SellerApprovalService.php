<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Role;
use App\Models\Seller;
use App\Models\SellerApplication;
use App\Models\SellerApprovalHistory;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SellerApprovalService
{
    public function recordApplicationSubmission(SellerApplication $application, User $actor, Request $request): SellerApprovalHistory
    {
        return $this->record($application, null, SellerApplication::STATUS_PENDING, 'submitted', null, $actor, $request);
    }

    public function approve(SellerApplication $application, User $reviewer, Request $request, array $data): Seller
    {
        if (! $application->isPending()) {
            throw ValidationException::withMessages(['application' => 'Only pending applications can be approved.']);
        }

        return DB::transaction(function () use ($application, $reviewer, $request, $data): Seller {
            $existing = Seller::query()->where('owner_user_id', $application->user_id)->whereIn('status', [Seller::STATUS_APPROVED, 'active', Seller::STATUS_SUSPENDED])->exists();
            if ($existing) {
                throw ValidationException::withMessages(['application' => 'This applicant already has a seller account.']);
            }

            $seller = Seller::query()->create($data + [
                'owner_user_id' => $application->user_id,
                'status' => Seller::STATUS_APPROVED,
                'approved_at' => now(),
                'approved_by' => $reviewer->id,
            ]);
            $seller->memberships()->create(['user_id' => $application->user_id, 'role' => 'owner', 'status' => 'active']);
            $seller->settings()->create();

            $sellerRole = Role::query()->where('name', 'seller')->first();
            if ($sellerRole) {
                $application->user()->firstOrFail()->roles()->syncWithoutDetaching([$sellerRole->id]);
            }

            $from = $application->application_status;
            $application->update(['application_status' => SellerApplication::STATUS_APPROVED, 'reviewed_at' => now(), 'reviewed_by' => $reviewer->id, 'rejection_reason' => null]);
            $this->record($application, $seller, SellerApplication::STATUS_APPROVED, 'approved', null, $reviewer, $request, $from);
            $this->audit($request, 'seller.application_approved', $seller, ['application_status' => $from], ['application_status' => SellerApplication::STATUS_APPROVED]);

            return $seller;
        });
    }

    public function reject(SellerApplication $application, User $reviewer, Request $request, string $reason): SellerApplication
    {
        if (! $application->isPending()) {
            throw ValidationException::withMessages(['application' => 'Only pending applications can be rejected.']);
        }

        return DB::transaction(function () use ($application, $reviewer, $request, $reason): SellerApplication {
            $from = $application->application_status;
            $application->update(['application_status' => SellerApplication::STATUS_REJECTED, 'reviewed_at' => now(), 'reviewed_by' => $reviewer->id, 'rejection_reason' => $reason]);
            $this->record($application, null, SellerApplication::STATUS_REJECTED, 'rejected', $reason, $reviewer, $request, $from);
            $this->audit($request, 'seller.application_rejected', $application, ['application_status' => $from], ['application_status' => SellerApplication::STATUS_REJECTED, 'rejection_reason' => $reason]);

            return $application->fresh();
        });
    }

    public function setSellerStatus(Seller $seller, User $reviewer, Request $request, string $status, ?string $reason = null): Seller
    {
        $status = $status === 'active' ? Seller::STATUS_APPROVED : $status;
        if (! in_array($status, [Seller::STATUS_APPROVED, Seller::STATUS_SUSPENDED], true)) {
            throw ValidationException::withMessages(['status' => 'Seller status must be approved or suspended.']);
        }
        if ($status === Seller::STATUS_APPROVED && ! in_array($seller->status, [Seller::STATUS_SUSPENDED, Seller::STATUS_APPROVED, 'active'], true)) {
            throw ValidationException::withMessages(['status' => 'Only an existing approved or suspended seller can be approved.']);
        }

        return DB::transaction(function () use ($seller, $reviewer, $request, $status, $reason): Seller {
            $seller->loadMissing('owner');
            $from = $seller->status === 'active' ? Seller::STATUS_APPROVED : $seller->status;
            if ($from === $status) {
                if ($seller->status !== $status) {
                    $seller->update(['status' => $status]);
                }

                return $seller->fresh();
            }

            $seller->update(['status' => $status, 'suspended_at' => $status === Seller::STATUS_SUSPENDED ? now() : null]);
            $seller->memberships()->where('role', 'owner')->update(['status' => $status === Seller::STATUS_APPROVED ? 'active' : 'suspended']);
            $application = $seller->owner->sellerApplications()->whereIn('application_status', [SellerApplication::STATUS_APPROVED, SellerApplication::STATUS_SUSPENDED])->latest()->first();
            $applicationFrom = $application?->application_status;
            if ($application) {
                $application->update(['application_status' => $status, 'reviewed_at' => now(), 'reviewed_by' => $reviewer->id, 'rejection_reason' => $status === Seller::STATUS_SUSPENDED ? $reason : null]);
            }
            $this->record($application, $seller, $status, $status === Seller::STATUS_SUSPENDED ? 'suspended' : 'reinstated', $reason, $reviewer, $request, $applicationFrom ?? $from);
            $this->audit($request, $status === Seller::STATUS_SUSPENDED ? 'seller.suspended' : 'seller.reinstated', $seller, ['status' => $from], ['status' => $status, 'reason' => $reason]);

            return $seller->fresh();
        });
    }

    private function record(?SellerApplication $application, ?Seller $seller, string $toStatus, string $action, ?string $reason, User $actor, Request $request, ?string $fromStatus = null): SellerApprovalHistory
    {
        return SellerApprovalHistory::query()->create([
            'seller_application_id' => $application?->id,
            'seller_id' => $seller?->id,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'action' => $action,
            'reason' => $reason,
            'changed_by' => $actor->id,
            'metadata' => ['ip_address' => $request->ip()],
        ]);
    }

    private function audit(Request $request, string $action, Seller|SellerApplication $resource, ?array $before, ?array $after): void
    {
        AuditLog::query()->create([
            'actor_user_id' => $request->user()?->id,
            'action' => $action,
            'resource_type' => $resource::class,
            'resource_id' => $resource->getKey(),
            'ip_address' => $request->ip(),
            'request_id' => $request->header('X-Request-Id'),
            'before' => $before,
            'after' => $after,
        ]);
    }
}
