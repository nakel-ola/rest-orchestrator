/**
 * Interface for pluggable cache adapters
 * 
 * Allows external cache implementations (e.g., Redis) to be used
 * alongside the default in-memory AsyncLocalStorage cache.
 * 
 * @example
 * ```typescript
 * class RedisCacheAdapter implements CacheAdapter {
 *   async get(key: string): Promise<any> {
 *     return await this.redis.get(key);
 *   }
 *   
 *   async set(key: string, value: any): Promise<void> {
 *     await this.redis.set(key, JSON.stringify(value));
 *   }
 *   
 *   async has(key: string): Promise<boolean> {
 *     return await this.redis.exists(key) > 0;
 *   }
 * }
 * ```
 */
export interface CacheAdapter {
  /**
   * Get a value from cache
   * @param key Cache key
   * @returns Cached value or undefined if not found
   */
  get(key: string): Promise<any> | any;

  /**
   * Set a value in cache
   * @param key Cache key
   * @param value Value to cache
   */
  set(key: string, value: any): Promise<void> | void;

  /**
   * Check if a key exists in cache
   * @param key Cache key
   * @returns True if key exists
   */
  has(key: string): Promise<boolean> | boolean;

  /**
   * Delete a key from cache
   * @param key Cache key
   */
  delete?(key: string): Promise<void> | void;

  /**
   * Clear all cache entries
   */
  clear?(): Promise<void> | void;
}

