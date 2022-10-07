#!/bin/sh
set -e

echo "Starting toda inventrory server..."
su -c "toda serve --inv 3000 &" toda
