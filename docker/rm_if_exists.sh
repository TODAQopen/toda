#!/bin/sh

set -e

if [ -z $1 ]; then
  echo "Error in ${0}: Must specify container name" 1>&2
  exit 1
fi
_container_id=$(docker ps -a --format '{{.ID}}' --filter "name=$1")

if [ ! -z $_container_id ]; then
  docker rm $_container_id
fi
