import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, Max, Min } from 'class-validator';

import { toBoolean, toNumber } from '~server/app.config';

/**
 * Class-validator schema and validated output shape for core runtime
 * environment variables.
 */
export class CoreConfig {
  /**
   * Runtime mode used to choose production vs development behavior.
   */
  @Expose({ name: 'NODE_ENV' })
  @IsIn(['development', 'production', 'test'], { message: 'NODE_ENV must be one of: development, production, test' })
  readonly nodeEnv: 'development' | 'production' | 'test' = 'development';

  /**
   * HTTP port used by Nest's `listen` call.
   */
  @Transform(toNumber())
  @Expose({ name: 'PORT' })
  @IsInt({ message: 'PORT must be an integer' })
  @Min(1, { message: 'PORT must be >= 1' })
  @Max(65535, { message: 'PORT must be <= 65535' })
  readonly port: number = 3000;

  /**
   * Whether debug features are enabled.
   */
  @Transform(toBoolean())
  @Expose({ name: 'DEBUG' })
  @IsBoolean({ message: 'DEBUG must be true or false' })
  readonly debug: boolean = false;
}
