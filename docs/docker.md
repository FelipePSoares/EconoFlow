# EconoFlow â€” Docker container & registry publishing

This describes the production **container image** for EconoFlow: what it
contains, the runtime configuration it needs, and how the GitHub Actions
workflow publishes it to the self-hosted Gitea container registry.

## Image

- **Location:** `gitea.fpssoftware.uk/fps-software/econoflow`
- **Build:** `Dockerfile` at the repository root.
- **Content:** a **single** image runs both the ASP.NET Core API and the
  Angular SPA — as **one process**. The Angular client calls the backend over
  **relative** `/api/...` URLs on the same origin, the browser bundle is copied
  into the server's `wwwroot`, and `Program.cs` serves it with
  `UseDefaultFiles()` / `UseStaticFiles()`. Nothing sits in front of Kestrel
  inside the container.
- **Base images:** `.NET 10 SDK` to build, `.NET 10 ASP.NET Runtime **Alpine,
  `-extra` variant**` to run. The `-extra` variant is the one that installs ICU and
  tzdata; the plain `alpine` tag sets `DOTNET_SYSTEM_GLOBALIZATION_INVARIANT` and
  ships no zone database, which makes the first `TimeZoneInfo` lookup throw.
  `EasyFinance.Server.csproj` sets `InvariantGlobalization`/`InvariantTimezone`
  to `false`, which is what makes the variant's culture support usable.
- **Platform:** `linux/amd64`, framework-dependent.
- **Port:** Kestrel listens on plain HTTP **`8080`** (`ASPNETCORE_HTTP_PORTS=8080`,
  `EXPOSE 8080`). The SPA and `/api` share it, which is the origin the Angular
  client requires. TLS is terminated upstream (the Traefik ingress), and the app's
  `UseHttpsRedirection` / `Hsts()` middleware honour the forwarded scheme.
- **User:** runs as the base image's non-root user (`APP_UID`, 1654).
- **Health check:** one probe, two facts — `/api/health/live` answers *and*
  `/index.html` is served. A container whose `wwwroot` was empty would otherwise
  report healthy while every page 404s.

> **Why there is no nginx.** The image used to run nginx and Kestrel side by side
> under an entrypoint script that rendered the nginx site from the environment at
> start-up. None of it was load-bearing: the SPA and the API already share a
> process, the ingress supplies `X-Forwarded-Proto`, and a single process needs no
> supervisor. The cost was real — the public port was nginx's, Kestrel hid on 8081,
> and a front door that kept answering 502s made a dead API look like a network
> problem.

### Building locally

```bash
docker build -t econoflow:test .
```

### Running locally

```bash
docker run --rm -p 8080:8080 \
  -e EasyFinanceDB='Host=postgres;Port=5432;Database=econoflow;Username=econoflow;Password=...' \
  -e EconoFlow_TOKEN_SECRET_KEY='<32+ char secret>' \
  -e EconoFlow_ISSUER='https://econoflow.pt' \
  -e EconoFlow_AUDIENCE='https://econoflow.pt' \
  -e EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN='<32+ char secret>' \
  -e EconoFlow_USER_KEY_SALT='<32+ char secret>' \
  -e EconoFlow_UNSUBSCRIBE_HMAC_SECRET='<32+ char secret>' \
  -e SMTP_HOST='smtp.example.com' \
  -e SMTP_USERNAME='<smtp user>' \
  -e SMTP_PASSWORD='<smtp password>' \
  econoflow:test
```

> The container image itself ships **no** configuration values. At startup the
> app **throws** if required production env vars are missing (e.g.
> `SMTP_HOST`, `SMTP_USERNAME`, `SMTP_PASSWORD`), and validates every secret in one
> pass before the host is built: a missing, blank or too-short (under 32 characters)
> `EconoFlow_TOKEN_SECRET_KEY`, `EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN`,
> `EconoFlow_USER_KEY_SALT` or `EconoFlow_UNSUBSCRIBE_HMAC_SECRET` stops the start-up
> with a single message naming all of them. A deployer must supply them
> (SealedSecret / k8s Secret, etc.).

## Local development stack

`docker-compose.dev.yml` runs **PostgreSQL 18 and the application** locally, so the app can be
used — and exercised by the end-to-end suite — without installing a database. It hosts
nothing else: the suite runs on your machine with `npx cypress run`, from
`easyfinance.client`, exactly as the `integration-tests` job does in CI.

The image is `docker/Dockerfile.dev`. It is the release image plus the two things Development
needs — the environment and `DEBUG` — instead of a second copy of the whole layout: it imports
the shared `econoflow:base` stage, republishes the API, and runs
`ASPNETCORE_ENVIRONMENT=Development` so migrations are applied at start-up, the sample data is
seeded, e-mail is a no-op and Swagger is served. The release image cannot do this job — it is
Production-only and refuses to start without SMTP credentials and a JWT secret.

The stack's one process listens on **two ports**, both published:

```bash
# 1. the shared base stages (the SDK, the Node.js client build and the NuGet restore)
docker build -t econoflow:base .

# 2. the Development image on top of them
docker compose -f docker-compose.dev.yml build
```

A Dockerfile can only import another image's **final** stage, which is why the shared half is
published as `econoflow:base` rather than `FROM <stage of ../Dockerfile>`.

### Setup

The application's NuGet restore needs the private `fpssoftware.*` feed, and `nuget.config`
declares that feed's credentials as environment variables (NuGet rejects an empty password),
so the build needs a Gitea token. Copy `.env.example` to `.env` — which is git-ignored — and
fill it in:

```bash
cp .env.example .env
# edit .env:
#   GITEA_NUGET_USERNAME=<your gitea user>
#   GITEA_NUGET_TOKEN=<token with the read:package scope>
```

### Run

```bash
# the shared base stages, first or after any source change to the API
docker build -t econoflow:base --build-arg GITEA_NUGET_USERNAME="$GITEA_NUGET_USERNAME" \
  --secret id=gitea_nuget_token,src=<file-with-the-token> .

# start PostgreSQL and the application
docker compose -f docker-compose.dev.yml up --build -d

# both services should report healthy
docker compose -f docker-compose.dev.yml ps

# follow the application's log
docker compose -f docker-compose.dev.yml logs -f app

# stop everything, and drop the database and uploaded files
docker compose -f docker-compose.dev.yml down -v
```

| URL | What |
|---|---|
| <http://localhost:4200> | The SPA **and** `/api` on one origin — open this to use the app |
| <http://localhost:7003> | The API on its own, for `curl` or a direct look at an endpoint |
| <http://localhost:4200/swagger> | Swagger UI (Development only) |

Both ports are published on `127.0.0.1` only.

The sample data is seeded on the first start (`EconoFlow_SEED_DEVELOPMENT_DATA=true`), and
the seeded user is the one the suite signs in as:

* `test@test.com` / `Passw0rd!` — owner of the seeded `Family` project.

### Run the end-to-end suite against it

Once the stack is up, `npx cypress run` from `easyfinance.client` works unchanged: the suite
visits `http://localhost:4200` by default, and that is the origin the stack publishes.

```bash
cd easyfinance.client
npx cypress run     # headless
npx cypress open    # interactive
```

Use this instead of clicking through the app by hand: it is faster and it is what CI runs.

### Why one origin

The Angular client calls the API with bare `/api/...` URLs and relies on sharing an origin
with it. The stack preserves that because the SPA and the API are the **same server**: the
browser bundle is served from `wwwroot` over the same port the API listens on, so nothing on
the client needs a stack-specific configuration and the suite runs against the same bundle the
release image serves.

### Ports in use

4200 and 7003 are the ports `ng serve` and `dotnet run` use, so **stop those before starting
the stack**. Both are overridable:

```bash
ECONOFLOW_DEV_WEB_PORT=4300 ECONOFLOW_DEV_API_PORT=7300 \
  docker compose -f docker-compose.dev.yml up --build -d

CYPRESS_BASE_URL=http://localhost:4300 npx cypress run
```

Inside the container the single Kestrel process binds both (`ASPNETCORE_URLS` in
`docker/Dockerfile.dev`): 4200 is the SPA origin, 7003 is the API on its own. There is no
hidden third port — the 8081 the stack used to have was Kestrel's, back when nginx owned the
published ones.

### Notes

* The image runs on the Alpine `-extra` runtime, which carries ICU and the full time-zone
  database, and sets `TZ` to your local time zone: the application derives "today" and month
  boundaries from the clock, and they must line up with the browser's. Override with `TZ=...`.
  The plain `alpine` tag has neither, and would silently run on UTC while throwing on the first
  culture-aware call.
* The stack keeps its state in the `postgres-data` and `attachments` volumes. The seeding
  cannot run twice against a non-empty database, so after changing seed code start from a
  clean database with `down -v`.
* The image publishes a **Release** build with `DefineConstants=DEBUG`. `GenericRepository.Insert`
  only tracks the entity `#if DEBUG`, and a plain Release build makes every Insert a no-op. The
  seeder no longer goes through it — it adds its fixture graph to the change tracker itself —
  but the define stays so a fixture that still used Insert could not be silently skipped.
* The PostgreSQL image is pinned to the same digest the `integration-tests` CI job runs.
  `EasyFinance.Server.Tests/DevStackTests.cs` keeps the two in step.

## Support period and security guidance

An image is supported for **12 months after its release**. Only the current release receives
security updates; pin a deployment to the commit-SHA tag (or its digest), not to `:latest`,
and redeploy the new digest when a security release is published.

Self-hosters are the deployers this product's Annex II information is written for: the full
instructions for a secure installation and configuration, the expected environment, the update
process and the vulnerability reporting channel are in
[`docs/security-user-guide.md`](security-user-guide.md) and at
<https://econoflow.pt/security>. The support period and the end-of-support notice are stated in
[`SECURITY.md`](../SECURITY.md).

## Runtime environment variables

The server reads its configuration from these environment variables (Release /
production build), in addition to `appsettings.json`:

| Variable | Purpose | Required |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | Defaults to `Production` in the image. | no |
| `EasyFinanceDB` | PostgreSQL connection string. A `Host=` value implies PostgreSQL; anything else resolves to no provider and **stops startup** rather than connecting somewhere unintended. | **yes** |
| `Database__Provider` | Explicit store selection: `PostgreSql` or `InMemory`. Overrides inference from the connection string. See "Database provider" below. | no |
| `EconoFlow_TOKEN_SECRET_KEY` | JWT signing key (used when not `Development`; 32+ chars). | **yes** |
| `EconoFlow_ISSUER` | JWT issuer. | no (falls back to config) |
| `EconoFlow_AUDIENCE` | JWT audience. | no (falls back to config) |
| `EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN` | Secret that signs account-delete tokens (32+ chars) — validated at start-up, not at request time. | **yes** |
| `EconoFlow_USER_KEY_SALT` | Salt hashed into every client-side user encryption key (32+ chars) — validated at start-up. | **yes** |
| `EconoFlow_UNSUBSCRIBE_HMAC_SECRET` | HMAC key for unsubscribe-link signatures (32+ chars) — validated at start-up. | **yes** |
| `SMTP_HOST` / `SMTP_USERNAME` / `SMTP_PASSWORD` | Outbound e-mail over SMTP â€” `Program.cs` throws in non-Development when the SMTP settings are incomplete. | **yes** |
| `SMTP_PORT` / `SMTP_SECURE_SOCKET` | SMTP port (default `587`) and TLS mode: `Auto`, `None`, `StartTls` or `SslOnConnect` (default `Auto`). | no |
| `SMTP_FROM_ADDRESS` / `SMTP_FROM_NAME` | From address/name used for every outbound e-mail (defaults `noreply@econoflow.pt` / `NoReply EconoFlow`). | no |
| `SMTP_TIMEOUT_SECONDS` | Timeout for SMTP connect/authenticate/send, in seconds (default `30`). | no |
| `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` | MinIO/S3 attachment storage (when `AttachmentStorage:Provider` is `Minio`). | when Minio |
| `ForwardedHeaders__KnownNetworks__0` … | Trusted proxy address ranges (CIDR) whose `X-Forwarded-Proto` / `X-Forwarded-For` headers are honoured. The defaults are replaced by whatever is configured, and the image ships with `10.42.0.0/16` only, so any other TLS-terminating proxy (compose, nginx, a sibling container) must be listed here or `X-Forwarded-Proto` is ignored and every request is redirected to `https://<host>:8080/`. | **yes**, unless the proxy is in `10.42.0.0/16` |
| `ForwardedHeaders__KnownProxies__0` … | A single trusted proxy address, for a proxy that has no network range of its own. It is the alternative to `ForwardedHeaders__KnownNetworks__0`, not an addition to it. | when applicable |
| `EconoFlow_TURNSTILE_SECRET_KEY` / `EconoFlow_TURNSTILE_SITE_KEY` | Cloudflare Turnstile. | when used |
| `EconoFlow_EXPO_PUSH_ACCESS_TOKEN` | Expo push notifications. | when used |
| `EconoFlow_KEY_ENCRYPT_ACTIVE` | Enables DPAPI key protection (Windows only â€” not applicable to the Linux image). | no |

Other sections (`WebPush:PublicKey/PrivateKey`, `Serilog:WriteTo:BetterStack`
`sourceToken`/`betterStackEndpoint`) are configured either via `appsettings.json`
overrides or future env/config substitution by the deployer.

### Persistent volume

The default `AttachmentStorage:Provider` is `FileSystem`, writing under the app
base directory. The image declares `VOLUME ["/app/attachments"]` â€” mount a
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

The readiness probe checks the database with `AspNetCore.HealthChecks.NpgSql`, registered
only when the store is relational. PostgreSQL is the only relational database, so there is
no second provider to mismatch it against â€” but it is still selected from
`DatabaseProviderInfo` rather than assumed, because a SQL Server probe pointed at a
PostgreSQL connection string once failed at startup.

### Seeding Development data

`DevelopmentTestDataSeeder` writes its fixtures through the `DbContext`'s change tracker, not
through `IGenericRepository.Insert`. That is not a style choice: `Insert` only calls `Add()`
under `#if DEBUG`, so in a Release build — which every image is — the repository call is a
no-op. The fixtures reference each other (a user's default project, a project's categories), so
the missing principal surfaced the first time they were written to PostgreSQL:
`FK_AspNetUsers_Projects_DefaultProjectId`. `Program.cs` treats a failed seed as fatal at
start-up, so the container exited, restarted, seeded nothing again, and exited again — the
stack looked up while its API was never reachable.

The whole fixture is now one `SaveChangesAsync`, so a failure leaves no half-seeded database
behind and every row in it — including the seeded `test@test.com` the suite signs in as —
actually exists.

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

The container answers on plain HTTP (`Kestrel` on `8080`); TLS is terminated upstream
(Traefik). To stop the global HTTPS-redirect middleware from answering these probes with a
`307` (which would keep the container permanently `un-Ready`), health-probe requests over
plain HTTP are handled by `HealthProbeResponseWriter` (see `EasyFinance.Server/HealthChecks/`)
before the redirect middleware runs. The recognised probe paths live in
`HealthCheckPathPolicy` (`/api/health/live`, `/api/health/ready`).

For all non-probe traffic, the app honours the proxied scheme via
`UseForwardedHeaders` (runs first). It trusts `X-Forwarded-Proto`/`X-Forwarded-For`
only from the networks in `ForwardedHeaders:KnownNetworks`
(default `10.42.0.0/16`, the k3s pod CIDR; override with
`ForwardedHeaders__KnownNetworks__0=â€¦` env vars when the cluster uses different
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

> Create the Gitea token at **User Settings â†’ Applications â†’ Generate New
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
