#!/bin/sh
set -e

./rm_if_exists.sh toda_inventory_js

docker run --name toda_inventory_js -it \
  -p 8080:8080 \
  -v `pwd`/..:/home/toda/.npm-packages/lib/node_modules/todajs:ro \
  -v `pwd`/todaconfig.yml:/home/toda/.toda/config:ro \
  -v `pwd`/nginx.conf:/etc/nginx/nginx.conf \
  toda/inventory-js:$(git rev-parse HEAD)
