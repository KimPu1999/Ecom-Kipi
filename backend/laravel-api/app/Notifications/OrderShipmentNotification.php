<?php

namespace App\Notifications;

use App\Models\Order;
use App\Models\Shipment;
use Illuminate\Notifications\Notification;

class OrderShipmentNotification extends Notification
{
    public function __construct(private readonly Order $order, private readonly Shipment $shipment) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return ['event' => 'shipment_updated', 'title' => 'Shipment updated', 'body' => "Order {$this->order->order_number} is now {$this->shipment->status}.", 'order_id' => $this->order->id, 'shipment_id' => $this->shipment->id];
    }
}
