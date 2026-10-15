<?php

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

app(Schedule::class)->command('commerce:expire-reservations')->everyFiveMinutes()->withoutOverlapping();
app(Schedule::class)->command('commerce:reconcile-payments')->hourly()->withoutOverlapping();
