<?php

namespace App\Services;

use App\Models\Inventory;
use App\Models\ProductVariant;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryService
{
    public function adjust(ProductVariant $variant, int $delta, string $type = 'adjustment', ?int $userId = null, ?string $note = null): Inventory
    {
        return DB::transaction(function () use ($variant, $delta, $type, $userId, $note) {
            $inventory = Inventory::query()->firstOrCreate(['product_variant_id' => $variant->id]);
            $inventory = Inventory::query()->whereKey($inventory->id)->lockForUpdate()->firstOrFail();
            $nextQuantity = $inventory->quantity + $delta;

            if ($nextQuantity < $inventory->reserved_quantity) {
                throw ValidationException::withMessages([
                    'quantity' => 'Stock cannot fall below the quantity already reserved.',
                ]);
            }

            $inventory->update(['quantity' => $nextQuantity]);
            $inventory->movements()->create([
                'quantity_delta' => $delta,
                'quantity_after' => $nextQuantity,
                'type' => $type,
                'created_by' => $userId,
                'note' => $note,
            ]);

            return $inventory->fresh('variant');
        });
    }

    public function reserve(ProductVariant $variant, int $quantity, ?int $userId = null): Inventory
    {
        return DB::transaction(function () use ($variant, $quantity, $userId) {
            $inventory = Inventory::query()->firstOrCreate(['product_variant_id' => $variant->id]);
            $inventory = Inventory::query()->whereKey($inventory->id)->lockForUpdate()->firstOrFail();

            if ($inventory->availableQuantity() < $quantity) {
                throw ValidationException::withMessages([
                    'stock' => "Insufficient stock for {$variant->sku}.",
                ]);
            }

            $inventory->increment('reserved_quantity', $quantity);
            $inventory->movements()->create([
                'quantity_delta' => 0,
                'quantity_after' => $inventory->quantity,
                'type' => 'reservation',
                'created_by' => $userId,
                'note' => "Reserved {$quantity} unit(s).",
            ]);

            return $inventory->fresh('variant');
        });
    }

    public function release(ProductVariant $variant, int $quantity, ?int $userId = null): Inventory
    {
        return DB::transaction(function () use ($variant, $quantity, $userId) {
            $inventory = Inventory::query()->where('product_variant_id', $variant->id)->lockForUpdate()->firstOrFail();
            $inventory->decrement('reserved_quantity', min($quantity, $inventory->reserved_quantity));
            $inventory->movements()->create([
                'quantity_delta' => 0,
                'quantity_after' => $inventory->quantity,
                'type' => 'release',
                'created_by' => $userId,
                'note' => "Released {$quantity} reserved unit(s).",
            ]);

            return $inventory->fresh('variant');
        });
    }
}
