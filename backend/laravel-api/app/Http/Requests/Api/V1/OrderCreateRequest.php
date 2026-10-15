<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class OrderCreateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (! $this->filled('idempotency_key') && $this->header('Idempotency-Key')) {
            $this->merge(['idempotency_key' => $this->header('Idempotency-Key')]);
        }
    }

    public function rules(): array
    {
        return [
            'shipping_address' => ['required', 'array'],
            'shipping_address.recipient_name' => ['required', 'string', 'max:120'],
            'shipping_address.phone' => ['required', 'string', 'max:30'],
            'shipping_address.line1' => ['required', 'string', 'max:255'],
            'shipping_address.line2' => ['nullable', 'string', 'max:255'],
            'shipping_address.city' => ['required', 'string', 'max:100'],
            'shipping_address.state' => ['nullable', 'string', 'max:100'],
            'shipping_address.postal_code' => ['nullable', 'string', 'max:30'],
            'shipping_address.country' => ['required', 'string', 'size:2'],
            'billing_address' => ['nullable', 'array'],
            'discount_minor' => ['sometimes', 'integer', 'min:0'],
            'shipping_minor' => ['sometimes', 'integer', 'min:0'],
            'tax_minor' => ['sometimes', 'integer', 'min:0'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'idempotency_key' => ['nullable', 'string', 'max:100'],
            'shipping_method_id' => ['nullable', 'integer', 'exists:shipping_methods,id'],
            'coupon_code' => ['nullable', 'string', 'max:80'],
        ];
    }
}
