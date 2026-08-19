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
  -e SMTP2GO_API_KEY='<key>' \
  econoflow:test
```

> The container image itself ships **no** configuration values. At startup the
> app **throws** if required production env vars are missing (e.g.
> `SMTP2GO_API_KEY`, `EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN`), so a deployer
> must supply them (SealedSecret / k8s Secret, etc.).

## Runtime environment variables

The server reads its configuration from these environment variables (Release /
production build), in addition to `appsettings.json`:

| Variable | Purpose | Required |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | Defaults to `Production` in the image. | no |
| `EasyFinanceDB` | SQL Server connection string (Persistence uses it in `#else` build). | **yes** |
| `EconoFlow_TOKEN_SECRET_KEY` | JWT signing key (used when not `Development`). | **yes** |
| `EconoFlow_ISSUER` | JWT issuer. | no (falls back to config) |
| `EconoFlow_AUDIENCE` | JWT audience. | no (falls back to config) |
| `EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN` | Secret for account-delete tokens — the controller throws if missing. | **yes** |
| `SMTP2GO_API_KEY` | Outbound email — `Program.cs` throws in non-Development if missing. | **yes** |
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
| `/api/health/ready` | `200 OK` when SQL Server and S3/Minio are reachable; `503` otherwise | readinessProbe |

The container listens on plain HTTP (`ASPNETCORE_URLS=http://+:8080`) — TLS is
terminated upstream (Traefik). To stop the global HTTPS-redirect middleware from
answering these probes with a `307` (which would keep the container permanently
`un-Ready`), health-probe requests over plain HTTP are handled by
`HealthProbeResponseWriter` (see `EasyFinance.Server/HealthChecks/`) before the
redirect middleware runs. The recognised probe paths live in
`HealthCheckPathPolicy` (`/api/health/live`, `/api/health/ready`).

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
