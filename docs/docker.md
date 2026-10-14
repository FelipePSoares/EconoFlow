# EconoFlow — Docker container & registry publishing

This describes the production **container image** for EconoFlow: what it
contains, the runtime configuration it needs, and how the GitHub Actions
workflow publishes it to the self-hosted Gitea container registry.

## Image

- **Location:** `gitea.fpssoftware.uk/fps-software/econoflow`
- **Build:** `Dockerfile` at the repository root.
- **Content:** a **single** image runs both the ASP.NET Core API and the
  Angular SPA. The Angular client calls the backend over **relative**
  `/api/...` URLs on the same origin, and the `easyfinance.client` esproj
  publishes the browser build into `wwwroot`, which the server serves via
  `UseDefaultFiles()` / `UseStaticFiles()`.
- **Base images:** `.NET 10 SDK` to build, `.NET 10 ASP.NET Runtime` to run.
- **Platform:** `linux/amd64`, framework-dependent.
- **Port:** listens on plain HTTP **`8080`** (`ASPNETCORE_URLS=http://+:8080`).
  TLS is terminated upstream (e.g. the Traefik ingress); the app's
  `Hsts()` / `HttpsRedirection(HttpsPort=443)` middleware still emit the
  correct redirection / headers because it honours the forwarded scheme.
- **User:** runs as a non-root user (`1654`).
- **HTTP port** is `8080` — `EXPOSE 8080`.

### Building locally

```bash
docker build -t econoflow:test .
```

### Running locally

```bash
docker run --rm -p 8080:8080 \
  -e EasyFinanceDB='Server=...;Database=...;User Id=sa;Password=...;TrustServerCertificate=true' \
  -e EconoFlow_TOKEN_SECRET_KEY='<32+ char secret>' \
  -e EconoFlow_ISSUER='https://econoflow.pt' \
  -e EconoFlow_AUDIENCE='https://econoflow.pt' \
  -e EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN='<secret>' \
  -e SMTP_HOST='smtp.example.com' \
  -e SMTP_USERNAME='<smtp user>' \
  -e SMTP_PASSWORD='<smtp password>' \
  econoflow:test
```

> The container image itself ships **no** configuration values. At startup the
> app **throws** if required production env vars are missing (e.g.
> `SMTP_HOST`, `SMTP_USERNAME`, `SMTP_PASSWORD`,
> `EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN`), so a deployer
> must supply them (SealedSecret / k8s Secret, etc.).

## Runtime environment variables

The server reads its configuration from these environment variables (Release /
production build), in addition to `appsettings.json`:

| Variable | Purpose | Required |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | Defaults to `Production` in the image. | no |
| `EasyFinanceDB` | Database connection string. The provider is inferred from its shape (`Host=` → PostgreSQL, `Server=`/`Data Source=` → SQL Server) unless `Database__Provider` is set explicitly. | **yes** |
| `Database__Provider` | Explicit provider selection: `PostgreSql`, `SqlServer` or `InMemory`. Overrides inference from the connection string. See "Database provider" below. | no |
| `EconoFlow_TOKEN_SECRET_KEY` | JWT signing key (used when not `Development`). | **yes** |
| `EconoFlow_ISSUER` | JWT issuer. | no (falls back to config) |
| `EconoFlow_AUDIENCE` | JWT audience. | no (falls back to config) |
| `EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN` | Secret for account-delete tokens — the controller throws if missing. | **yes** |
| `SMTP_HOST` / `SMTP_USERNAME` / `SMTP_PASSWORD` | Outbound e-mail over SMTP — `Program.cs` throws in non-Development when the SMTP settings are incomplete. | **yes** |
| `SMTP_PORT` / `SMTP_SECURE_SOCKET` | SMTP port (default `587`) and TLS mode: `Auto`, `None`, `StartTls` or `SslOnConnect` (default `Auto`). | no |
| `SMTP_FROM_ADDRESS` / `SMTP_FROM_NAME` | From address/name used for every outbound e-mail (defaults `noreply@econoflow.pt` / `NoReply EconoFlow`). | no |
| `SMTP_TIMEOUT_SECONDS` | Timeout for SMTP connect/authenticate/send, in seconds (default `30`). | no |
| `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` | MinIO/S3 attachment storage (when `AttachmentStorage:Provider` is `Minio`). | when Minio |
| `EconoFlow_TURNSTILE_SECRET_KEY` / `EconoFlow_TURNSTILE_SITE_KEY` | Cloudflare Turnstile. | when used |
| `EconoFlow_EXPO_PUSH_ACCESS_TOKEN` | Expo push notifications. | when used |
| `EconoFlow_KEY_ENCRYPT_ACTIVE` | Enables DPAPI key protection (Windows only — not applicable to the Linux image). | no |

Other sections (`WebPush:PublicKey/PrivateKey`, `Serilog:WriteTo:BetterStack`
`sourceToken`/`betterStackEndpoint`) are configured either via `appsettings.json`
overrides or future env/config substitution by the deployer.

### Persistent volume

The default `AttachmentStorage:Provider` is `FileSystem`, writing under the app
base directory. The image declares `VOLUME ["/app/attachments"]` — mount a
persistent volume there to keep uploads across restarts.

## Health check probes

The container exposes two HTTP endpoints for Kubernetes health probes. They
are mapped under `/api/health/*` so they pass through the Angular dev-server
proxy (`src/proxy.conf.js` `/api` context) and any ingress rule forwarding
`/api/*` to the backend:

| Endpoint            | Status                          | Probe type   |
|---------------------|---------------------------------|--------------|
| `/api/health/live`  | `200 OK` when the process is alive               | livenessProbe |
| `/api/health/ready` | `200 OK` when the database and S3/Minio are reachable; `503` otherwise | readinessProbe |

The readiness probe checks the database **provider the application was actually
configured with** — PostgreSQL (`AspNetCore.HealthChecks.NpgSql`) or SQL Server
(`AspNetCore.HealthChecks.SqlServer`). A SQL Server probe pointed at a PostgreSQL
connection string fails at startup, so the two can no longer drift apart.

### Database provider

Provider selection is a **runtime** decision, not a compile-time one. It used to be an
`#if DEBUG` branch, which meant a Debug build could not be pointed at a real database
at all. Resolution order, highest precedence first:

1. the `Database__Provider` configuration value,
2. the shape of the `EasyFinanceDB` connection string,
3. **in Development only**, the EF Core in-memory store.

Outside Development, failing to resolve a provider **stops startup** rather than
falling back to the in-memory store, which would appear healthy while persisting
nothing.

> The in-memory store has no migrations, so `UseMigration()` skips it; EF Core would
> throw if asked to migrate a non-relational provider.

PostgreSQL is the only database. The SQL Server provider, its migrations and the
data-migration tooling were removed once the cutover completed, so the image carries a
single provider and no migrator.

The container listens on plain HTTP (`ASPNETCORE_URLS=http://+:8080`) — TLS is
terminated upstream (Traefik). To stop the global HTTPS-redirect middleware from
answering these probes with a `307` (which would keep the container permanently
`un-Ready`), health-probe requests over plain HTTP are handled by
`HealthProbeResponseWriter` (see `EasyFinance.Server/HealthChecks/`) before the
redirect middleware runs. The recognised probe paths live in
`HealthCheckPathPolicy` (`/api/health/live`, `/api/health/ready`).

For all non-probe traffic, the app honours the proxied scheme via
`UseForwardedHeaders` (runs first). It trusts `X-Forwarded-Proto`/`X-Forwarded-For`
only from the networks in `ForwardedHeaders:KnownNetworks`
(default `10.42.0.0/16`, the k3s pod CIDR; override with
`ForwardedHeaders__KnownNetworks__0=…` env vars when the cluster uses different
CIDRs or the proxy runs with `hostNetwork`). This makes HSTS, HTTPS redirects for
direct HTTP access, callback URLs and client-IP logging behave correctly behind
Traefik. The health-probe bypass above remains necessary: kubelet probes reach the
pod directly without forwarded headers and from an untrusted source, so they would
otherwise still be 307-redirected by `UseHttpsRedirection`.

Example Kubernetes probes:

```yaml
livenessProbe:
  httpGet:
    path: /api/health/live
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /api/health/ready
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 10
```


## GitHub secrets (for the publish workflow)

`.github/workflows/docker-publish.yml` runs on **push to `master`** and pushes
the image to the registry. It needs these repository secrets:

| Secret | Purpose |
|---|---|
| `GITEA_REGISTRY_USERNAME` | Gitea user used to log in to the registry (`docker/login-action`). |
| `GITEA_REGISTRY_TOKEN` | Gitea token for that user with `read:package` / `write:package` scopes. |
| `GITEA_NUGET_USERNAME` | Gitea user passed to the build stage as a build arg, for the private `fpssoftware.*` NuGet packages. |
| `GITEA_NUGET_TOKEN` | Token for that user with `read:package`, used by the NuGet restore inside the image build. |

Optional overrides (defaults shown):

| Secret | Default | Purpose |
|---|---|---|
| `GITEA_REGISTRY` | `gitea.fpssoftware.uk` | Registry host. |
| `GITEA_REGISTRY_OWNER` | `fps-software` | Owner/repository path under which the image is pushed. |

The image is tagged `gitea.fpssoftware.uk/<owner>/econoflow:<git-sha>` and
`...:latest`.

> Create the Gitea token at **User Settings → Applications → Generate New
> Token**, selecting the `read:package` and `write:package` scopes. Add
> `GITEA_REGISTRY_USERNAME` and `GITEA_REGISTRY_TOKEN` as GitHub Actions
> secrets in the EconoFlow repository.

### NuGet feeds inside the image build

The build stage restores packages, so it needs the same NuGet configuration as CI:
the root `nuget.config` is `COPY`'d into the stage, and it is the single place that
declares the feeds, the `<packageSourceMapping>` and the `%GITEA_NUGET_*%` credential
indirection. `GITEA_NUGET_USERNAME` / `GITEA_NUGET_TOKEN` are promoted to `ENV` in the
Dockerfile because NuGet resolves that indirection from the process environment.

Do not replace the `COPY` with `dotnet nuget add source`: that writes the user-level
config, which carries no `<packageSourceMapping>`, so the restore asks the private Gitea
feed for every public package. Those lookups return 403, are retried, and eventually
fail the restore with `NU1301`.
`scripts/nuget-source-mapping.test.ps1` fails the build if that regression reappears.

> **Known exposure, not introduced here:** the token is passed as a build arg, and
> `docker-publish.yml` builds with `provenance: mode=max` and a `type=local,...,mode=max`
> buildx cache. BuildKit records build-arg values in provenance attestations and cache
> metadata, so the token is visible to anyone who can read the attestation or the cache.
> It is scoped to the build stage (the `runtime` image is a separate `FROM` and never
> sees it). The hardened form is a BuildKit secret:
> `RUN --mount=type=secret,id=gitea_nuget_token ...` fed from
> `secrets: gitea_nuget_token=${{ secrets.GITEA_NUGET_TOKEN }}`, which keeps the value
> out of both the image and the provenance. Doing that also means writing the
> credentials into `nuget.config` at restore time rather than relying on `%VAR%`
> expansion.
