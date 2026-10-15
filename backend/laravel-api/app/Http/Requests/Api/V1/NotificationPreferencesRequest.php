<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class NotificationPreferencesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['order_updates' => ['sometimes', 'boolean'], 'payment_updates' => ['sometimes', 'boolean'], 'delivery_updates' => ['sometimes', 'boolean']];
    }
}
