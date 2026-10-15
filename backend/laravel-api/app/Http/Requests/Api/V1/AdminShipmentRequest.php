<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class AdminShipmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'delivery_method' => ['sometimes', 'in:self_delivery,external_courier'],
            'carrier_id' => ['nullable', 'integer', 'exists:shipping_carriers,id'],
            'carrier' => ['nullable', 'string', 'max:80'],
            'tracking_number' => ['nullable', 'string', 'max:120'],
            'tracking_url' => ['nullable', 'url:http,https', 'max:500'],
            'rider_id' => ['nullable', 'integer', 'exists:riders,id'],
            'estimated_delivery_at' => ['nullable', 'date', 'after_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'shipping_method_id' => ['nullable', 'integer', 'exists:shipping_methods,id'],
        ];
    }
}
