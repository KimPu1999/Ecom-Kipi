<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class ShipmentStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['status' => ['required', 'in:pending,preparing,shipped,in_transit,out_for_delivery,delivered,failed_delivery,returned'], 'message' => ['nullable', 'string', 'max:500'], 'location' => ['nullable', 'string', 'max:120']];
    }
}
