#!/bin/sh

# Builds toda.dist.js (npm pkg entrypoint) and toda.web.dist.js (for todaweb)
npm run build

# Builds the web/dist for statically serving todaweb
npm run build-web
