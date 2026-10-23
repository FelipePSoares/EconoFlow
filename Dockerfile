# ─────────────────────────────────────────────────────────────────────────────
# EconoFlow — single container running both the ASP.NET Core API and the
# Angular SPA (the Angular http layer talks to the API over relative /api/...
# URLs on the same origin, and the esproj copies the browser build into
# wwwroot served by UseDefaultFiles/UseStaticFiles).
#
# Registry: gitea.fpssoftware.uk/fps-software/econoflow
# ─────────────────────────────────────────────────────────────────────────────

# ── Build stage ──────────────────────────────────────────────────────────────
# The .NET 10 SDK image does NOT bundle Node.js, but the easyfinance.client
# esproj needs npm + the Angular CLI (npm install + ng build ->
# dist/easyfinance.client/browser -> published into wwwroot), so we install
# Node.js (LTS v22, matching the CI node-version) into the SDK stage.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Node.js LTS binary (matches the node-version '22.x' used in CI).
ARG NODE_MAJOR=22
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && npm --version && node --version

# A platform runtime identifier is required: the web project's csproj pins
# RuntimeIdentifiers to win-x64;win-x86 at build time, but we produce a Linux
# image, so add linux-x64 on the command line.
ARG RUNTIME_ID=linux-x64

# Credentials for the private Gitea NuGet feed (fpssoftware.chassis). They are
# passed in from the docker-publish workflow and never baked into the image.
ARG GITEA_NUGET_USERNAME
ARG GITEA_NUGET_TOKEN

# Register the private feed with the supplied credentials; the same
# nuget.config convention (%VAR% indirection) is used by the CI restores.
RUN dotnet nuget add source "https://gitea.fpssoftware.uk/api/packages/fps-software/nuget/index.json" \
        --name fps-software \
        --username "${GITEA_NUGET_USERNAME}" \
        --password "${GITEA_NUGET_TOKEN}" \
        --store-password-in-clear-text

# Restore using the project file(s) first for better layer caching.
COPY EasyFinance.Server/EasyFinance.Server.csproj EasyFinance.Server/
COPY EasyFinance.Application/EasyFinance.Application.csproj EasyFinance.Application/
COPY EasyFinance.Domain/EasyFinance.Domain.csproj EasyFinance.Domain/
COPY EasyFinance.Infrastructure/EasyFinance.Infrastructure.csproj EasyFinance.Infrastructure/
COPY EasyFinance.Persistence/EasyFinance.Persistence.csproj EasyFinance.Persistence/
# The PostgreSQL migration set. Referenced by the data-migration host below.
COPY EasyFinance.Persistence.Postgres/EasyFinance.Persistence.Postgres.csproj EasyFinance.Persistence.Postgres/
# The data-migration host. Ships in this image (see the runtime stage) so the
# cutover has no second image that can drift from the code reading that schema.
COPY tools/EconoFlow.DataMigration/EconoFlow.DataMigration.csproj tools/EconoFlow.DataMigration/
COPY easyfinance.client/easyfinance.client.esproj easyfinance.client/
# Both MSBuild files must be present before the restore: Directory.Build.props sets
# TreatWarningsAsErrors, and Directory.Build.targets carries the transitive NuGet
# vulnerability pins. Omitting the .targets file makes the container restore fail with
# NU1903/NU1902 on packages the CI build has already pinned.
COPY Directory.Build.props Directory.Build.targets global.json ./

# Restore without the SPA project (it has no target framework and would break
# a solution-level restore); the web project restores its own references.
# The runtime identifier is required so the restore produces assets for the
# linux-x64 publish (the csproj itself only lists win-x64;win-x86).
RUN dotnet restore EasyFinance.Server/EasyFinance.Server.csproj -r "$RUNTIME_ID"

# Restore the migrator separately. It is deliberately NOT restored as part of the
# line above: the tool depends on fpssoftware.datamigration, and keeping its
# restore distinct means a failure here names the tool rather than the web app.
RUN dotnet restore tools/EconoFlow.DataMigration/EconoFlow.DataMigration.csproj -r "$RUNTIME_ID"

# Copy the rest of the sources needed for the build.
COPY EasyFinance.Application/ EasyFinance.Application/
COPY EasyFinance.Domain/ EasyFinance.Domain/
COPY EasyFinance.Infrastructure/ EasyFinance.Infrastructure/
COPY EasyFinance.Persistence/ EasyFinance.Persistence/
COPY EasyFinance.Persistence.Postgres/ EasyFinance.Persistence.Postgres/
COPY EasyFinance.Server/ EasyFinance.Server/
COPY tools/EconoFlow.DataMigration/ tools/EconoFlow.DataMigration/

# Copy the Angular SPA manifests and install its dependencies first so the
# very large node_modules layer is cached independently of source changes.
WORKDIR /src/easyfinance.client
COPY easyfinance.client/package.json easyfinance.client/package-lock.json easyfinance.client/scripts/ ./
RUN npm ci
WORKDIR /src
# Copy remaining client sources AFTER npm install so dependency layers cache.
COPY easyfinance.client/ easyfinance.client/

# Publish the web project. IncludeSpaProject turns on the SPA build (the
# esproj), which runs `npm install`/`ng build` (the prebuild sitemap/llms
# generation is offline) and publishes the browser bundle into wwwroot.
# --no-restore reuses the restore done above; non-self-contained (framework
# dependent) matches the aspnet runtime stage.
RUN dotnet publish EasyFinance.Server/EasyFinance.Server.csproj \
    -c Release \
    -r "$RUNTIME_ID" \
    --self-contained false \
    --no-restore \
    -p:IncludeSpaProject=true

# Publish the data-migration host to a separate directory. It is a distinct
# executable, not part of the app, so it must not land in wwwroot or beside the
# web entry point.
#
# It publishes into THIS image rather than a second one on purpose
# (MIGRATION_TEMPLATE.md section 7): a separate migrator image is a second
# revision that can drift from the code reading that schema. Shipping it here
# also solves a trap that is invisible at build time - the tool references the
# persistence project, which transitively pulls in Microsoft.AspNetCore.Identity,
# so it needs the Microsoft.AspNetCore.App shared framework. A
# mcr.microsoft.com/dotnet/runtime image does NOT contain it: the build succeeds
# and the container dies at start-up. This stage is already `aspnet`, so the
# problem cannot arise.
RUN dotnet publish tools/EconoFlow.DataMigration/EconoFlow.DataMigration.csproj \
    -c Release \
    -r "$RUNTIME_ID" \
    --self-contained false \
    --no-restore \
    -o /migrator

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Listen on plain HTTP on 8080. TLS is terminated upstream (Traefik ingress);
# the app's Hsts()/HttpsRedirection(HttpsPort=443) middleware still emits the
# redirect/headers correctly because it sees the forwarded scheme.
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    TZ=UTC

# Attachments default to the FileSystem provider writing under the app base
# directory — mount a volume here to persist them across restarts.
VOLUME ["/app/attachments"]

COPY --from=build /src/EasyFinance.Server/bin/Release/net10.0/linux-x64/publish/ ./

# The data-migration host. The cutover Job and the initContainer run:
#   dotnet /app/migrator/EconoFlow.DataMigration.dll --migrate
# It lives inside the application image so there is exactly one revision to
# deploy, and it needs the aspnet shared framework - which this stage provides.
COPY --from=build /migrator/ ./migrator/

# Run as a non-root user for production hardening.
USER 1654
EXPOSE 8080

ENTRYPOINT ["dotnet", "EasyFinance.Server.dll"]
