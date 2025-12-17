import {
  Injectable,
  HttpException,
  HttpStatus,
  Inject,
  RequestTimeoutException,
} from "@nestjs/common";
import { RouteRegistry } from "./route-registry.service";
import { RequestCacheService } from "./request-cache.service";
import { RequestContextService } from "./request-context.service";
import { RequestContextUtil } from "./request-context.util";
import { FieldSelector } from "./field-selector.util";
import { FieldsContextHelper } from "./fields-context.helper";
import { MethodInvokerService } from "./method-invoker.service";
import { ComposeQuery } from "../interfaces/compose-request.interface";

interface OrchestratorConfig {
  maxBatchSize: number;
  maxFieldDepth: number;
  enableCaching: boolean;
  queryTimeout?: number; // Timeout per query in milliseconds
  totalTimeout?: number; // Total timeout for all queries in milliseconds (deprecated, use maxExecutionTimeMs)
  maxExecutionTimeMs?: number; // Maximum execution time for entire compose request in milliseconds
  perRouteCallLimit?: number; // Maximum calls per route within one compose request
  maxCost?: number; // Maximum cost (e.g., total execution time in ms)
}

/**
 * ComposeService - Core service for executing compose queries
 * 
 * Responsibilities:
 * 1. Iterate through compose queries
 * 2. Resolve path via RouteRegistry
 * 3. Initialize AsyncLocalStorage context per query
 * 4. Call mapped service or controller method directly
 * 5. Apply request-level caching
 * 6. Collect results by alias
 * 7. Enforce timeout and cost limits
 * 
 * Constraints:
 * - NO HTTP calls
 * - NO reflection hacks
 * - NO circular dependencies
 * - Fail fast on errors
 */
@Injectable()
export class ComposeService {
  private readonly DEFAULT_QUERY_TIMEOUT = 30000; // 30 seconds per query
  private readonly DEFAULT_TOTAL_TIMEOUT = 60000; // 60 seconds total

  constructor(
    private readonly routeRegistry: RouteRegistry,
    private readonly requestCache: RequestCacheService,
    private readonly requestContext: RequestContextService,
    private readonly methodInvoker: MethodInvokerService,
    @Inject("ORCHESTRATOR_CONFIG")
    private readonly config: OrchestratorConfig
  ) {}

  /**
   * Execute multiple compose queries in parallel
   * @param queries Map of alias to query
   * @returns Map of alias to result
   */
  async executeQueries(
    queries: Record<string, ComposeQuery>
  ): Promise<Record<string, any>> {
    const startTime = Date.now();
    const queryTimeout =
      this.config.queryTimeout || this.DEFAULT_QUERY_TIMEOUT;
    const maxExecutionTime =
      this.config.maxExecutionTimeMs || this.config.totalTimeout || this.DEFAULT_TOTAL_TIMEOUT;

    // Track per-route call counts for safety guard
    const routeCallCounts = new Map<string, number>();
    const perRouteLimit = this.config.perRouteCallLimit || 10;

    const entries = Object.entries(queries);
    const results: Record<string, any> = {};

    // Execute queries in parallel with timeout protection
    const queryPromises = entries.map(async ([alias, query]) => {
      try {
        // Check max execution time before starting
        const elapsed = Date.now() - startTime;
        if (elapsed >= maxExecutionTime) {
          throw new RequestTimeoutException(
            `Maximum execution time of ${maxExecutionTime}ms exceeded before executing query "${alias}"`
          );
        }

        // Enforce per-route call limit (fail fast)
        const routeKey = query.path;
        const currentCount = routeCallCounts.get(routeKey) || 0;
        if (currentCount >= perRouteLimit) {
          throw new HttpException(
            `Per-route call limit exceeded: route "${routeKey}" has been called ${currentCount} times, exceeding the limit of ${perRouteLimit} calls per compose request`,
            HttpStatus.TOO_MANY_REQUESTS
          );
        }
        routeCallCounts.set(routeKey, currentCount + 1);

        // Execute query with per-query timeout
        const result = await this.executeQueryWithTimeout(
          alias,
          query,
          queryTimeout,
          startTime,
          maxExecutionTime
        );

        return { alias, result, error: null };
      } catch (error) {
        // Fail fast - return error immediately
        return {
          alias,
          result: null,
          error: this.normalizeError(error, alias),
        };
      }
    });

    // Wait for all queries to complete (or fail)
    const settledResults = await Promise.allSettled(queryPromises);

    // Collect results by alias
    for (const settled of settledResults) {
      if (settled.status === "fulfilled") {
        const { alias, result, error } = settled.value;
        if (error) {
          results[alias] = error;
        } else {
          results[alias] = result;
        }
      } else {
        // This shouldn't happen, but handle it
        const alias = "unknown";
        results[alias] = {
          error: settled.reason?.message || "Unknown error",
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    }

    // Enforce cost limits (total execution time)
    const totalElapsed = Date.now() - startTime;
    if (this.config.maxCost && totalElapsed > this.config.maxCost) {
      throw new HttpException(
        `Cost limit exceeded: total execution time ${totalElapsed}ms exceeds maximum of ${this.config.maxCost}ms`,
        HttpStatus.REQUEST_TIMEOUT
      );
    }

    return results;
  }

  /**
   * Execute a single query with timeout protection
   */
  private async executeQueryWithTimeout(
    alias: string,
    query: ComposeQuery,
    queryTimeout: number,
    batchStartTime: number,
    totalTimeout: number
  ): Promise<any> {
    return Promise.race([
      this.executeQuery(alias, query, batchStartTime, totalTimeout),
      this.createTimeoutPromise(queryTimeout, alias),
    ]);
  }

  /**
   * Create a timeout promise that rejects after specified time
   */
  private createTimeoutPromise(
    timeout: number,
    alias: string
  ): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new RequestTimeoutException(
            `Query "${alias}" timed out after ${timeout}ms`
          )
        );
      }, timeout);
    });
  }

  /**
   * Execute a single compose query
   * Each query runs in its own AsyncLocalStorage context
   */
  private async executeQuery(
    alias: string,
    query: ComposeQuery,
    batchStartTime: number,
    totalTimeout: number
  ): Promise<any> {
    // Resolve path via RouteRegistry
    const resolved = this.resolvePath(query.path);
    if (!resolved) {
      throw new HttpException(
        `Path "${query.path}" not found in registry`,
        HttpStatus.NOT_FOUND
      );
    }

    // Initialize AsyncLocalStorage context per query
    const queryContext = RequestContextUtil.createContext({
      requestId: `query-${alias}-${Date.now()}`,
      method: resolved.httpMethod,
      path: query.path,
      metadata: {
        alias,
        batchStartTime,
      },
    });

    // Execute query within its own context
    return this.requestContext.runAsync(queryContext, async () => {
      // Check max execution time
      const elapsed = Date.now() - batchStartTime;
      if (elapsed >= totalTimeout) {
        throw new RequestTimeoutException(
          `Maximum execution time of ${totalTimeout}ms exceeded during query "${alias}"`
        );
      }

      // Extract @fields from body if present
      const body = query.body || {};
      const operationFields = body["@fields"];
      const hadFields =
        operationFields && Array.isArray(operationFields) && operationFields.length > 0;

      if (hadFields) {
        // Store in context for FieldSelectionInterceptor to use
        FieldsContextHelper.setFields(
          this.requestContext,
          operationFields,
          this.config.maxFieldDepth
        );
      }

      // Apply request-level caching (deduplicates identical sub-queries)
      if (this.config.enableCaching) {
        // Merge all params
        const allParams = {
          ...resolved.route.params,
          ...query.params,
          ...query.query,
        };

        // Generate cache key: path + normalized body (excluding @fields) + field hash + params hash
        const cacheKey = this.requestCache.generateKey(
          query.path,
          body, // Body will be normalized, @fields excluded
          operationFields, // Fields will be hashed
          Object.keys(allParams).length > 0 ? allParams : undefined
        );

        const cached = await this.requestCache.get(cacheKey);
        if (cached !== undefined) {
          return cached;
        }
      }

      // Prepare method arguments
      const methodArgs = this.prepareMethodArgs(
        resolved.route.params,
        query.params,
        query.query,
        body
      );

      // Call mapped service or controller method directly using safe invoker
      // This ensures correct "this" binding and proper error handling
      const invocation = await this.methodInvoker.invoke(
        resolved.route,
        methodArgs,
        {
          metadata: {
            alias,
            path: query.path,
            httpMethod: resolved.httpMethod,
          },
        }
      );

      // Fail fast on errors
      if (!invocation.success) {
        throw new HttpException(
          invocation.message,
          invocation.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      let result = invocation.result;

      // Apply field selection if specified
      if (hadFields) {
        result = FieldSelector.selectFields(result, operationFields, {
          maxDepth: this.config.maxFieldDepth,
        });
      }

      // Cache result if enabled (deduplicates identical sub-queries)
      if (this.config.enableCaching) {
        // Merge all params
        const allParams = {
          ...resolved.route.params,
          ...query.params,
          ...query.query,
        };

        // Generate cache key: path + normalized body (excluding @fields) + field hash + params hash
        const cacheKey = this.requestCache.generateKey(
          query.path,
          body, // Body will be normalized, @fields excluded
          operationFields, // Fields will be hashed
          Object.keys(allParams).length > 0 ? allParams : undefined
        );
        
        await this.requestCache.set(cacheKey, result);
      }

      return result;
    });
  }

  /**
   * Resolve path via RouteRegistry
   * Tries all HTTP methods to find a match
   * @returns Resolved route with HTTP method, or null if not found
   */
  private resolvePath(
    path: string
  ): { route: any; httpMethod: string } | null {
    const httpMethods: Array<
      "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
    > = ["GET", "POST", "PUT", "PATCH", "DELETE"];

    for (const method of httpMethods) {
      const resolved = this.routeRegistry.resolve(path, method);
      if (resolved) {
        return { route: resolved, httpMethod: method };
      }
    }

    return null;
  }

  /**
   * Prepare method arguments from query parameters
   */
  private prepareMethodArgs(
    pathParams: Record<string, string>,
    queryParams?: Record<string, any>,
    query?: Record<string, any>,
    body?: any
  ): any[] {
    // Merge path params and query params
    const params = { ...pathParams, ...queryParams };

    // If there's a body, include it as an argument
    // Remove @fields from body (already extracted)
    if (body !== undefined && typeof body === "object" && body !== null) {
      const cleanBody = { ...body };
      delete cleanBody["@fields"];

      if (Object.keys(cleanBody).length > 0 || Object.keys(params).length > 0) {
        return [params, query, cleanBody].filter(
          (arg) => arg !== undefined && arg !== null
        );
      }
    }

    // For GET requests, merge params and query
    if (
      Object.keys(params).length > 0 ||
      (query && Object.keys(query).length > 0)
    ) {
      return [{ ...params, ...query }];
    }

    return [];
  }

  /**
   * Normalize error to consistent format
   */
  private normalizeError(error: any, alias: string): {
    error: string;
    statusCode: number;
  } {
    if (error instanceof HttpException) {
      return {
        error: error.message,
        statusCode: error.getStatus(),
      };
    }

    if (error instanceof RequestTimeoutException) {
      return {
        error: error.message,
        statusCode: HttpStatus.REQUEST_TIMEOUT,
      };
    }

    return {
      error: error?.message || `Query "${alias}" execution failed`,
      statusCode: error?.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
    };
  }
}
