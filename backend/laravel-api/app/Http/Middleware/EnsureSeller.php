<?php

namespace App\Http\Middleware;

use App\Services\SellerAccessService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSeller
{
    public function __construct(private readonly SellerAccessService $access) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()) {
            abort(401);
        }

        $request->attributes->set('seller', $this->access->sellerFor($request->user()));

        return $next($request);
    }
}
