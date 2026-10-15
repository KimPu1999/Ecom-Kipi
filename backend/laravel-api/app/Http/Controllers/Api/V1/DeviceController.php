<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\PushTokenRequest;
use App\Models\PushToken;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class DeviceController extends Controller
{
    public function store(PushTokenRequest $request)
    {
        $data = $request->validated();
        PushToken::query()->updateOrCreate(['token' => $data['token']], ['user_id' => $request->user()->id, 'platform' => $data['platform'], 'last_used_at' => now()]);

        return ApiResponse::success(null, 'Push token registered');
    }

    public function destroy(Request $request)
    {
        $query = $request->user()->pushTokens();
        if ($request->filled('token')) {
            $query->where('token', $request->string('token')->toString());
        }
        $query->delete();

        return ApiResponse::success(null, 'Push token removed');
    }
}
