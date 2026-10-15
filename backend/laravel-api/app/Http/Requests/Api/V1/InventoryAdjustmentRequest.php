<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class InventoryAdjustmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'delta' => ['required', 'integer', 'between:-100000,100000'],
            'low_stock_threshold' => ['sometimes', 'integer', 'min:0', 'max:100000'],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
