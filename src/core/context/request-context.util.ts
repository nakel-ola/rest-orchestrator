import { RequestContextService } from "./request-context.service";
import { RequestContext } from "./request-context.interface";

/**
 * Utility functions for type-safe access to request context
 * 
 * These utilities provide convenient, type-safe access to context data
 * without needing to directly access the RequestContextService.
 */
export class RequestContextUtil {
  /**
   * Create a new request context
   * @param options Optional context options
   * @returns New RequestContext instance
   */
  static createContext(options?: {
    requestId?: string;
    method?: string;
    path?: string;
    metadata?: Record<string, any>;
  }): RequestContext {
    return {
      startTime: Date.now(),
      cache: new Map<string, any>(),
      requestId: options?.requestId,
      method: options?.method,
      path: options?.path,
      metadata: options?.metadata,
    };
  }

  /**
   * Get the current request context
   * @param service RequestContextService instance
   * @returns Current context or undefined
   */
  static getContext(
    service: RequestContextService
  ): RequestContext | undefined {
    return service.getContext();
  }

  /**
   * Get the cache Map from context
   * @param service RequestContextService instance
   * @returns Cache Map (creates empty Map if context doesn't exist)
   */
  static getCache(service: RequestContextService): Map<string, any> {
    const cache = service.getCache();
    if (!cache) {
      // This shouldn't happen in normal flow, but provide fallback
      return new Map();
    }
    return cache;
  }

  /**
   * Get fields from context
   * @param service RequestContextService instance
   * @returns Fields context or undefined
   */
  static getFields(service: RequestContextService): any {
    return service.getFields();
  }

  /**
   * Set fields in context
   * @param service RequestContextService instance
   * @param fields Fields context
   */
  static setFields(service: RequestContextService, fields: any): void {
    service.setFields(fields);
  }

  /**
   * Get request start time
   * @param service RequestContextService instance
   * @returns Start time in milliseconds or undefined
   */
  static getStartTime(service: RequestContextService): number | undefined {
    return service.getStartTime();
  }

  /**
   * Get request duration
   * @param service RequestContextService instance
   * @returns Duration in milliseconds or undefined
   */
  static getDuration(service: RequestContextService): number | undefined {
    return service.getDuration();
  }

  /**
   * Check if context exists
   * @param service RequestContextService instance
   * @returns True if context exists
   */
  static hasContext(service: RequestContextService): boolean {
    return service.hasContext();
  }

  /**
   * Generate a cache key for request caching
   * @param parts Parts to include in the key
   * @returns Cache key string
   */
  static generateCacheKey(...parts: (string | number | undefined)[]): string {
    return parts
      .filter((part) => part !== undefined && part !== null)
      .map((part) => String(part))
      .join(":");
  }

  /**
   * Get or create cache entry
   * @param service RequestContextService instance
   * @param key Cache key
   * @param factory Function to create value if not cached
   * @returns Cached or newly created value
   */
  static getOrSet<T>(
    service: RequestContextService,
    key: string,
    factory: () => T
  ): T {
    const cache = this.getCache(service);
    if (cache.has(key)) {
      return cache.get(key) as T;
    }
    const value = factory();
    cache.set(key, value);
    return value;
  }
}

