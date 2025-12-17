import { Injectable, Scope, Optional, Inject } from "@nestjs/common";
import { RequestContextService } from "./request-context.service";
import { RequestContextUtil } from "./request-context.util";
import { CacheAdapter } from "./cache-adapter.interface";
import { generateCacheKey } from "./cache-key.util";

/**
 * Service for request-level caching using AsyncLocalStorage
 * 
 * Features:
 * - Cache stored in AsyncLocalStorage (RequestContext.cache)
 * - Deduplicates identical sub-queries within the same request
 * - Optional pluggable cache adapter (e.g., Redis)
 * - Automatic cleanup when request completes (zero memory leaks)
 * 
 * Cache key format: path:normalizedBodyHash:fieldHash:paramsHash
 * - path: Request path
 * - normalizedBodyHash: Hash of body excluding @fields
 * - fieldHash: Hash of @fields array
 * - paramsHash: Hash of path/query parameters
 */
@Injectable({ scope: Scope.REQUEST })
export class RequestCacheService {
  constructor(
    private readonly requestContext: RequestContextService,
    @Optional()
    @Inject("CACHE_ADAPTER")
    private readonly cacheAdapter?: CacheAdapter
  ) {}

  /**
   * Generate cache key from path, body, fields, and params
   * 
   * @param path Request path
   * @param body Request body (will be normalized, @fields excluded)
   * @param fields Field selection array
   * @param params Optional path/query parameters
   * @returns Cache key string
   */
  generateKey(
    path: string,
    body?: any,
    fields?: string[],
    params?: Record<string, any>
  ): string {
    return generateCacheKey(path, body, fields, params);
  }

  /**
   * Get value from cache
   * Checks both AsyncLocalStorage cache and optional adapter
   */
  async get<T = any>(key: string): Promise<T | undefined> {
    // First check AsyncLocalStorage cache (request-scoped)
    const contextCache = RequestContextUtil.getCache(this.requestContext);
    if (contextCache.has(key)) {
      return contextCache.get(key) as T | undefined;
    }

    // If adapter is provided, check it
    if (this.cacheAdapter) {
      const adapterValue = await this.getFromAdapter(key);
      if (adapterValue !== undefined) {
        // Store in context cache for subsequent requests
        contextCache.set(key, adapterValue);
        return adapterValue as T | undefined;
      }
    }

    return undefined;
  }

  /**
   * Set value in cache
   * Stores in both AsyncLocalStorage cache and optional adapter
   */
  async set(key: string, value: any): Promise<void> {
    // Store in AsyncLocalStorage cache (request-scoped)
    const contextCache = RequestContextUtil.getCache(this.requestContext);
    contextCache.set(key, value);

    // If adapter is provided, also store there
    if (this.cacheAdapter) {
      await this.setInAdapter(key, value);
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    // Check AsyncLocalStorage cache first
    const contextCache = RequestContextUtil.getCache(this.requestContext);
    if (contextCache.has(key)) {
      return true;
    }

    // If adapter is provided, check it
    if (this.cacheAdapter) {
      return await this.hasInAdapter(key);
    }

    return false;
  }

  /**
   * Clear cache (usually not needed as it's auto-cleared)
   */
  clear(): void {
    const contextCache = RequestContextUtil.getCache(this.requestContext);
    contextCache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    const contextCache = RequestContextUtil.getCache(this.requestContext);
    return contextCache.size;
  }

  /**
   * Get value from adapter (handles both sync and async)
   */
  private async getFromAdapter(key: string): Promise<any> {
    if (!this.cacheAdapter) {
      return undefined;
    }

    const result = this.cacheAdapter.get(key);
    return result instanceof Promise ? await result : result;
  }

  /**
   * Set value in adapter (handles both sync and async)
   */
  private async setInAdapter(key: string, value: any): Promise<void> {
    if (!this.cacheAdapter) {
      return;
    }

    const result = this.cacheAdapter.set(key, value);
    if (result instanceof Promise) {
      await result;
    }
  }

  /**
   * Check if key exists in adapter (handles both sync and async)
   */
  private async hasInAdapter(key: string): Promise<boolean> {
    if (!this.cacheAdapter) {
      return false;
    }

    const result = this.cacheAdapter.has(key);
    return result instanceof Promise ? await result : result;
  }
}
