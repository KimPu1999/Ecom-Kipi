<?php

namespace App\Console\Commands;

use App\Services\InventoryReservationService;
use Illuminate\Console\Command;

class ExpireInventoryReservations extends Command
{
    protected $signature = 'commerce:expire-reservations';

    protected $description = 'Release inventory reservations whose checkout window has expired';

    public function handle(InventoryReservationService $reservations): int
    {
        $count = $reservations->expire();
        $this->info("Expired {$count} inventory reservation(s).");

        return self::SUCCESS;
    }
}
