<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ForgotPasswordRequest;
use App\Http\Requests\Api\V1\LoginRequest;
use App\Http\Requests\Api\V1\RegisterRequest;
use App\Http\Requests\Api\V1\ResetPasswordRequest;
use App\Http\Resources\UserResource;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function register(RegisterRequest $request)
    {
        $user = User::query()->create($request->validated());
        $user->roles()->attach(Role::query()->firstOrCreate(['name' => 'customer'], ['label' => 'Customer']));
        $token = $user->createToken($request->input('device_name', 'api-client'))->plainTextToken;
        $this->auditAuth($request, $user, 'admin.login');

        return ApiResponse::success([
            'user' => new UserResource($user->load('roles')),
            'token' => $token,
            'token_type' => 'Bearer',
        ], 'Registration successful', 201);
    }

    public function login(LoginRequest $request)
    {
        $user = User::query()->where('email', $request->email)->with('roles')->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return ApiResponse::error('Invalid credentials.', 401);
        }

        if ($user->status !== 'active') {
            return ApiResponse::error('This account is not active.', 403);
        }

        $token = $user->createToken($request->input('device_name', 'api-client'))->plainTextToken;

        return ApiResponse::success([
            'user' => new UserResource($user),
            'token' => $token,
            'token_type' => 'Bearer',
        ], 'Login successful');
    }

    public function logout(Request $request)
    {
        $this->auditAuth($request, $request->user(), 'admin.logout');
        $request->user()->currentAccessToken()?->delete();

        return ApiResponse::success(null, 'Logout successful');
    }

    public function me(Request $request)
    {
        return ApiResponse::success(new UserResource($request->user()->load('roles')), 'Authenticated user retrieved');
    }

    public function forgotPassword(ForgotPasswordRequest $request)
    {
        Password::sendResetLink($request->only('email'));

        return ApiResponse::success(null, 'If an account matches that email, reset instructions will be sent shortly.');
    }

    public function resetPassword(ResetPasswordRequest $request)
    {
        $data = $request->validated();
        $status = Password::reset($data, function (User $user, string $password) {
            $user->forceFill(['password' => $password])->save();
            $user->tokens()->delete();
        });

        return $status === Password::PASSWORD_RESET
            ? ApiResponse::success(null, __($status))
            : ApiResponse::error(__($status), 422);
    }

    private function auditAuth(Request $request, User $user, string $action): void
    {
        if (! $user->hasRole(['admin', 'super_admin'])) {
            return;
        }

        AuditLog::query()->create([
            'actor_user_id' => $user->id,
            'action' => $action,
            'ip_address' => $request->ip(),
            'request_id' => Str::isUuid($request->header('X-Request-Id', '')) ? $request->header('X-Request-Id') : Str::uuid(),
        ]);
    }
}
