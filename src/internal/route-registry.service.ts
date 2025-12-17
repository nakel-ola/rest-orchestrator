import { Injectable, Scope, Type } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";

/**
 * Handler type - distinguishes between service and controller handlers
 */
export type HandlerType = "service" | "controller";

/**
 * Handler metadata stored in the registry
 */
export interface HandlerMetadata {
  /**
   * Type of handler (service or controller)
   */
  type: HandlerType;

  /**
   * Class reference containing the method
   */
  handlerClass: Type<any>;

  /**
   * Method name to call
   */
  methodName: string;

  /**
   * HTTP method this route handles
   */
  httpMethod: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
}

/**
 * Route entry in the registry
 */
export interface RouteEntry {
  /**
   * Path pattern (supports :param syntax)
   */
  path: string;

  /**
   * Handler metadata
   */
  handler: HandlerMetadata;
}

/**
 * Resolved route with instance and extracted parameters
 */
export interface ResolvedRoute {
  /**
   * Handler metadata
   */
  metadata: HandlerMetadata;

  /**
   * Resolved instance of the handler class
   */
  instance: any;

  /**
   * Extracted path parameters
   */
  params: Record<string, string>;
}

/**
 * Validation error for route registration
 */
export class RouteRegistryError extends Error {
  constructor(
    message: string,
    public readonly path?: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "RouteRegistryError";
  }
}

/**
 * RouteRegistry - manages route-to-handler mappings with validation
 */
@Injectable({ scope: Scope.DEFAULT })
export class RouteRegistry {
  private readonly routes = new Map<string, HandlerMetadata>();
  private readonly pathPatterns: Array<{ pattern: string; metadata: HandlerMetadata }> = [];
  private initialized = false;

  constructor(private readonly moduleRef: ModuleRef) {}

  /**
   * Register routes with validation
   * @param entries Route entries to register
   * @throws RouteRegistryError if validation fails
   */
  register(entries: RouteEntry[]): void {
    if (this.initialized) {
      throw new RouteRegistryError(
        "RouteRegistry has already been initialized. Cannot register additional routes.",
        undefined,
        "ALREADY_INITIALIZED"
      );
    }

    const duplicatePaths = new Set<string>();
    const seenPaths = new Set<string>();

    for (const entry of entries) {
      this.validateRouteEntry(entry);

      // Check for duplicate paths (same path + HTTP method combination)
      const routeKey = this.getRouteKey(entry.path, entry.handler.httpMethod);
      if (seenPaths.has(routeKey)) {
        duplicatePaths.add(routeKey);
        continue;
      }
      seenPaths.add(routeKey);

      // Store exact path match
      this.routes.set(routeKey, entry.handler);

      // Store pattern for parameterized routes
      if (this.hasPathParameters(entry.path)) {
        this.pathPatterns.push({
          pattern: entry.path,
          metadata: entry.handler,
        });
      }
    }

    if (duplicatePaths.size > 0) {
      const duplicates = Array.from(duplicatePaths).join(", ");
      throw new RouteRegistryError(
        `Duplicate route registrations found: ${duplicates}`,
        undefined,
        "DUPLICATE_ROUTES"
      );
    }

    // Validate all handlers exist and are callable
    this.validateHandlers(entries);

    this.initialized = true;
  }

  /**
   * Resolve a path to a handler
   * @param path Request path
   * @param httpMethod HTTP method
   * @returns Resolved route or null if not found
   */
  resolve(path: string, httpMethod: string): ResolvedRoute | null {
    if (!this.initialized) {
      throw new RouteRegistryError(
        "RouteRegistry has not been initialized. Call register() first.",
        undefined,
        "NOT_INITIALIZED"
      );
    }

    // Try exact match first
    const routeKey = this.getRouteKey(path, httpMethod);
    const exactMatch = this.routes.get(routeKey);
    if (exactMatch) {
      const instance = this.getInstance(exactMatch);
      if (!instance) {
        return null;
      }
      return {
        metadata: exactMatch,
        instance,
        params: {},
      };
    }

    // Try pattern matching for parameterized routes
    for (const { pattern, metadata } of this.pathPatterns) {
      if (metadata.httpMethod !== httpMethod) {
        continue;
      }

      const params = this.matchPath(pattern, path);
      if (params !== null) {
        const instance = this.getInstance(metadata);
        if (!instance) {
          continue;
        }
        return {
          metadata,
          instance,
          params,
        };
      }
    }

    return null;
  }

  /**
   * Check if a route exists
   * @param path Request path
   * @param httpMethod HTTP method
   * @returns True if route exists
   */
  has(path: string, httpMethod: string): boolean {
    return this.resolve(path, httpMethod) !== null;
  }

  /**
   * Get all registered routes (read-only)
   * @returns Array of route entries
   */
  getAllRoutes(): ReadonlyArray<RouteEntry> {
    const entries: RouteEntry[] = [];

    // Collect exact paths
    for (const [routeKey, metadata] of this.routes.entries()) {
      const [path, httpMethod] = this.parseRouteKey(routeKey);
      entries.push({ path, handler: metadata });
    }

    return entries;
  }

  /**
   * Get route count
   * @returns Number of registered routes
   */
  size(): number {
    return this.routes.size;
  }

  /**
   * Clear all routes (for testing)
   */
  clear(): void {
    this.routes.clear();
    this.pathPatterns.length = 0;
    this.initialized = false;
  }

  /**
   * Validate a single route entry
   */
  private validateRouteEntry(entry: RouteEntry): void {
    // Validate path
    if (!entry.path || typeof entry.path !== "string") {
      throw new RouteRegistryError(
        "Route path must be a non-empty string",
        entry.path,
        "INVALID_PATH"
      );
    }

    if (!entry.path.startsWith("/")) {
      throw new RouteRegistryError(
        `Route path must start with '/': ${entry.path}`,
        entry.path,
        "INVALID_PATH_FORMAT"
      );
    }

    // Validate handler class
    if (!entry.handler.handlerClass) {
      throw new RouteRegistryError(
        "Handler class is required",
        entry.path,
        "MISSING_HANDLER_CLASS"
      );
    }

    // Validate method name
    if (!entry.handler.methodName || typeof entry.handler.methodName !== "string") {
      throw new RouteRegistryError(
        "Handler method name must be a non-empty string",
        entry.path,
        "INVALID_METHOD_NAME"
      );
    }

    // Validate handler type
    if (!["service", "controller"].includes(entry.handler.type)) {
      throw new RouteRegistryError(
        `Handler type must be 'service' or 'controller', got: ${entry.handler.type}`,
        entry.path,
        "INVALID_HANDLER_TYPE"
      );
    }

    // Validate HTTP method
    const validHttpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
    if (!validHttpMethods.includes(entry.handler.httpMethod)) {
      throw new RouteRegistryError(
        `HTTP method must be one of: ${validHttpMethods.join(", ")}, got: ${entry.handler.httpMethod}`,
        entry.path,
        "INVALID_HTTP_METHOD"
      );
    }
  }

  /**
   * Validate that all handlers exist and are callable
   */
  private validateHandlers(entries: RouteEntry[]): void {
    const errors: string[] = [];

    for (const entry of entries) {
      try {
        const instance = this.moduleRef.get(entry.handler.handlerClass, {
          strict: false,
        });

        if (!instance) {
          errors.push(
            `Handler class ${entry.handler.handlerClass.name} not found in module for path: ${entry.path}`
          );
          continue;
        }

        const method = instance[entry.handler.methodName];
        if (typeof method !== "function") {
          errors.push(
            `Method '${entry.handler.methodName}' not found or not callable on ${entry.handler.handlerClass.name} for path: ${entry.path}`
          );
        }
      } catch (error) {
        errors.push(
          `Failed to resolve handler ${entry.handler.handlerClass.name} for path: ${entry.path}. Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    if (errors.length > 0) {
      throw new RouteRegistryError(
        `Handler validation failed:\n${errors.join("\n")}`,
        undefined,
        "HANDLER_VALIDATION_FAILED"
      );
    }
  }

  /**
   * Get instance of handler class
   */
  private getInstance(metadata: HandlerMetadata): any | null {
    try {
      return this.moduleRef.get(metadata.handlerClass, { strict: false });
    } catch {
      return null;
    }
  }

  /**
   * Check if path has parameters
   */
  private hasPathParameters(path: string): boolean {
    return path.includes(":");
  }

  /**
   * Match path pattern against actual path
   */
  private matchPath(
    pattern: string,
    actualPath: string
  ): Record<string, string> | null {
    const patternParts = pattern.split("/");
    const actualParts = actualPath.split("/");

    if (patternParts.length !== actualParts.length) {
      return null;
    }

    const params: Record<string, string> = {};

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const actualPart = actualParts[i];

      if (patternPart.startsWith(":")) {
        const paramName = patternPart.slice(1);
        if (!paramName) {
          return null; // Invalid parameter name
        }
        params[paramName] = actualPart;
      } else if (patternPart !== actualPart) {
        return null;
      }
    }

    return params;
  }

  /**
   * Generate route key for exact matching
   */
  private getRouteKey(path: string, httpMethod: string): string {
    return `${httpMethod}:${path}`;
  }

  /**
   * Parse route key back to path and HTTP method
   */
  private parseRouteKey(routeKey: string): [string, string] {
    const [httpMethod, ...pathParts] = routeKey.split(":");
    return [pathParts.join(":"), httpMethod];
  }
}

