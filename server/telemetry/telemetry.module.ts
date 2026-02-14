import { Global, Module } from '@nestjs/common';
import type { NodeSDK } from '@opentelemetry/sdk-node';

import { TelemetryProvider } from '~server/telemetry/telemetry.provider';

declare global {
  var __otel_sdk: NodeSDK | undefined;
}

@Global()
@Module({
  exports: [
    TelemetryProvider, //
  ],
  providers: [
    TelemetryProvider, //
  ],
})
export class TelemetryModule {}
