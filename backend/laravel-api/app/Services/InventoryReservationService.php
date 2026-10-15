<?php

namespace App\Services;

use App\Models\InventoryReservation;
use App\Models\Order;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryReservationService
{
    public function reserveOrder(Order $order, array $lines, ?int $userId = null): void
    {
        foreach ($lines as $line) {
            $inventory = DB::table('inventories')->where('product_variant_id', $line['variant_id'])->lockForUpdate()->first();
            if (! $inventory || ($inventory->quantity - $inventory->reserved_quantity) < $line['quantity']) {
                throw ValidationException::withMessages(['stock' => "Insufficient stock for {$line['sku']}."]);
            }
            DB::table('inventories')->where('id', $inventory->id)->update([
                'reserved_quantity' => $inventory->reserved_quantity + $line['quantity'],
                'updated_at' => now(),
            ]);
            $order->reservations()->create([
                'product_variant_id' => $line['variant_id'],
                'inventory_id' => $inventory->id,
                'quantity' => $line['quantity'],
                'status' => 'active',
                'expires_at' => now()->addMinutes(config('commerce.reservation_minutes', 30)),
            ]);
            DB::table('inventory_movements')->insert([
                'inventory_id' => $inventory->id,
                'quantity_delta' => 0,
                'quantity_after' => $inventory->quantity,
                'type' => 'reservation',
                'reference_type' => Order::class,
                'reference_id' => $order->id,
                'created_by' => $userId,
                'note' => "Reserved {$line['quantity']} unit(s).",
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function releaseOrder(Order $order, ?int $userId = null): int
    {
        $released = 0;
        foreach ($order->reservations()->whereIn('status', ['active', 'expired'])->lockForUpdate()->get() as $reservation) {
            $inventory = DB::table('inventories')->where('id', $reservation->inventory_id)->lockForUpdate()->first();
            if ($inventory) {
                $quantity = min($reservation->quantity, $inventory->reserved_quantity);
                DB::table('inventories')->where('id', $inventory->id)->update([
                    'reserved_quantity' => $inventory->reserved_quantity - $quantity,
                    'updated_at' => now(),
                ]);
                DB::table('inventory_movements')->insert([
                    'inventory_id' => $inventory->id,
                    'quantity_delta' => 0,
                    'quantity_after' => $inventory->quantity,
                    'type' => 'release',
                    'reference_type' => Order::class,
                    'reference_id' => $order->id,
                    'created_by' => $userId,
                    'note' => "Released {$quantity} reserved unit(s).",
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $released += $quantity;
            }
            $reservation->update(['status' => 'released', 'released_at' => now()]);
        }

        return $released;
    }

    public function commitOrder(Order $order, ?int $userId = null): void
    {
        foreach ($order->reservations()->where('status', 'active')->lockForUpdate()->get() as $reservation) {
            $inventory = DB::table('inventories')->where('id', $reservation->inventory_id)->lockForUpdate()->firstOrFail();
            if ($inventory->reserved_quantity < $reservation->quantity || $inventory->quantity < $reservation->quantity) {
                throw ValidationException::withMessages(['stock' => 'Reserved stock cannot be committed.']);
            }
            DB::table('inventories')->where('id', $inventory->id)->update([
                'quantity' => $inventory->quantity - $reservation->quantity,
                'reserved_quantity' => $inventory->reserved_quantity - $reservation->quantity,
                'updated_at' => now(),
            ]);
            DB::table('inventory_movements')->insert([
                'inventory_id' => $inventory->id,
                'quantity_delta' => -$reservation->quantity,
                'quantity_after' => $inventory->quantity - $reservation->quantity,
                'type' => 'sale',
                'reference_type' => Order::class,
                'reference_id' => $order->id,
                'created_by' => $userId,
                'note' => "Committed {$reservation->quantity} unit(s).",
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $reservation->update(['status' => 'committed', 'committed_at' => now()]);
        }
    }

    public function expire(): int
    {
        $count = 0;
        InventoryReservation::query()->where('status', 'active')->where('expires_at', '<=', now())->each(function (InventoryReservation $candidate) use (&$count) {
            DB::transaction(function () use ($candidate, &$count) {
                $reservation = InventoryReservation::query()->lockForUpdate()->find($candidate->id);
                if (! $reservation || $reservation->status !== 'active' || $reservation->expires_at?->isFuture()) {
                    return;
                }

                $this->releaseReservation($reservation, null, 'expired');
                $count++;
            });
        });

        return $count;
    }

    private function releaseReservation(InventoryReservation $reservation, ?int $userId, string $status = 'released'): int
    {
        $inventory = DB::table('inventories')->where('id', $reservation->inventory_id)->lockForUpdate()->first();
        $quantity = 0;
        if ($inventory) {
            $quantity = min($reservation->quantity, $inventory->reserved_quantity);
            DB::table('inventories')->where('id', $inventory->id)->update([
                'reserved_quantity' => $inventory->reserved_quantity - $quantity,
                'updated_at' => now(),
            ]);
            DB::table('inventory_movements')->insert([
                'inventory_id' => $inventory->id,
                'quantity_delta' => 0,
                'quantity_after' => $inventory->quantity,
                'type' => 'release',
                'reference_type' => Order::class,
                'reference_id' => $reservation->order_id,
                'created_by' => $userId,
                'note' => "Released {$quantity} reserved unit(s).",
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $reservation->update([
            'status' => $status,
            'released_at' => now(),
        ]);

        return $quantity;
    }
}
