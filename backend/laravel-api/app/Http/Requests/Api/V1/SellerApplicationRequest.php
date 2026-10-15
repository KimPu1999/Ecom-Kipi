<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class SellerApplicationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'business_name' => ['required', 'string', 'max:150'],
            'business_type' => ['nullable', 'string', 'max:80'],
            'business_details' => ['nullable', 'array'],
            'contact_details' => ['nullable', 'array'],
            'documents' => ['sometimes', 'array', 'max:5'],
            'documents.*' => ['file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240'],
            'document_types' => ['sometimes', 'array'],
            'document_types.*' => ['nullable', 'string', 'max:50'],
        ];
    }
}
