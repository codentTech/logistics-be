export interface RetryOptions {
  maxRetries: number;
  initialDelay: number; // milliseconds
  maxDelay: number;
  multiplier: number; // exponential backoff multiplier
  retryableErrors?: string[];
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error;
  let delay = options.initialDelay;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (options.retryableErrors) {
        const errorCode = (error as any)?.code || (error as any)?.name;
        if (!options.retryableErrors.includes(errorCode)) {
          throw error;
        }
      }

      // Don't retry on last attempt
      if (attempt === options.maxRetries) {
        break;
      }

      // Wait with exponential backoff
      await sleep(delay);
      delay = Math.min(delay * options.multiplier, options.maxDelay);
    }
  }

  throw lastError!;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
