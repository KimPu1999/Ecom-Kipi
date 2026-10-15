<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Throwable;

final class HealthController extends Controller
{
    public function health()
    {
        return ApiResponse::success([
            'service' => 'kipi-ecommerce-api',
            'status' => 'healthy',
        ], 'API is running');
    }

    public function ready()
    {
        $checks = [
            'database' => false,
            'redis' => false,
        ];

        try {
            DB::select('select 1');
            $checks['database'] = true;
        } catch (Throwable) {
            // Readiness intentionally returns a safe summary only.
        }

        try {
            Redis::connection()->ping();
            $checks['redis'] = true;
        } catch (Throwable) {
            // Readiness intentionally returns a safe summary only.
        }

        $ready = ! in_array(false, $checks, true);

        return ApiResponse::success([
            'service' => 'kipi-ecommerce-api',
            'status' => $ready ? 'ready' : 'not_ready',
            'checks' => $checks,
        ], $ready ? 'Dependencies are ready' : 'Dependencies are not ready', $ready ? 200 : 503);
    }
}
