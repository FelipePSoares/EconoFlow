# EconoFlow â€” the deployed application image
#
# This is the image the cluster runs: the ASP.NET Core API and the Angular SPA in one
# container, published by .github/workflows/Release.yml.
#
#   API      : an ASP.NET Core runtime. The application applies the EF Core migrations
#              itself at start-up (PersistenceServiceRegistration.UseMigration), so the
#              image needs no migrator executable and no SDK.
#   SPA      : an nginx runtime. easyfinance.client is built for the browser (the
#              production SSR / prerender pipeline emits _nonserializable state that would
#              render every page empty) and nginx serves it, proxying /api to the API.
#
# nginx also terminates the HTTP hop between the two: it forwards X-Forwarded-Proto, which
# the application honours through UseForwardedHeaders, so the SPA and the API share one
# origin (no CORS, no separate cookie domain).
#
# â”€â”€ Stage: client â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# The .NET SDK image does NOT bundle Node.js, but the Angular build needs npm + the
# Angular CLI, so Node.js (LTS 22, matching the CI node-version) is installed here.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS client
WORKDIR /src

ARG NODE_MAJOR=22
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && npm --version && node --version

# Manifests first, so the large node_modules layer is cached independently of source
# changes. `scripts/` carries the sitemap prebuild step.
COPY easyfinance.client/package.json easyfinance.client/package-lock.json easyfinance.client/scripts/ ./easyfinance.client/
WORKDIR /src/easyfinance.client
RUN npm ci

COPY easyfinance.client/ ./

# Angular 22 writes the browser bundle to dist/easyfinance.client/browser.
RUN npx ng build --configuration production

# â”€â”€ Stage: api â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src

# A platform runtime identifier is required: the web project's csproj pins
# RuntimeIdentifiers to win-x64;win-x86 at build time, but this is a Linux image, so
# linux-x64 is added on the command line.
ARG RUNTIME_ID=linux-x64

# Credentials for the private Gitea NuGet feed (fpssoftware.chassis). Passed in from the
# release workflow and never baked into the image.
#
# PROMOTED TO ENV ON PURPOSE: the root nuget.config refers to them as
# %GITEA_NUGET_USERNAME% / %GITEA_NUGET_TOKEN%, and NuGet only expands that indirection
# from the process environment. A build ARG alone is not visible to the restore. This is
# the documented known exposure (the value is visible to anyone who can read the build
# provenance); the hardened alternative is a BuildKit secret, and local builds use one:
#   docker build --secret id=gitea_nuget_token,src=<file-with-token> ...
# When the secret is mounted it takes precedence, so the value never becomes an ENV.
ARG GITEA_NUGET_USERNAME
ARG GITEA_NUGET_TOKEN
ENV GITEA_NUGET_USERNAME=${GITEA_NUGET_USERNAME} \
    GITEA_NUGET_TOKEN=${GITEA_NUGET_TOKEN}

# Both MSBuild files must be present before the restore: Directory.Build.props sets
# TreatWarningsAsErrors, and Directory.Build.targets carries the transitive NuGet
# vulnerability pins. nuget.config is the SAME file CI and local builds use: it declares
# both feeds and the <packageSourceMapping> that keeps public packages off the private
# Gitea feed. Do not replace it with `dotnet nuget add source` - that writes a config with
# no mapping, so the restore asks Gitea for every public package and fails with NU1301.
COPY Directory.Build.props Directory.Build.targets global.json nuget.config ./
COPY EasyFinance.Server/EasyFinance.Server.csproj EasyFinance.Server/
COPY EasyFinance.Application/EasyFinance.Application.csproj EasyFinance.Application/
COPY EasyFinance.Domain/EasyFinance.Domain.csproj EasyFinance.Domain/
COPY EasyFinance.Infrastructure/EasyFinance.Infrastructure.csproj EasyFinance.Infrastructure/
COPY EasyFinance.Persistence/EasyFinance.Persistence.csproj EasyFinance.Persistence/

# The restore needs whichever credentials this build has. Both forms are accepted so the
# same Dockerfile serves CI (build args) and local runs (secret).
RUN --mount=type=secret,id=gitea_nuget_token,required=false \
    set -eu; \
    TOKEN="$(cat /run/secrets/gitea_nuget_token 2>/dev/null || echo "${GITEA_NUGET_TOKEN:-}")"; \
    if [ -z "${TOKEN}" ]; then \
      echo "No Gitea NuGet token: pass --build-arg GITEA_NUGET_TOKEN=... or --secret id=gitea_nuget_token,src=..." >&2; \
      exit 1; \
    fi; \
    GITEA_NUGET_TOKEN="${TOKEN}" dotnet restore EasyFinance.Server/EasyFinance.Server.csproj -r "$RUNTIME_ID"

# The SPA is built by the client stage and never by the esproj here, so IncludeSpaProject
# stays off and the .csproj's esproj reference does not apply.
COPY EasyFinance.Application/ EasyFinance.Application/
COPY EasyFinance.Domain/ EasyFinance.Domain/
COPY EasyFinance.Infrastructure/ EasyFinance.Infrastructure/
COPY EasyFinance.Persistence/ EasyFinance.Persistence/
COPY EasyFinance.Server/ EasyFinance.Server/

RUN dotnet publish EasyFinance.Server/EasyFinance.Server.csproj \
    -c Release \
    -r "$RUNTIME_ID" \
    --self-contained false \
    --no-restore

# â”€â”€ Stage: runtime â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# One image, two services (API and nginx), started by the entrypoint. An init process is
# the container's PID 1 so that stopping it stops both children, and either child exiting
# stops the container and is reported - a container whose nginx died must not keep
# answering health probes from the API alone.
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# The API binds loopback only: nginx is the container's single entry point, on port 8080.
ENV ASPNETCORE_ENVIRONMENT=Production \
    TZ=UTC

# Attachments default to the FileSystem provider writing under the app base directory.
# Mount a volume here to keep uploads across restarts.
VOLUME ["/app/attachments"]

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx tini \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

COPY --from=api /src/EasyFinance.Server/bin/Release/net10.0/linux-x64/publish/ /app/api/
COPY --from=client /src/easyfinance.client/dist/easyfinance.client/browser/ /usr/share/nginx/html/
COPY docker/entrypoint.sh /usr/local/bin/econoflow-entrypoint

# nginx's stock config starts a daemon and writes its pid file where the image user cannot;
# this main config keeps nginx in the foreground (the entrypoint supervises it), sends its
# logs to the container's stdout/stderr, keeps every temp path under /tmp, and includes the
# site the entrypoint renders from its environment at start-up.
RUN mkdir -p /tmp/client_body /tmp/proxy /tmp/fastcgi /tmp/uwsgi /tmp/scgi \
    && chown 1654:1654 /tmp/client_body /tmp/proxy /tmp/fastcgi /tmp/uwsgi /tmp/scgi \
    && printf '%s\n' \
    'worker_processes auto;' \
    'error_log /dev/stderr warn;' \
    'pid /tmp/nginx.pid;' \
    'events { worker_connections 1024; }' \
    'http {' \
    '    include /etc/nginx/mime.types;' \
    '    default_type application/octet-stream;' \
    '    access_log /dev/stdout;' \
    '    sendfile on;' \
    '    include /tmp/econoflow-site.conf;' \
    '}' > /usr/share/nginx/econoflow-main.conf \
    && chmod +x /usr/local/bin/econoflow-entrypoint \
    && chown -R 1654:1654 /app /usr/share/nginx /usr/share/nginx/html

USER 1654
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD ["sh", "-c", "wget -q -O /dev/null http://127.0.0.1:8080/api/health/live || exit 1"]

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/econoflow-entrypoint"]
