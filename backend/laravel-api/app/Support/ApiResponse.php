<?php

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;

final class ApiResponse
{
    public static function success(mixed $data = null, string $message = 'Success', int $status = 200, array $meta = []): JsonResponse
    {
        $payload = ['success' => true, 'message' => $message, 'data' => $data];

        if ($meta !== []) {
            $payload['meta'] = $meta;
        }

        return response()->json($payload, $status);
    }

    public static function paginated(LengthAwarePaginator $paginator, mixed $data, string $message): JsonResponse
    {
        return self::success($data, $message, 200, [
            'current_page' => $paginator->currentPage(),
            'per_page' => $paginator->perPage(),
            'last_page' => $paginator->lastPage(),
            'total' => $paginator->total(),
        ]);
    }

    public static function error(string $message, int $status, array $errors = []): JsonResponse
    {
        $payload = ['success' => false, 'message' => $message];

        if ($errors !== []) {
            $payload['errors'] = $errors;
        }

        return response()->json($payload, $status);
    }
}
