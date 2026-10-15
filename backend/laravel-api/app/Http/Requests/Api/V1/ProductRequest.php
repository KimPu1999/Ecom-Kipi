<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Seller;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'seller_id' => ['nullable', 'integer', Rule::exists('sellers', 'id')],
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', Rule::unique('products', 'slug')->ignore($this->route('product'))],
            'description' => ['nullable', 'string'],
            'status' => ['required', 'in:draft,published,archived'],
            'is_featured' => ['sometimes', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($this->input('status') !== 'published') {
                return;
            }

            $product = $this->route('product');
            $sellerId = $this->input('seller_id', is_object($product) ? $product->seller_id : null);
            if ($sellerId && ! Seller::query()->whereKey($sellerId)->approved()->exists()) {
                $validator->errors()->add('seller_id', 'A published product must belong to an approved seller.');
            }
        });
    }
}
