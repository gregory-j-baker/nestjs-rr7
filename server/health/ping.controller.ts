import { Controller, Get } from '@nestjs/common';

/**
 * Ping controller for lightweight server endpoints.
 */
@Controller()
export class PingController {
  /**
   * Returns a simple status payload indicating the server is reachable.
   */
  @Get('/api/ping')
  public ping() {
    return { status: 'ok' };
  }
}
