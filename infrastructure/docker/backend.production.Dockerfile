FROM composer:2 AS vendor
WORKDIR /build
COPY backend/laravel-api/composer.json backend/laravel-api/composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-progress --optimize-autoloader

FROM php:8.3-fpm-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libzip-dev libicu-dev libonig-dev unzip \
    && docker-php-ext-install pdo_mysql mbstring intl opcache \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /var/www/backend
COPY --from=vendor /build/vendor ./vendor
COPY backend/laravel-api ./
RUN mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache
COPY infrastructure/docker/php-production.ini /usr/local/etc/php/conf.d/zz-production.ini
EXPOSE 9000
CMD ["php-fpm", "-F"]
