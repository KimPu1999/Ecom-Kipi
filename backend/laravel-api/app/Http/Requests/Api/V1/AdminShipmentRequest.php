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
            'carrier' => ['nullable', 'string', 'max:80'],
            'tracking_number' => ['nullable', 'string', 'max:120'],
            'shipping_method_id' => ['nullable', 'integer', 'exists:shipping_methods,id'],
        ];
    }
}
