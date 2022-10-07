#!/bin/sh
set -e

./rm_if_exists.sh toda_inventory_js

docker run --name toda_inventory_js -it -p 8080:8080 toda/inventory-js:$(git rev-parse HEAD)
