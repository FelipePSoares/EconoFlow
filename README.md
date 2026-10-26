<div align="center">
<span align="center"><img alt="EconoFlow" width="220" src="https://econoflow.pt/assets/images/logo-without-background-300-min.png"><span /><br>
<em>An easy system to help you control your personal or company budget.</em>
<br><br>
<a title="Build Status" target="_blank" href="https://github.com/FelipePSoares/EconoFlow/actions/workflows/Release.yml"><img src="https://img.shields.io/github/actions/workflow/status/FelipePSoares/EconoFlow/Release.yml?style=flat-square"></a>
<a title="Code Size" target="_blank" href="https://github.com/FelipePSoares/EconoFlow"><img src="https://img.shields.io/github/languages/code-size/FelipePSoares/EconoFlow.svg?style=flat-square&color=yellow"></a>
<a title="GitHub Pull Requests" target="_blank" href="https://github.com/FelipePSoares/EconoFlow/pulls"><img src="https://img.shields.io/github/issues-pr-closed/FelipePSoares/EconoFlow.svg?style=flat-square&color=FF9966"></a>
<br>
<a title="GitHub Commits" target="_blank" href="https://github.com/FelipePSoares/EconoFlow/commits/master"><img src="https://img.shields.io/github/commit-activity/m/FelipePSoares/EconoFlow.svg?style=flat-square"></a>
<a title="Last Commit" target="_blank" href="https://github.com/FelipePSoares/EconoFlow/commits/master"><img src="https://img.shields.io/github/last-commit/FelipePSoares/EconoFlow.svg?style=flat-square&color=FF9900"></a>
</div>

---

## 💡 Introduction

The objective with EconoFlow is create a simple system to track your expenses and incomes to stay in your budget. 

Try and use it in our [live](https://www.econoflow.pt) project.

## 🗺️ Roadmap

* [EconoFlow development plan and progress](https://github.com/users/FelipePSoares/projects/1)

## 🛠️ Development Guide

See [Development Guide](https://github.com/FelipePSoares/EconoFlow/blob/master/.github/CONTRIBUTING.md).

## 🚀 Running the app locally

`docker-compose.dev.yml` runs **PostgreSQL 18 and the application** on your machine. It hosts
nothing else — the end-to-end suite runs from the host, exactly as it does in CI.

This is the fastest way to run EconoFlow, and the recommended way to check a change: start
the stack, use the app, then run the Cypress suite instead of testing by hand.

### Setup (once)

The .NET restore needs the private `fpssoftware.*` NuGet packages from the Gitea feed, and
`nuget.config` reads that feed's credentials from the environment (NuGet rejects an empty
password), so **the image cannot be built without a token**.

```bash
cp .env.example .env
```

Then fill in `.env` — it is git-ignored, never commit it:

```dotenv
GITEA_NUGET_USERNAME=<your gitea user>
GITEA_NUGET_TOKEN=<token with the read:package scope>
```

Create the token in Gitea at **User settings → Applications → Generate new token**, scope
`read:package`.

### Run

```bash
docker compose -f docker-compose.dev.yml up --build -d   # start (first build takes a few minutes)
docker compose -f docker-compose.dev.yml ps              # wait for both to say "healthy"
docker compose -f docker-compose.dev.yml logs -f app     # follow the application log
docker compose -f docker-compose.dev.yml down -v         # stop, and drop the data
```

| URL | What |
|---|---|
| <http://localhost:4200> | The SPA **and** `/api` on one origin — open this |
| <http://localhost:7003> | The API on its own, for `curl` |
| <http://localhost:4200/swagger> | Swagger UI (Development only) |

Sign in with the seeded user:

| Email | Password | Role |
|---|---|---|
| `test@test.com` | `Passw0rd!` | Admin of the seeded `Family` project |
| `test1@test.com` | `Passw0rd!` | Manager of the same project |

### Run the end-to-end tests

With the stack up, the suite needs no configuration — `http://localhost:4200` is its default
base URL:

```bash
cd easyfinance.client
npx cypress run      # headless
npx cypress open     # interactive
```

### Good to know

* **Ports 4200 and 7003** are what `ng serve` and `dotnet run` use. Stop those before starting
  the stack. Both are overridable — set `ECONOFLOW_DEV_WEB_PORT` / `ECONOFLOW_DEV_API_PORT`,
  then run the suite with `CYPRESS_BASE_URL=http://localhost:<port>`.
* **The seeding runs once.** The fixture data cannot be re-seeded against a non-empty
  database, so after changing seed code run `down -v` first.
* **State** lives in the `postgres-data` and `attachments` volumes; `down` keeps it, `down -v`
  drops it.
* **`TZ`** defaults to `Europe/Vienna` and must match your browser's zone: the app derives
  "today" and month boundaries from the clock. Override it, e.g. `TZ=Europe/Lisbon`.
* The stack serves the **Development** application on the same production browser bundle the
  released image ships, so what you click through is what is deployed.

> Working in this repo as an automated agent? Start the stack the same way. Three details
> will otherwise cost you an hour: `GenericRepository.Insert` only works when `DEBUG` is
> defined (the image defines it explicitly), `appsettings.Development.json` is excluded from
> the image because it holds local Windows cert paths, and `HttpsRedirection__HttpsPort=0`
> is what makes a plain-HTTP stack answer instead of redirecting to `https://<host>/`.
> `EasyFinance.Server.Tests/DevStackTests.cs` locks all three down.

## 🐳 Docker / Container

The application is distributed as a single container (ASP.NET Core API + Angular SPA),
published to the self-hosted Gitea registry (`gitea.fpssoftware.uk`) on push to `master`.
See [docs/docker.md](docs/docker.md) for the image, required runtime environment
variables, and the GitHub secrets used by `.github/workflows/docker-publish.yml`.

## Contributors

Welcome to join us and contribute code to EconoFlow together.

<a href="https://github.com/FelipePSoares/EconoFlow/graphs/contributors">
   <img src="https://contrib.rocks/image?repo=FelipePSoares/EconoFlow" />
</a>

