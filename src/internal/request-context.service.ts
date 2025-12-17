import { Injectable, Scope } from "@nestjs/common";
import { AsyncLocalStorage } from "async_hooks";
import { RequestContext } from "./request-context.interface";

/**
 * Service for managing request-scoped context using AsyncLocalStorage
 * 
 * Features:
 * - Zero memory leaks (context automatically cleaned up after request)
 * - Type-safe access to context data
 * - Automatic initialization for HTTP requests
 * - Manual initialization for /compose sub-requests
 */
@Injectable({ scope: Scope.DEFAULT })
export class RequestContextService {
  private readonly asyncLocalStorage =
    new AsyncLocalStorage<RequestContext>();

  /**
   * Run callback within a request context
   * Context is automatically cleaned up after callback completes
   * 
   * @param context The request context
   * @param callback Function to execute within context
   * @returns Result of callback
   */
  run<T>(context: RequestContext, callback: () => T): T {
    return this.asyncLocalStorage.run(context, () => {
      try {
        return callback();
      } finally {
        // Cleanup: clear cache to prevent memory leaks
        context.cache.clear();
      }
    });
  }

  /**
   * Run async callback within a request context
   * Context is automatically cleaned up after callback completes
   * 
   * @param context The request context
   * @param callback Async function to execute within context
   * @returns Promise resolving to result of callback
   */
  async runAsync<T>(
    context: RequestContext,
    callback: () => Promise<T>
  ): Promise<T> {
    return this.asyncLocalStorage.run(context, async () => {
      try {
        return await callback();
      } finally {
        // Cleanup: clear cache to prevent memory leaks
        context.cache.clear();
      }
    });
  }

  /**
   * Get the current request context
   * @returns Current context or undefined if not in a request
   */
  getContext(): RequestContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Check if we're currently in a request context
   * @returns True if context exists
   */
  hasContext(): boolean {
    return this.asyncLocalStorage.getStore() !== undefined;
  }

  /**
   * Get a value from context by key
   * @param key Key to get
   * @returns Value or undefined
   */
  get<T = any>(key: keyof RequestContext): T | undefined {
    const context = this.asyncLocalStorage.getStore();
    return context?.[key] as T | undefined;
  }

  /**
   * Set a value in context
   * @param key Key to set
   * @param value Value to set
   */
  set<K extends keyof RequestContext>(
    key: K,
    value: RequestContext[K]
  ): void {
    const context = this.asyncLocalStorage.getStore();
    if (context) {
      context[key] = value;
    }
  }

  /**
   * Check if a key exists in context
   * @param key Key to check
   * @returns True if key exists
   */
  has(key: keyof RequestContext): boolean {
    const context = this.asyncLocalStorage.getStore();
    return context ? key in context : false;
  }

  /**
   * Get the cache Map from context
   * @returns Cache Map or undefined
   */
  getCache(): Map<string, any> | undefined {
    return this.get("cache");
  }

  /**
   * Get fields context
   * @returns Fields context or undefined
   */
  getFields() {
    return this.get<RequestContext["fields"]>("fields");
  }

  /**
   * Set fields context
   * @param fields Fields context
   */
  setFields(fields: RequestContext["fields"]): void {
    this.set("fields", fields);
  }

  /**
   * Get request start time
   * @returns Start time in milliseconds
   */
  getStartTime(): number | undefined {
    return this.get("startTime");
  }

  /**
   * Get request duration in milliseconds
   * @returns Duration or undefined if start time not available
   */
  getDuration(): number | undefined {
    const startTime = this.getStartTime();
    if (startTime === undefined) {
      return undefined;
    }
    return Date.now() - startTime;
  }
}
