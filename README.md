# nestjs-rr7 — NestJS + React Router v7 (PoC)

This repository is a minimal proof-of-concept that demonstrates how to bridge a
NestJS server with a React Router v7 application for server-side rendering
(SSR). It shows how to:

- load and validate environment configuration with typed schemas,
- initialize and expose telemetry (OpenTelemetry) safely during bootstrap,
- mount React Router's request handler inside an Express server managed by
  NestJS,
- provide React Router loaders with services from Nest's DI container, and
- expose health checks (via @nestjs/terminus) for external monitoring.

**Quick links**
- Server bootstrap and SSR integration:
  [server/app.bootstrap.ts](server/app.bootstrap.ts)
- Load context shared with React Router loaders:
  [server/providers/load-context.provider.ts](server/providers/load-context.provider.ts)
- Telemetry provider (OpenTelemetry):
  [server/providers/telemetry.provider.ts](server/providers/telemetry.provider.ts)
- Environment schemas and validation:
  [server/config/index.ts](server/config/index.ts)
- Healthchecks and controller: [server/healthchecks](server/healthchecks)

## Features & Implementation Notes

- Environment configuration - Environment variables are validated and coerced
	into typed config objects using `class-transformer` and `class-validator`
	(see [server/config/index.ts](server/config/index.ts) and the individual
	schemas in `server/config`). - The merged `appConfig` namespace is provided
	to Nest via `ConfigService` for consistent access across providers.

- Telemetry - OpenTelemetry `NodeSDK` is initialized as early as possible with
	`TelemetryProvider.initFromEnv()` to allow auto-instrumentation of
	subsequently imported modules. The runtime SDK is started/stopped as part of
	the provider lifecycle
	([server/providers/telemetry.provider.ts](server/providers/telemetry.provider.ts)).
	- Toggle telemetry with the `TELEMETRY_ENABLED` environment variable and
	configure exporters via OTEL_* variables.

- Bridging NestJS and React Router v7 - The app bootstraps Nest (an Express
	adapter) and then registers either Vite dev middleware or a static build
	handler depending on `NODE_ENV`
	([server/app.bootstrap.ts](server/app.bootstrap.ts)). - React Router's
	`createRequestHandler` is used to create an SSR request handler which is
	wrapped to surface logs through Nest's `Logger`, and the server delegates
	non-`/api` requests to that handler. - The `LoadContextProvider` constructs
	an `AppLoadContext` object that exposes Nest-provided services (e.g.,
	telemetry, GitHub status provider) to React Router loaders
	([server/providers/load-context.provider.ts](server/providers/load-context.provider.ts)).
	This keeps server-side logic testable and reusable inside loaders.

- Health checks - Health endpoints are implemented with `@nestjs/terminus`.
	Example: `/api/healthz`
	([server/healthchecks/health.controller.ts](server/healthchecks/health.controller.ts)).
	- Custom health indicators (e.g., `GitHubStatusIndicator`) call application
	providers and return structured `HealthIndicatorResult`s for integration
	with monitoring systems.

## Running the project

- Install dependencies (this repo uses pnpm in the workspace):

```bash
pnpm install
```

- Development (runs Nest + Vite middleware for HMR/SSR):

```bash
pnpm run dev
```

- Build for production:

```bash
pnpm run build
```

Then run the built server (example):

```bash
node build/server/index.js
```

## Environment variables (high level)

- `NODE_ENV` — `development` or `production` (controls dev middleware vs static
  build).
- `PORT` — port Nest listens on.
- `TELEMETRY_ENABLED` — enable OpenTelemetry.
- `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `OTEL_SERVICE_VERSION`,
  `OTEL_EXPORT_INTERVAL_MS` — telemetry configuration.
- `GITHUB_STATUS_URL`, `GITHUB_STATUS_CACHE_TTL_MS` — example upstream service
  settings used by `GitHubStatusProvider`.

See the typed schemas under `server/config` for defaults and validation rules.

## Project layout (high level)

- `app/` — React application (client entry, routes, styles).
- `server/` — NestJS server code and providers (config, controllers,
  healthchecks, DI providers).

## Next steps / ideas

- Expand example loaders to demonstrate authenticated data fetching using Nest
  services exposed via `AppLoadContext`.
- Add integration tests that exercise the SSR pipeline and the health endpoints.
- Harden the telemetry and graceful shutdown behavior for production readiness.
