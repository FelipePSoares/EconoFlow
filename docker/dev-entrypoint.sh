#!/bin/sh
# EconoFlow Cypress stack entrypoint: the API and nginx behind one front door (plus a second
# one for the API on its own).
#
# Same shape as the release image's entrypoint (docker/entrypoint.sh), with one difference:
# nginx listens on the port the Cypress suite visits. The Angular client calls the API with
# bare /api URLs and relies on sharing an origin with it, so nginx - not the Angular dev
# server - has to be that origin for this stack. 4200 is the port `ng serve` already uses,
# so no spec needs a stack-specific URL.
#
# A second server block answers on the API port (7003, the port `dotnet run` uses), so
# `curl`, `cy.request` and any other tool can talk to the API directly without going through
# the SPA origin.
#
# Started by tini, which is PID 1: stopping the container stops both processes instead of
# leaving one orphaned, and the exit of either stops the other.
set -eu

SPA_PORT="${ECONOFLOW_NGINX_PORT:-4200}"
API_PORT="${ECONOFLOW_API_PORT:-7003}"
# Kestrel's port. It must differ from both nginx listen ports: these three are sockets in
# one container, and any two sharing a value means the second bind fails and the stack
# never comes up.
API_UPSTREAM_PORT="${ECONOFLOW_API_UPSTREAM_PORT:-8081}"

API_PID=
NGINX_PID=

stop_all() {
    [ -n "${API_PID}" ] && kill -TERM "${API_PID}" 2>/dev/null || true
    [ -n "${NGINX_PID}" ] && kill -TERM "${NGINX_PID}" 2>/dev/null || true
    wait "${API_PID}" 2>/dev/null || true
    wait "${NGINX_PID}" 2>/dev/null || true
}

trap 'stop_all; exit 143' TERM INT

# An override can make two of the three ports equal. Check it here, where the cause is
# still visible: the failure itself surfaces as "address already in use" from whichever
# process lost the bind, which points at a port and not at these variables.
if [ "${SPA_PORT}" = "${API_PORT}" ] \
    || [ "${SPA_PORT}" = "${API_UPSTREAM_PORT}" ] \
    || [ "${API_PORT}" = "${API_UPSTREAM_PORT}" ]; then
    echo "econoflow-entrypoint-dev: the SPA (${SPA_PORT}), API (${API_PORT}) and upstream" >&2
    echo "econoflow-entrypoint-dev: (${API_UPSTREAM_PORT}) ports must all differ; they run" >&2
    echo "econoflow-entrypoint-dev: in one container and each needs its own socket." >&2
    exit 1
fi

# nginx -g uses "daemon off" so it stays in the foreground under tini, where its exit status
# is observable. The listen ports and the API upstream come from the environment at start-up.
cat > /tmp/econoflow-site.conf <<EOF
upstream econoflow_api {
    server 127.0.0.1:${API_UPSTREAM_PORT};
    keepalive 32;
}

# The image's user cannot write nginx's default temp paths (/var/lib/nginx/...), and nginx
# creates the body directory before any server block applies its own. Declaring them here,
# at the http level this file is included from, keeps every temp file under /tmp.
client_body_temp_path /tmp/client_body;
proxy_temp_path /tmp/proxy;
fastcgi_temp_path /tmp/fastcgi;
uwsgi_temp_path /tmp/uwsgi;
scgi_temp_path /tmp/scgi;

# The SPA and the API share this origin: the browser calls /api here, nginx forwards it on
# to Kestrel. This is the origin the Cypress suite visits.
server {
    listen ${SPA_PORT} default_server;
    server_name _;

    gzip_static on;
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    root /usr/share/nginx/html;
    index index.html;

    location = /api/health/live {
        proxy_pass http://econoflow_api/api/health/live;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
        access_log off;
    }

    location /api/ {
        proxy_pass http://econoflow_api/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header Connection "";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        client_max_body_size 100m;
    }

    # The stack serves a bundle that changes on every rebuild, so nothing here may pin the
    # browser to a previous one: the shell and the service-worker files are always
    # revalidated.
    location = /index.html {
        add_header Cache-Control "no-store";
        try_files \$uri =404;
    }

    location = /ngsw-worker.js {
        add_header Cache-Control "no-store";
        try_files \$uri =404;
    }

    location = /ngsw.json {
        add_header Cache-Control "no-store";
        try_files \$uri =404;
    }

    location = /service-worker.js {
        add_header Cache-Control "no-store";
        try_files \$uri =404;
    }

    location ~* \.(js|css|woff2?|png|jpg|jpeg|svg|ico|webp|webmanifest)\$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        try_files \$uri =404;
    }

    # An Angular route has no file of its own: serve the shell and let the router decide.
    location / {
        try_files \$uri \$uri/index.html /index.html;
    }
}

# The API on its own port, for tools that do not need the SPA.
server {
    listen ${API_PORT};

    location / {
        proxy_pass http://econoflow_api;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header Connection "";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        client_max_body_size 100m;
    }
}
EOF

cd /app/api
ASPNETCORE_URLS="http://127.0.0.1:${API_UPSTREAM_PORT}" dotnet EasyFinance.Server.dll &
API_PID=$!

nginx -c /usr/share/nginx/econoflow-main.conf -g "daemon off;" &
NGINX_PID=$!

for pid in "${API_PID}" "${NGINX_PID}"; do
    set +e
    wait "${pid}"
    STATUS=$?
    set -e

    echo "econoflow-entrypoint-dev: process ${pid} exited with status ${STATUS}" >&2

    stop_all
    exit "${STATUS}"
done
