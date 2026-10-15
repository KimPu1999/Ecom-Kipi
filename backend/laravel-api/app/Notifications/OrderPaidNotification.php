<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class OrderPaidNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly Order $order) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toArray(object $notifiable): array
    {
        return ['event' => 'payment_confirmed', 'title' => 'Payment confirmed', 'body' => "Payment for {$this->order->order_number} has been verified.", 'order_id' => $this->order->id];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("Payment confirmed for {$this->order->order_number}")
            ->greeting("Thanks for your order, {$notifiable->name}.")
            ->line("Your payment for order {$this->order->order_number} has been verified.")
            ->line("Total: {$this->order->grand_total_minor} {$this->order->currency}")
            ->action('View order', config('app.frontend_url', config('app.url')).'/account/orders/'.$this->order->id);
    }
}
