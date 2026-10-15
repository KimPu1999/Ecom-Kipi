<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CouponController extends Controller
{
    public function index(Request $request)
    {
        $coupons = Coupon::query()->when($request->filled('q'), fn ($query) => $query->where('code', 'like', '%'.strtoupper($request->string('q')->toString()).'%'))->latest()->paginate(min($request->integer('per_page', 30), 100));

        return ApiResponse::paginated($coupons, $coupons->items(), 'Coupons retrieved');
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['code'] = strtoupper($data['code']);
        $coupon = Coupon::query()->create($data);

        return ApiResponse::success($coupon, 'Coupon created', 201);
    }

    public function update(Request $request, Coupon $coupon)
    {
        $data = $this->validated($request, $coupon->id);
        $data['code'] = strtoupper($data['code']);
        $coupon->update($data);

        return ApiResponse::success($coupon->fresh(), 'Coupon updated');
    }

    public function destroy(Coupon $coupon)
    {
        $coupon->update(['is_active' => false]);

        return ApiResponse::success(null, 'Coupon disabled');
    }

    private function validated(Request $request, ?int $id = null): array
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:80', Rule::unique('coupons', 'code')->ignore($id)],
            'type' => ['required', Rule::in(['fixed', 'percentage'])],
            'value' => ['required', 'integer', 'min:1'],
            'minimum_subtotal_minor' => ['nullable', 'integer', 'min:0'],
            'maximum_discount_minor' => ['nullable', 'integer', 'min:1'],
            'usage_limit' => ['nullable', 'integer', 'min:1'],
            'per_user_limit' => ['nullable', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'is_active' => ['sometimes', 'boolean'],
        ]) + [
            'minimum_subtotal_minor' => (int) ($request->input('minimum_subtotal_minor') ?? 0),
            'per_user_limit' => (int) ($request->input('per_user_limit') ?? 1),
            'is_active' => $request->boolean('is_active', true),
        ];

        if ($data['type'] === 'percentage' && $data['value'] > 10000) {
            throw ValidationException::withMessages(['value' => 'Percentage coupons must be between 1 and 10000 basis points.']);
        }

        return $data;
    }
}
