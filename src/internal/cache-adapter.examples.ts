/**
 * Examples of implementing CacheAdapter interface
 * 
 * These examples show how to create pluggable cache adapters
 * for use with RequestCacheService.
 */

import { CacheAdapter } from "./cache-adapter.interface";

/**
 * Example 1: Redis Cache Adapter (interface implementation only)
 * 
 * This is a template showing how to implement the CacheAdapter interface
 * for Redis. The actual Redis client implementation would be provided
 * by the user.
 */
export class RedisCacheAdapter implements CacheAdapter {
  // Note: Redis client would be injected here
  // constructor(private readonly redis: RedisClient) {}

  async get(key: string): Promise<any> {
    // Example implementation:
    // const value = await this.redis.get(key);
    // return value ? JSON.parse(value) : undefined;
    throw new Error("Redis implementation not provided - implement this method");
  }

  async set(key: string, value: any): Promise<void> {
    // Example implementation:
    // await this.redis.set(key, JSON.stringify(value), 'EX', 60); // 60s TTL
    throw new Error("Redis implementation not provided - implement this method");
  }

  async has(key: string): Promise<boolean> {
    // Example implementation:
    // return (await this.redis.exists(key)) > 0;
    throw new Error("Redis implementation not provided - implement this method");
  }

  async delete(key: string): Promise<void> {
    // Example implementation:
    // await this.redis.del(key);
    throw new Error("Redis implementation not provided - implement this method");
  }

  async clear(): Promise<void> {
    // Example implementation:
    // await this.redis.flushdb();
    throw new Error("Redis implementation not provided - implement this method");
  }
}

/**
 * Example 2: In-Memory Cache Adapter (for testing)
 */
export class InMemoryCacheAdapter implements CacheAdapter {
  private cache = new Map<string, any>();

  get(key: string): any {
    return this.cache.get(key);
  }

  set(key: string, value: any): void {
    this.cache.set(key, value);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Example 3: Composite Cache Adapter (checks multiple caches)
 */
export class CompositeCacheAdapter implements CacheAdapter {
  constructor(private readonly adapters: CacheAdapter[]) {}

  async get(key: string): Promise<any> {
    // Check adapters in order, return first hit
    for (const adapter of this.adapters) {
      const value = await this.getFromAdapter(adapter, key);
      if (value !== undefined) {
        // Populate other adapters
        for (const otherAdapter of this.adapters) {
          if (otherAdapter !== adapter) {
            await this.setInAdapter(otherAdapter, key, value);
          }
        }
        return value;
      }
    }
    return undefined;
  }

  async set(key: string, value: any): Promise<void> {
    // Set in all adapters
    await Promise.all(
      this.adapters.map((adapter) => this.setInAdapter(adapter, key, value))
    );
  }

  async has(key: string): Promise<boolean> {
    // Check if any adapter has the key
    for (const adapter of this.adapters) {
      const exists = await this.hasInAdapter(adapter, key);
      if (exists) {
        return true;
      }
    }
    return false;
  }

  private async getFromAdapter(
    adapter: CacheAdapter,
    key: string
  ): Promise<any> {
    const result = adapter.get(key);
    return result instanceof Promise ? await result : result;
  }

  private async setInAdapter(
    adapter: CacheAdapter,
    key: string,
    value: any
  ): Promise<void> {
    const result = adapter.set(key, value);
    if (result instanceof Promise) {
      await result;
    }
  }

  private async hasInAdapter(
    adapter: CacheAdapter,
    key: string
  ): Promise<boolean> {
    const result = adapter.has(key);
    return result instanceof Promise ? await result : result;
  }
}

/**
 * Example 4: Using CacheAdapter in NestJS module
 * 
 * ```typescript
 * @Module({
 *   providers: [
 *     {
 *       provide: 'CACHE_ADAPTER',
 *       useClass: RedisCacheAdapter, // or InMemoryCacheAdapter for testing
 *     },
 *     RequestCacheService,
 *   ],
 * })
 * export class CacheModule {}
 * ```
 */

