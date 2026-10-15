<?php

namespace App\Console\Commands;

use App\Models\Payment;
use App\Services\PaymentService;
use Illuminate\Console\Command;

class ReconcilePayments extends Command
{
    protected $signature = 'commerce:reconcile-payments';

    protected $description = 'Reconcile pending and processing payments with the provider';

    public function handle(PaymentService $payments): int
    {
        $checked = 0;
        Payment::query()
            ->whereIn('status', ['pending', 'processing'])
            ->whereNotNull('provider_payment_id')
            ->each(function (Payment $payment) use ($payments, &$checked) {
                try {
                    $payments->reconcile($payment);
                    $checked++;
                } catch (\Throwable $exception) {
                    $this->warn("Payment {$payment->id} could not be reconciled: {$exception->getMessage()}");
                }
            });

        $this->info("Reconciled {$checked} payment(s).");

        return self::SUCCESS;
    }
}
