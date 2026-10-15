<?php

return [
    'reservation_minutes' => (int) env('INVENTORY_RESERVATION_MINUTES', 30),
    'tax_rate_bps' => (int) env('TAX_RATE_BPS', 0),
    'stripe_secret' => env('STRIPE_SECRET'),
    'stripe_webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
    'stripe_api_url' => env('STRIPE_API_URL', 'https://api.stripe.com/v1'),
    'webhook_tolerance_seconds' => (int) env('PAYMENT_WEBHOOK_TOLERANCE_SECONDS', 300),
];
