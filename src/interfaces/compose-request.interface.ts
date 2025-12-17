/**
 * A single query in a compose request
 */
export interface ComposeQuery {
  /**
   * Path to the handler (must be registered in RouteRegistry)
   */
  path: string;

  /**
   * Request body (may contain @fields)
   */
  body?: any;

  /**
   * Path parameters
   */
  params?: Record<string, any>;

  /**
   * Query parameters
   */
  query?: Record<string, any>;
}

/**
 * Compose request format
 * {
 *   "queries": {
 *     "alias": {
 *       "path": "/user/me",
 *       "body": { "@fields": ["id"], ... }
 *     }
 *   }
 * }
 */
export interface ComposeRequest {
  queries: Record<string, ComposeQuery>;
}

/**
 * Compose response format
 * {
 *   "alias": { ...result }
 * }
 */
export interface ComposeResponse {
  [alias: string]: any;
}
