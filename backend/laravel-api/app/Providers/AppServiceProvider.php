<?php

namespace App\Providers;

use App\Contracts\PaymentGateway;
use App\Models\User;
use App\Services\StripePaymentGateway;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(PaymentGateway::class, StripePaymentGateway::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute((int) env('API_RATE_LIMIT_PER_MINUTE', 60))->by($request->user()?->id ?: $request->ip()));
        Gate::define('access-admin', fn (User $user): bool => $user->hasRole(['admin', 'super_admin']));
        Gate::define('permission', fn (User $user, string $permission): bool => $user->hasPermission($permission));
        Gate::define('super-admin', fn (User $user): bool => $user->hasRole('super_admin'));
    }
}
