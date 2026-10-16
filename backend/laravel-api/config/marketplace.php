<?php

return [
    'default_commission_bps' => (int) env('MARKETPLACE_DEFAULT_COMMISSION_BPS', 500),
    'stripe_connect_enabled' => (bool) env('STRIPE_CONNECT_ENABLED', false),
    'payout_min_minor' => (int) env('MARKETPLACE_PAYOUT_MIN_MINOR', 1),
    'payout_max_minor' => (int) env('MARKETPLACE_PAYOUT_MAX_MINOR', 0),
];
