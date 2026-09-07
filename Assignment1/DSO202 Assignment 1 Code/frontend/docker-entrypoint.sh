#!/bin/sh
set -eu

# BACKEND_URL is supplied by the ConfigMap at Pod start. Static assets can't
# read env vars at request time, so it gets substituted into config.js once,
# right here, before nginx ever serves a request.
: "${BACKEND_URL:=http://localhost:8080}"

envsubst '${BACKEND_URL}' \
  < /usr/share/nginx/html/config.js.template \
  > /usr/share/nginx/html/config.js

exec nginx -g 'daemon off;'
