FROM php:7.4-apache

RUN a2enmod rewrite
# AMFPHPモック（DbManagerTInetUserAuth.php）がSQLiteを使うため
RUN apt-get update && apt-get install -y libsqlite3-dev && rm -rf /var/lib/apt/lists/*
RUN docker-php-ext-install pdo_sqlite

COPY ./api /var/www/html/api
COPY ./webService /var/www/html/webService

RUN mkdir -p /var/www/html/uploads /var/www/html/data \
    && chown -R www-data:www-data /var/www/html/uploads /var/www/html/data

EXPOSE 80
