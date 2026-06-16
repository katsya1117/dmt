FROM php:7.4-apache

RUN a2enmod rewrite

COPY ./api /var/www/html/api

RUN mkdir -p /var/www/html/uploads \
    && chown -R www-data:www-data /var/www/html/uploads

EXPOSE 80
