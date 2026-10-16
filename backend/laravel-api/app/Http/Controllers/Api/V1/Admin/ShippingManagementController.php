<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Rider;
use App\Models\ShippingCarrier;
use App\Models\ShippingMethod;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ShippingManagementController extends Controller
{
    public function methods(Request $request)
    {
        $query = ShippingMethod::query()
            ->when($request->filled('q'), fn ($builder) => $builder->where(function ($nested) use ($request) {
                $term = '%'.$request->string('q')->toString().'%';
                $nested->where('name', 'like', $term)->orWhere('code', 'like', $term);
            }))
            ->orderBy('sort_order')
            ->orderBy('name');
        $page = $query->paginate(min($request->integer('per_page', 30), 100));

        return ApiResponse::paginated($page, $page->items(), 'Shipping methods retrieved');
    }

    public function storeMethod(Request $request)
    {
        $data = $this->methodData($request);
        $method = ShippingMethod::query()->create($data);
        $this->audit($request, 'shipping.method_created', $method);

        return ApiResponse::success($method, 'Shipping method created', 201);
    }

    public function updateMethod(Request $request, ShippingMethod $method)
    {
        $data = $this->methodData($request, $method->id);
        $before = $method->toArray();
        $method->update($data);
        $this->audit($request, 'shipping.method_updated', $method, $before);

        return ApiResponse::success($method->fresh(), 'Shipping method updated');
    }

    public function carriers(Request $request)
    {
        $query = ShippingCarrier::query()->when($request->filled('q'), fn ($builder) => $builder->where('name', 'like', '%'.$request->string('q')->toString().'%'))->orderBy('sort_order')->orderBy('name');
        $page = $query->paginate(min($request->integer('per_page', 30), 100));

        return ApiResponse::paginated($page, $page->items(), 'Shipping carriers retrieved');
    }

    public function storeCarrier(Request $request)
    {
        $data = $this->carrierData($request);
        $carrier = ShippingCarrier::create($data + ['code' => Str::slug($data['code'] ?? $data['name'])]);
        $this->audit($request, 'shipping.carrier_created', $carrier);

        return ApiResponse::success($carrier, 'Shipping carrier created', 201);
    }

    public function updateCarrier(Request $request, ShippingCarrier $carrier)
    {
        $data = $this->carrierData($request, $carrier->id);
        $before = $carrier->toArray();
        $carrier->update($data);
        $this->audit($request, 'shipping.carrier_updated', $carrier, $before);

        return ApiResponse::success($carrier->fresh(), 'Shipping carrier updated');
    }

    public function riders(Request $request)
    {
        $query = Rider::with(['seller', 'user'])->when($request->filled('q'), fn ($builder) => $builder->where('name', 'like', '%'.$request->string('q')->toString().'%')->orWhere('phone', 'like', '%'.$request->string('q')->toString().'%'))->latest();
        $page = $query->paginate(min($request->integer('per_page', 30), 100));

        return ApiResponse::paginated($page, $page->items(), 'Riders retrieved');
    }

    public function storeRider(Request $request)
    {
        $data = $request->validate(['user_id' => ['nullable', 'integer', 'exists:users,id'], 'seller_id' => ['nullable', 'integer', 'exists:sellers,id'], 'name' => ['required', 'string', 'max:150'], 'phone' => ['nullable', 'string', 'max:40'], 'coverage_regions' => ['nullable', 'array'], 'status' => ['nullable', 'in:active,inactive']]);
        $rider = Rider::create($data + ['status' => 'active']);
        $this->audit($request, 'shipping.rider_created', $rider);

        return ApiResponse::success($rider->load(['seller', 'user']), 'Rider created', 201);
    }

    public function updateRider(Request $request, Rider $rider)
    {
        $data = $request->validate(['user_id' => ['nullable', 'integer', 'exists:users,id'], 'seller_id' => ['nullable', 'integer', 'exists:sellers,id'], 'name' => ['sometimes', 'string', 'max:150'], 'phone' => ['nullable', 'string', 'max:40'], 'coverage_regions' => ['nullable', 'array'], 'status' => ['sometimes', 'in:active,inactive']]);
        $before = $rider->toArray();
        $rider->update($data);
        $this->audit($request, 'shipping.rider_updated', $rider, $before);

        return ApiResponse::success($rider->fresh(['seller', 'user']), 'Rider updated');
    }

    private function carrierData(Request $request, ?int $ignoreId = null): array
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:120'], 'code' => ['nullable', 'string', 'max:60'], 'type' => ['required', 'in:external_courier,self_delivery'], 'tracking_url' => ['nullable', 'url:http,https', 'max:500'], 'tracking_url_template' => ['nullable', 'string', 'max:500'], 'contact_email' => ['nullable', 'email', 'max:150'], 'contact_phone' => ['nullable', 'string', 'max:40'], 'regions' => ['nullable', 'array'], 'is_active' => ['sometimes', 'boolean'], 'sort_order' => ['nullable', 'integer', 'min:0']]);
        $data['code'] = Str::slug($data['code'] ?? $data['name']);
        if (isset($data['tracking_url_template'])) {
            $candidate = str_replace('{tracking}', 'sample', $data['tracking_url_template']);
            abort_unless((bool) filter_var($candidate, FILTER_VALIDATE_URL) && in_array(parse_url($candidate, PHP_URL_SCHEME), ['http', 'https'], true), 422, 'Tracking URL template must be an HTTP or HTTPS URL.');
        }
        $query = ShippingCarrier::query()->where('code', $data['code']);
        if ($ignoreId) $query->where('id', '!=', $ignoreId);
        abort_if($query->exists(), 422, 'Carrier code already exists.');

        return $data;
    }

    private function methodData(Request $request, ?int $ignoreId = null): array
    {
        $data = $request->validate([
            'code' => [$ignoreId ? 'sometimes' : 'required', 'string', 'max:100'],
            'name' => [$ignoreId ? 'sometimes' : 'required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:1000'],
            'price_minor' => [$ignoreId ? 'sometimes' : 'required', 'integer', 'min:0'],
            'currency' => ['sometimes', 'nullable', 'string', 'size:3'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'nullable', 'integer', 'min:0'],
        ]);
        if (array_key_exists('code', $data)) {
            $data['code'] = Str::slug($data['code']);
            abort_if($data['code'] === '', 422, 'Shipping method code must contain letters or numbers.');
            $query = ShippingMethod::query()->where('code', $data['code']);
            if ($ignoreId) {
                $query->where('id', '!=', $ignoreId);
            }
            abort_if($query->exists(), 422, 'Shipping method code already exists.');
        }
        if (array_key_exists('currency', $data)) {
            $data['currency'] = strtoupper($data['currency'] ?? 'MMK');
        } elseif (! $ignoreId) {
            $data['currency'] = 'MMK';
        }
        if (array_key_exists('sort_order', $data)) {
            $data['sort_order'] = (int) ($data['sort_order'] ?? 0);
        } elseif (! $ignoreId) {
            $data['sort_order'] = 0;
        }
        if (! $ignoreId && ! array_key_exists('is_active', $data)) {
            $data['is_active'] = true;
        }

        return $data;
    }

    private function audit(Request $request, string $action, object $resource, ?array $before = null): void
    {
        AuditLog::query()->create(['actor_id' => $request->user()->id, 'action' => $action, 'resource_type' => $resource::class, 'resource_id' => $resource->id, 'before' => $before, 'after' => $resource->toArray(), 'ip_address' => $request->ip(), 'user_agent' => $request->userAgent()]);
    }
}
