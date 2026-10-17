<?php

namespace App\Jobs;

use App\Models\Order;
use App\Models\PushToken;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;

class SendOrderPushNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public Order $order, public string $event, public string $body) {}

    public function handle(): void
    {
        $preference = $this->order->user?->notificationPreferences()->firstOrCreate([]);
        $allowed = match ($this->event) {
            'payment_confirmed', 'payment_failed' => $preference?->payment_updates ?? true,
            'shipped', 'out_for_delivery', 'delivered' => $preference?->delivery_updates ?? true,
            default => $preference?->order_updates ?? true,
        };
        if (! $allowed) {
            return;
        }

        $tokens = $this->order->user?->pushTokens()->pluck('token')->all() ?? [];
        if ($tokens === []) {
            return;
        }

        $messages = array_map(fn (string $token) => [
            'to' => $token,
            'title' => 'THANGPC order update',
            'body' => $this->body,
            'data' => ['order_id' => $this->order->id, 'event' => $this->event],
            'sound' => 'default',
        ], $tokens);
        $response = Http::timeout(10)->post('https://exp.host/--/api/v2/push/send', $messages);
        if ($response->failed()) {
            throw new \RuntimeException('Expo push delivery failed.');
        }

        foreach ((array) $response->json('data', []) as $index => $result) {
            if (($result['details']['error'] ?? null) === 'DeviceNotRegistered') {
                PushToken::query()->where('token', $tokens[$index] ?? '')->delete();
            }
        }
    }
}
