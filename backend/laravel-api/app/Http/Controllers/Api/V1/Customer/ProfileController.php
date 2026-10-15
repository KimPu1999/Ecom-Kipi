<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AddressRequest;
use App\Http\Requests\Api\V1\ProfileUpdateRequest;
use App\Http\Resources\AddressResource;
use App\Http\Resources\UserResource;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function show(Request $request)
    {
        return ApiResponse::success(new UserResource($request->user()->load('roles')), 'Profile retrieved');
    }

    public function update(ProfileUpdateRequest $request)
    {
        $data = $request->validated();
        $request->user()->update($data);

        return ApiResponse::success(new UserResource($request->user()->fresh('roles')), 'Profile updated');
    }

    public function addresses(Request $request)
    {
        return ApiResponse::success(AddressResource::collection($request->user()->addresses()->latest()->get()), 'Addresses retrieved');
    }

    public function storeAddress(AddressRequest $request)
    {
        $user = $request->user();
        $data = $request->validated();
        if (($data['is_default'] ?? false) || ! $user->addresses()->exists()) {
            $user->addresses()->update(['is_default' => false]);
            $data['is_default'] = true;
        }
        $address = $user->addresses()->create($data);

        return ApiResponse::success(new AddressResource($address), 'Address created', 201);
    }

    public function updateAddress(AddressRequest $request, int $id)
    {
        $address = $request->user()->addresses()->findOrFail($id);
        $data = $request->validated();
        if (($data['is_default'] ?? false)) {
            $request->user()->addresses()->update(['is_default' => false]);
        }
        $address->update($data);

        return ApiResponse::success(new AddressResource($address->fresh()), 'Address updated');
    }

    public function destroyAddress(Request $request, int $id)
    {
        $address = $request->user()->addresses()->findOrFail($id);
        $wasDefault = $address->is_default;
        $address->delete();
        if ($wasDefault) {
            $request->user()->addresses()->latest()->first()?->update(['is_default' => true]);
        }

        return ApiResponse::success(null, 'Address deleted', 204);
    }
}
