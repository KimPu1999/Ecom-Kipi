<?php

return [
    'default_commission_bps' => (int) env('MARKETPLACE_DEFAULT_COMMISSION_BPS', 500),
    'stripe_connect_enabled' => (bool) env('STRIPE_CONNECT_ENABLED', false),
];
