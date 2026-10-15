<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\PaymentService;
use Illuminate\Http\Request;
use InvalidArgumentException;

class WebhookController extends Controller
{
    public function payment(Request $request, string $provider, PaymentService $payments)
    {
        try {
            $payments->handleWebhook($provider, $request->getContent(), (string) $request->header('Stripe-Signature'));
        } catch (InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 400);
        }

        return response()->json(['received' => true]);
    }
}
