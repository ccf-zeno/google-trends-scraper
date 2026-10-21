import type { GoogleTrendsErrorCode } from './constants';

import type { GoogleTrendsErrorOptions } from './types';

export class GoogleTrendsError extends Error {
  readonly code: GoogleTrendsErrorCode;
  readonly status: number | undefined;
  readonly retryAfter: string | undefined;

  constructor(
    code: GoogleTrendsErrorCode,
    message: string,
    options: GoogleTrendsErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'GoogleTrendsError';
    this.code = code;
    this.status = options.status;
    this.retryAfter = options.retryAfter;
  }
}
