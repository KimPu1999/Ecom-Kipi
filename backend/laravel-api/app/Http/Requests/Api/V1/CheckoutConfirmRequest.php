<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class CheckoutConfirmRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
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
            'shipping_method_id' => ['nullable', 'integer', 'exists:shipping_methods,id'],
            'coupon_code' => ['nullable', 'string', 'max:80'],
            'idempotency_key' => ['nullable', 'string', 'max:120'],
            'payment_method' => ['sometimes', 'string', 'in:cod,kbzpay,wavepay,bank_transfer,card'],
            'payment_metadata' => ['nullable', 'array'],
            'payment_metadata.sender_phone' => ['required_if:payment_method,kbzpay,wavepay,bank_transfer', 'string', 'max:30', 'regex:/^[0-9+()\-\s]{6,30}$/'],
            'payment_metadata.transaction_code' => ['required_if:payment_method,kbzpay,wavepay,bank_transfer', 'string', 'max:120', 'regex:/^[A-Za-z0-9._\/-]{4,120}$/'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if (! $this->filled('idempotency_key') && $this->header('Idempotency-Key')) {
            $this->merge(['idempotency_key' => $this->header('Idempotency-Key')]);
        }
    }
}
