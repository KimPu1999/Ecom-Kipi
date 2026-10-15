<?php

namespace App\Http\Controllers\Api\V1\Cart;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CartItemRequest;
use App\Http\Requests\Api\V1\UpdateCartItemRequest;
use App\Http\Resources\CartResource;
use App\Models\CartItem;
use App\Services\CartService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function __construct(private readonly CartService $cart) {}

    public function show(Request $request)
    {
        return ApiResponse::success(new CartResource($this->cart->getForUser($request->user()->id)), 'Cart retrieved');
    }

    public function store(CartItemRequest $request)
    {
        $cart = $this->cart->add($request->user()->id, $request->integer('variant_id'), $request->integer('quantity'));

        return ApiResponse::success(new CartResource($cart), 'Cart item added');
    }

    public function update(UpdateCartItemRequest $request, int $id)
    {
        $item = CartItem::query()->whereHas('cart', fn ($q) => $q->where('user_id', $request->user()->id))->findOrFail($id);

        return ApiResponse::success(new CartResource($this->cart->update($item, $request->integer('quantity'))), 'Cart item updated');
    }

    public function destroy(Request $request, int $id)
    {
        $item = CartItem::query()->whereHas('cart', fn ($q) => $q->where('user_id', $request->user()->id))->findOrFail($id);

        return ApiResponse::success(new CartResource($this->cart->remove($item)), 'Cart item removed');
    }

    public function clear(Request $request)
    {
        return ApiResponse::success(new CartResource($this->cart->clear($this->cart->getForUser($request->user()->id))), 'Cart cleared');
    }
}
