#! /bin/bash

cd

cd /var/www/Beacon-Of-Civ-online-server

sudo git pull --force --allow-unrelated-histories

npm install

pm2 start recruits