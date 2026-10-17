<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class PaymentReceiptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'sender_name' => ['required', 'string', 'max:120'],
            'sender_phone' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+()\-\s]{6,30}$/'],
            'transaction_code' => ['nullable', 'string', 'max:120', 'regex:/^[A-Za-z0-9._\/\-]{4,120}$/'],
            'receipt' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png', 'max:'.config('payment_receipts.max_file_size_kb', 5120)],
        ];
    }
}
