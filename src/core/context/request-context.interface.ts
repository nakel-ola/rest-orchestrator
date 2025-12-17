/**
 * Request-scoped context stored in AsyncLocalStorage
 * 
 * This context is automatically initialized for HTTP requests and
 * manually initialized for /compose sub-requests.
 */
export interface RequestContext {
  /**
   * Request start time (milliseconds since epoch)
   */
  startTime: number;

  /**
   * Per-request cache Map for deduplication
   * Automatically cleared when request completes
   */
  cache: Map<string, any>;

  /**
   * Selected fields for field selection (optional, provided by FieldsModule)
   */
  fields?: any; // Will be typed as FieldsContext when FieldsModule is imported

  /**
   * Request ID for tracing
   */
  requestId?: string;

  /**
   * HTTP method
   */
  method?: string;

  /**
   * Request path
   */
  path?: string;

  /**
   * Additional request metadata
   */
  metadata?: Record<string, any>;
}

