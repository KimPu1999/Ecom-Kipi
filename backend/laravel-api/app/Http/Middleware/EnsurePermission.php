<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class EnsurePermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        abort_unless($request->user() && Gate::forUser($request->user())->allows('access-admin') && (Gate::forUser($request->user())->allows('super-admin') || Gate::forUser($request->user())->allows('permission', $permission)), 403, 'Permission denied.');

        return $next($request);
    }
}
