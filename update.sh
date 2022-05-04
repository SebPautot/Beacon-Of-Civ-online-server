#! /bin/bash

cd

cd /var/www/kenbot

sudo git pull --force --allow-unrelated-histories

npm install

pm2 restart recruits