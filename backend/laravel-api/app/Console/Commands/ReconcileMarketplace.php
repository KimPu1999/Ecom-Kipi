<?php

namespace App\Console\Commands;

use App\Models\SellerLedgerEntry;
use App\Models\SellerOrder;
use Illuminate\Console\Command;

class ReconcileMarketplace extends Command
{
    protected $signature = 'commerce:reconcile-marketplace {--json : Emit machine-readable output}';

    protected $description = 'Check seller-order, commission, and ledger invariants without mutating financial history';

    public function handle(): int
    {
        $checked = 0;
        $exceptions = [];
        SellerOrder::query()->with(['items', 'commissions'])->each(function (SellerOrder $order) use (&$checked, &$exceptions) {
            $checked++;
            $itemTotal = (int) $order->items->sum('line_total_minor');
            $commissionTotal = (int) $order->commissions->sum('commission_minor');
            if ($itemTotal !== (int) $order->subtotal_minor || $commissionTotal !== (int) $order->commission_minor || $order->net_minor !== $order->subtotal_minor - $order->commission_minor) {
                $exceptions[] = ['seller_order_id' => $order->id, 'reason' => 'seller_order_allocation_mismatch', 'item_total' => $itemTotal, 'subtotal' => $order->subtotal_minor, 'commission_total' => $commissionTotal, 'commission' => $order->commission_minor, 'net' => $order->net_minor];

                return;
            }
            if ($order->payment_status === 'paid') {
                $ledgerTotal = (int) SellerLedgerEntry::query()->where('seller_order_id', $order->id)->sum('amount_minor');
                if ($ledgerTotal !== (int) $order->net_minor) {
                    $exceptions[] = ['seller_order_id' => $order->id, 'reason' => 'ledger_balance_mismatch', 'ledger_total' => $ledgerTotal, 'expected_net' => $order->net_minor];
                }
            }
        });
        $payload = ['checked_seller_orders' => $checked, 'exception_count' => count($exceptions), 'exceptions' => $exceptions];
        if ($this->option('json')) {
            $this->line(json_encode($payload, JSON_THROW_ON_ERROR));
        } else {
            $this->table(['Metric', 'Value'], [['Checked seller orders', $checked], ['Exceptions', count($exceptions)]]);
            foreach ($exceptions as $exception) {
                $this->error('Seller order '.$exception['seller_order_id'].': '.$exception['reason']);
            }
        }

        return $exceptions === [] ? self::SUCCESS : self::FAILURE;
    }
}
