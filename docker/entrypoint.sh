#!/bin/sh
# EconoFlow container entrypoint: the API and nginx behind one front door.
#
# Started by tini, which is PID 1: stopping the container then stops both processes
# (tini forwards the signal to the whole process group) instead of leaving one orphaned.
#
# If either service exits, the other is stopped and its exit code is propagated - a
# container that keeps running with its web server dead would answer the SPA on a stale
# process, or answer nothing at all while still looking healthy.
set -eu

# nginx is the container's entry point on this port. The API is bound to the loopback
# interface so it is never reachable from outside the container.
NGINX_PORT="${ECONOFLOW_NGINX_PORT:-8080}"
API_PORT="${ECONOFLOW_API_PORT:-8080}"

API_PID=
NGINX_PID=

stop_all() {
    [ -n "${API_PID}" ] && kill -TERM "${API_PID}" 2>/dev/null || true
    [ -n "${NGINX_PID}" ] && kill -TERM "${NGINX_PID}" 2>/dev/null || true
    wait "${API_PID}" 2>/dev/null || true
    wait "${NGINX_PID}" 2>/dev/null || true
}

trap 'stop_all; exit 143' TERM INT

# nginx -g uses "daemon off" so it stays in the foreground under tini, where its exit status
# is observable. The listen port and the API upstream come from the environment at start-up.
cat > /tmp/econoflow-site.conf <<EOF
upstream econoflow_api {
    server 127.0.0.1:${API_PORT};
    keepalive 32;
}

server {
    listen ${NGINX_PORT} default_server;
    server_name _;

    client_body_temp_path /tmp/client_body;
    proxy_temp_path /tmp/proxy;
    fastcgi_temp_path /tmp/fastcgi;
    uwsgi_temp_path /tmp/uwsgi;
    scgi_temp_path /tmp/scgi;

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

    location ~* \.(js|css|woff2?|png|jpg|jpeg|svg|ico|webp|webmanifest)\$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        try_files \$uri =404;
    }

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

    location / {
        try_files \$uri \$uri/index.html /index.html;
    }
}
EOF

cd /app/api
ASPNETCORE_URLS="http://127.0.0.1:${API_PORT}" dotnet EasyFinance.Server.dll &
API_PID=$!

nginx -c /usr/share/nginx/econoflow-main.conf -g "daemon off;" &
NGINX_PID=$!

for pid in "${API_PID}" "${NGINX_PID}"; do
    set +e
    wait "${pid}"
    STATUS=$?
    set -e

    echo "econoflow-entrypoint: process ${pid} exited with status ${STATUS}" >&2

    stop_all
    exit "${STATUS}"
done
