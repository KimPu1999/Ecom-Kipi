<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class AdminRefundRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['amount_minor' => ['required', 'integer', 'min:1'], 'reason' => ['nullable', 'string', 'max:500'], 'idempotency_key' => ['required', 'string', 'max:120']];
    }
}
