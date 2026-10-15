<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Notifications\Notification;

class PaymentConfirmedInAppNotification extends Notification
{
    public function __construct(private readonly Order $order) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return ['event' => 'payment_confirmed', 'title' => 'Payment confirmed', 'body' => "Payment for {$this->order->order_number} has been verified.", 'order_id' => $this->order->id];
    }
}
