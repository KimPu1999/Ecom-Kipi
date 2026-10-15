# Financial reconciliation test report

Required invariants:

- Idempotent checkout creates one parent order and no duplicate provider charge.
- Captured payment amount/currency equals the parent order amount/currency.
- Parent seller-order subtotals equal eligible seller item lines.
- Commission snapshots equal configured rule inputs at order time.
- Seller ledger sum equals eligible earnings less commission, refunds, and completed payouts.
- Refund allocations never exceed captured/refundable amounts.
- Payout requests never exceed available seller balance and are never locally marked paid.

Marketplace feature tests currently verify approved store visibility, seller isolation, split order creation, and commission snapshots. Provider settlement, refund allocation, payout transfer, and reconciliation require a configured sandbox provider and are release blockers while unavailable.
