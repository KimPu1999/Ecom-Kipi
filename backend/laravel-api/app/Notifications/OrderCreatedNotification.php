<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Notifications\Notification;

class OrderCreatedNotification extends Notification
{
    public function __construct(private readonly Order $order) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return ['event' => 'order_created', 'title' => 'Order received', 'body' => "Your order {$this->order->order_number} is awaiting payment.", 'order_id' => $this->order->id];
    }
}
