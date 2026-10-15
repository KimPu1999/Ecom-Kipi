FROM composer:2 AS dependencies
WORKDIR /var/www/backend
COPY backend/laravel-api/composer.json backend/laravel-api/composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader

FROM php:8.3-cli
RUN apt-get update && apt-get install -y libzip-dev unzip && docker-php-ext-install pdo_mysql
WORKDIR /var/www/backend
COPY --from=dependencies /var/www/backend/vendor ./vendor
COPY backend/laravel-api ./
EXPOSE 8000
