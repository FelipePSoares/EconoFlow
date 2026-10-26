# EconoFlow — the deployed application image.
#
# One process: the ASP.NET Core server. It serves the Angular SPA from its own wwwroot and
# answers the API on the same port, which is what the application already did (`dotnet run`
# serves both), so nothing else has to sit in front of it.
#
# This used to be an nginx + Kestrel pair under an entrypoint that wrote the nginx site from
# the environment at start-up. None of that was load-bearing:
#
#   * The Angular client calls the API with bare /api URLs on its own origin, and both halves
#     are served by the same server, so the shared origin comes for free.
#   * TLS is terminated by the cluster ingress (Traefik), which sets X-Forwarded-Proto; the
#     application honours it through UseForwardedHeaders. nginx only forwarded a hop that no
#     longer exists.
#   * The entrypoint's real job was hiding port 8081 from the outside and restarting the pair
#     when either died. A single process needs neither.
#
# ── Stage: client ──────────────────────────────────────────────────────────────
# The .NET SDK image does NOT bundle Node.js, but the Angular build needs npm + the Angular
# CLI, so Node.js (LTS 22, matching the CI node-version) is installed here.
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

# The browser pipeline, not the SSR/prerender one: the prerendered pages carry serialized
# state that renders an empty app, and nothing here needs server-side rendering.
RUN npx ng build --configuration production

# ── Stage: api ─────────────────────────────────────────────────────────────────
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

# ── Stage: runtime ─────────────────────────────────────────────────────────────
# The `-extra` variant of the Alpine runtime-deps image is the one that carries ICU and the
# time-zone database. The plain `alpine` tag has neither and sets
# DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=true, which makes the first TimeZoneInfo lookup throw.
# The application formats dates for the user's culture and derives "today" from the clock, so
# it needs the extra variant - not just a smaller base image than the Debian one.
#
# (The Server project sets InvariantGlobalization/InvariantTimezone to false. That property
# wins over the base image's variable; the variant is what makes the switch actually work.)
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine-extra AS runtime
WORKDIR /app

# The SPA lives in the web root the application already serves: Program.cs calls
# UseDefaultFiles()/UseStaticFiles(), which resolve from here.
COPY --from=client /src/easyfinance.client/dist/easyfinance.client/browser/ /app/wwwroot/
COPY --from=api /src/EasyFinance.Server/bin/Release/net10.0/linux-x64/publish/ /app/

# The JIT wants a writable temporary directory even when nothing in the code asks for one.
RUN mkdir -p /app/attachments /app/tmp \
    && chown -R "$APP_UID" /app /app/attachments /app/tmp

# Attachments default to the FileSystem provider writing under the app base directory.
# Mount a volume here to keep uploads across restarts.
VOLUME ["/app/attachments"]

ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=8080 \
    TMPDIR=/app/tmp \
    TZ=UTC

# Non-root: the published application belongs to the user the base image already declares
# and container runtimes map by default.
USER $APP_UID

EXPOSE 8080

# One probe, two facts: the API answers, and the SPA shell was actually shipped. A Kestrel
# that started without wwwroot would pass an API-only check, and the container would look
# healthy while every page 404s. BusyBox wget is in the base image, so this adds no package.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD ["/bin/sh", "-c", "wget -q -O /dev/null http://127.0.0.1:8080/api/health/live && wget -q -O /dev/null http://127.0.0.1:8080/index.html || exit 1"]

ENTRYPOINT ["dotnet", "EasyFinance.Server.dll"]
