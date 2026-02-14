// Initializes telemetry as early as possible to ensure we capture all relevant
// events, including those during Nest module initialization. The provider will
// reuse the SDK instance created here.
(await import('~server/telemetry/telemetry.provider')).TelemetryProvider.initFromEnv();

import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createRequestHandler, type RequestHandler } from '@react-router/express';
import type { Express, NextFunction, Request, Response } from 'express';
import { static as serveStatic } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppLoadContext, ServerBuild } from 'react-router';

import { AppModule } from '~server/app.module';
import { LoadContextProvider } from '~server/react-router/load-context.provider';

/**
 * Absolute file path for this ESM module.
 */
const __filename = fileURLToPath(import.meta.url);

/**
 * Absolute directory path containing this module.
 */
const __dirname = path.dirname(__filename);

/**
 * Creates a React Router request handler bound to the given load context.
 */
function makeRequestHandler(
  serverBuild: ServerBuild,
  mode: 'development' | 'production',
  appLoadContext: AppLoadContext,
) {
  return createRequestHandler({
    build: serverBuild,
    mode,
    getLoadContext: () => appLoadContext,
  });
}

/**
 * Wraps a React Router request handler so important events are logged
 * using Nest's Logger. This ensures request/error messages match Nest logs.
 */
function wrapWithNestLogger(handler: RequestHandler, loggerContext = 'ReactRouter') {
  return async (req: Request, res: Response, next: NextFunction) => {
    Logger.log(`${req.method} ${req.originalUrl}`, loggerContext);

    const origWarn = console.warn;
    const origError = console.error;

    console.warn = (...args: unknown[]) => {
      try {
        Logger.warn(args.map(String).join(' '), loggerContext);
      } catch {
        // ignore
      }
    };

    console.error = (...args: unknown[]) => {
      try {
        Logger.error(args.map(String).join(' '), loggerContext);
      } catch {
        // ignore
      }
    };

    try {
      return await handler(req, res, next);
    } catch (error) {
      Logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error), loggerContext);
      return next(error);
    } finally {
      console.warn = origWarn;
      console.error = origError;
    }
  };
}

/**
 * Registers a shared SSR fallback middleware.
 *
 * API requests are left to Nest controllers; all other requests are delegated
 * to the provided React Router handler.
 */
function registerSsrFallback(server: Express, handler: RequestHandler) {
  server.use((req: Request, res: Response, next: NextFunction) => {
    // skip /api endpoints so they're handled by Nest controllers rather than React Router
    if (req.path.startsWith('/api')) {
      return next();
    }

    return handler(req, res, next);
  });
}

/**
 * Registers Vite middleware and SSR fallback handling for development mode.
 */
async function registerDevRoutes(nestApplication: NestExpressApplication, appLoadContext: AppLoadContext) {
  const { createServer } = await import('vite');

  const server = nestApplication.getHttpAdapter().getInstance();

  const vite = await createServer({
    appType: 'custom',
    server: { middlewareMode: true },
  });

  server.use(vite.middlewares);

  registerSsrFallback(server, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serverBuild = (await vite?.ssrLoadModule('virtual:react-router/server-build')) as ServerBuild;

      const requestHandler = makeRequestHandler(serverBuild, 'development', appLoadContext);

      return wrapWithNestLogger(requestHandler)(req, res, next);
    } catch (error) {
      vite?.ssrFixStacktrace(error as Error);
      return next(error);
    }
  });
}

/**
 * Registers static assets and SSR fallback handling for production mode.
 */
async function registerProductionRoutes(nestApplication: NestExpressApplication, appLoadContext: AppLoadContext) {
  const server = nestApplication.getHttpAdapter().getInstance();

  const serverBuild = // @ts-expect-error - generated at build time
    (await import('../build/server/index.js')) as ServerBuild;

  server.use(serveStatic(path.resolve(__dirname, '../build/client'), { index: false }));

  const requestHandler = makeRequestHandler(serverBuild, 'production', appLoadContext);
  registerSsrFallback(server, async (req: Request, res: Response, next: NextFunction) => {
    return wrapWithNestLogger(requestHandler)(req, res, next);
  });
}

/**
 * Bootstraps Nest, wires SSR middleware for the current environment, and starts
 * listening on the configured HTTP port.
 */
async function bootstrap() {
  const nestApplication = await NestFactory.create<NestExpressApplication>(AppModule);

  // Ensure Nest will call lifecycle hooks (e.g. OnModuleDestroy) on process
  // shutdown so providers like TelemetryProvider can gracefully stop.
  nestApplication.enableShutdownHooks();

  const loadContextProvider = nestApplication.get(LoadContextProvider);
  const loadContext = loadContextProvider.create();
  const environment = loadContext.appConfig();

  Logger.log(`Starting in ${environment.nodeEnv} mode on port ${environment.port}`, 'Bootstrap');

  if (environment.nodeEnv === 'production') {
    await registerProductionRoutes(nestApplication, loadContext);
  } else {
    await registerDevRoutes(nestApplication, loadContext);
  }

  await nestApplication.init();
  await nestApplication.listen(environment.port);
}

void bootstrap();
