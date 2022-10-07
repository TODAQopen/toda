#!/bin/sh

docker build -t toda/inventory-js:$(git rev-parse HEAD) .
