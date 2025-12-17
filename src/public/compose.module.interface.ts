import { Type } from "@nestjs/common";

/**
 * Unified handler that can reference either a service method or controller method
 */
export interface RouteHandler {
  /**
   * The class (service or controller) containing the method
   */
  handler: Type<any>;

  /**
   * The method name to call
   */
  method: string;

  /**
   * HTTP method this route handles
   */
  httpMethod: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
}

/**
 * Route registration mapping a path to a handler
 */
export interface RouteRegistration {
  /**
   * The path pattern (supports :param syntax)
   * Examples: "/user/me", "/users/:id", "/posts/:postId/comments"
   */
  path: string;

  /**
   * The handler configuration
   */
  handler: RouteHandler;
}

/**
 * Configuration for ComposeModule
 */
export interface ComposeModuleOptions {
  /**
   * Route registrations
   */
  routes: RouteRegistration[];

  /**
   * Maximum number of operations per compose request
   * @default 50
   */
  maxBatchSize?: number;

  /**
   * Maximum nesting depth for field selection
   * @default 10
   */
  maxFieldDepth?: number;

  /**
   * Enable request-level caching and deduplication
   * @default true
   */
  enableCaching?: boolean;

  /**
   * Maximum execution time for entire compose request in milliseconds
   * @default 60000 (60 seconds)
   */
  maxExecutionTimeMs?: number;

  /**
   * Maximum payload size in bytes
   * @default 1048576 (1 MB)
   */
  maxPayloadSize?: number;

  /**
   * Maximum number of times a single route can be called within one compose request
   * @default 10
   */
  perRouteCallLimit?: number;
}

