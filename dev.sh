#!/bin/sh
set -eu

cd "$(dirname "$0")"

vp build
docker build -t komreg-frontend-local .
exec docker run --rm -p 8080:8080 komreg-frontend-local
