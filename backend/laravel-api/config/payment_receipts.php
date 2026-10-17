<?php

return [
    'disk' => env('PAYMENT_RECEIPTS_DISK', 'local'),
    'max_file_size_kb' => (int) env('PAYMENT_RECEIPT_MAX_FILE_SIZE_KB', 5120),
    'providers' => [
        'kbzpay' => [
            'label' => 'KBZPay',
            'recipient_name' => env('KBZPAY_RECIPIENT_NAME', 'Thawng Kim Piang'),
            'recipient_phone' => env('KBZPAY_RECIPIENT_PHONE', '09428981899'),
            'qr_url' => env('KBZPAY_QR_URL'),
        ],
        'ayapay' => [
            'label' => 'AYA Pay',
            'recipient_name' => env('AYAPAY_RECIPIENT_NAME', 'Thawng Kim Piang'),
            'recipient_phone' => env('AYAPAY_RECIPIENT_PHONE', '09428981899'),
            'qr_url' => env('AYAPAY_QR_URL'),
        ],
        'wavepay' => [
            'label' => 'WavePay',
            'recipient_name' => env('WAVEPAY_RECIPIENT_NAME', 'Thawng Kim Piang'),
            'recipient_phone' => env('WAVEPAY_RECIPIENT_PHONE', '09428981899'),
            'qr_url' => env('WAVEPAY_QR_URL'),
        ],
    ],
];
