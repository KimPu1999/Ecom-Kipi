<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class OrderStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'in:pending,confirmed,processing,shipped,delivered,cancelled'],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
