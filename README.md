# rest-orchestrator

> GraphQL-like batching and field selection for REST APIs in NestJS

`rest-orchestrator` brings GraphQL's powerful batching and field selection capabilities to REST APIs without introducing resolvers, schema languages, or requiring modifications to existing controllers and services.

## Features

- 🚀 **GraphQL-like Batching**: Batch multiple API calls into a single `/compose` request
- 🎯 **Field Selection**: Select only the fields you need using `@fields` in request body
- ⚡ **Zero Overhead**: Direct method invocation - no HTTP calls, no reflection hacks
- 🔄 **Request-Level Caching**: Automatic deduplication of identical queries within a request
- 🛡️ **Safety Guards**: Configurable limits for queries, execution time, payload size, and per-route calls
- 📦 **Type-Safe**: Full TypeScript support with comprehensive interfaces
- 🔌 **Pluggable Cache**: Optional Redis adapter interface for distributed caching
- 🧩 **Modular Design**: Use field selection, composition, or both independently

## Installation

```bash
npm install rest-orchestrator
```

## Quick Start

### Usage Pattern 1: FieldsModule Only (Field Selection)

Enable field selection for normal REST endpoints:

```typescript
import { Module } from "@nestjs/common";
import { FieldsModule } from "rest-orchestrator";

@Module({
  imports: [
    FieldsModule.forRoot({
      maxFieldDepth: 10, // Optional: default is 10
    }),
  ],
})
export class AppModule {}
```

Use `@fields` in request body:

```typescript
// POST /user/me
// Body: { "@fields": ["id", "email", "name", "profile.bio"] }

// Response: Only selected fields are returned
{
  "id": "user-123",
  "email": "john@example.com",
  "name": "John Doe",
  "profile": {
    "bio": "Software developer"
  }
}
```

**Note:** `/compose` endpoint is NOT available with FieldsModule only.

### Usage Pattern 2: ComposeModule Only (REST Composition)

Enable REST composition for batching queries:

```typescript
import { Module } from "@nestjs/common";
import { ComposeModule } from "rest-orchestrator";
import { UserService } from "./user.service";

@Module({
  imports: [
    ComposeModule.forRoot({
      routes: [
        {
          path: "/user/me",
          handler: {
            handler: UserService,
            method: "findAuthUser",
            httpMethod: "GET",
          },
        },
        {
          path: "/users/:id",
          handler: {
            handler: UserService,
            method: "findById",
            httpMethod: "GET",
          },
        },
      ],
    }),
  ],
  providers: [UserService],
})
export class AppModule {}
```

Batch multiple queries:

```typescript
// POST /compose
// Body:
{
  "queries": {
    "user": {
      "path": "/user/me"
    },
    "posts": {
      "path": "/posts"
    }
  }
}

// Response:
{
  "user": {
    "id": "user-123",
    "email": "john@example.com",
    "name": "John Doe"
  },
  "posts": [
    { "id": "post-1", "title": "First Post" },
    { "id": "post-2", "title": "Second Post" }
  ]
}
```

**Note:** `@fields` feature is NOT available with ComposeModule only. If you try to use `@fields` in a compose query, you'll get a clear error message.

### Usage Pattern 3: Both Modules Together (Recommended)

Enable both field selection and REST composition:

```typescript
import { Module } from "@nestjs/common";
import { FieldsModule, ComposeModule } from "rest-orchestrator";
import { UserService } from "./user.service";

@Module({
  imports: [
    FieldsModule.forRoot({
      maxFieldDepth: 10,
    }),
    ComposeModule.forRoot({
      routes: [
        {
          path: "/user/me",
          handler: {
            handler: UserService,
            method: "findAuthUser",
            httpMethod: "GET",
          },
        },
      ],
    }),
  ],
  providers: [UserService],
})
export class AppModule {}
```

Now you can use both features:

```typescript
// 1. Normal endpoint with @fields
// POST /user/me
// Body: { "@fields": ["id", "email", "name"] }

// 2. /compose with @fields
// POST /compose
// Body:
{
  "queries": {
    "user": {
      "path": "/user/me",
      "body": {
        "@fields": ["id", "email", "name"]
      }
    }
  }
}
```

## API Reference

### FieldsModule

Optional module for field selection feature.

#### `FieldsModule.forRoot(options?: FieldsModuleOptions)`

**Options:**

```typescript
interface FieldsModuleOptions {
  maxFieldDepth?: number; // Max field selection depth (default: 10)
}
```

**When to use:**

- You want field selection on normal REST endpoints
- You want to reduce payload sizes by selecting only needed fields
- You don't need the `/compose` batching feature

### ComposeModule

Main module for REST composition and batching.

#### `ComposeModule.forRoot(options: ComposeModuleOptions)`

**Options:**

```typescript
interface ComposeModuleOptions {
  // Required: Route registrations
  routes: RouteRegistration[];

  // Optional: Safety guards
  maxBatchSize?: number; // Max queries per request (default: 50)
  maxExecutionTimeMs?: number; // Max execution time in ms (default: 60000)
  maxPayloadSize?: number; // Max payload size in bytes (default: 1048576)
  perRouteCallLimit?: number; // Max calls per route (default: 10)
  enableCaching?: boolean; // Enable request-level caching (default: true)
}
```

**Route Registration:**

```typescript
interface RouteRegistration {
  path: string; // Path pattern (supports :param)
  handler: {
    handler: Type<any>; // Service or Controller class
    method: string; // Method name
    httpMethod: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  };
}
```

**When to use:**

- You want to batch multiple API calls into a single request
- You want request-level caching and deduplication
- You may or may not need field selection (install FieldsModule separately if needed)

### Field Selection

Use `@fields` in the request body to select specific fields. **Requires FieldsModule to be installed.**

```typescript
// Request body
{
  "@fields": [
    "id",
    "email",
    "profile.bio",           // Nested field
    "posts.id",              // Array field
    "posts.title",
    "profile.settings.theme" // Deep nesting
  ]
}
```

**Rules:**

- `@fields` must be an array of strings
- Supports dot notation for nested fields
- Automatically removed from body before reaching service/controller
- Applied to response automatically
- **Must have FieldsModule installed** - otherwise you'll get `FieldsFeatureNotEnabledError`

### Compose Endpoint

**Endpoint:** `POST /compose` (requires ComposeModule)

**Request Format:**

```typescript
{
  "queries": {
    "alias": {
      "path": "/user/me",              // Required: Registered path
      "body": {                         // Optional: Request body
        "@fields": ["id", "name"]      // Optional: Requires FieldsModule
      },
      "params": {                       // Optional: Path parameters
        "id": "user-123"
      },
      "query": {                        // Optional: Query parameters
        "page": 1
      }
    }
  }
}
```

**Response Format:**

```typescript
{
  "alias": {
    // Success: Result data
    "id": "user-123",
    "name": "John Doe"
  },
  "anotherAlias": {
    // Error: Error object
    "error": "Path not found",
    "statusCode": 404
  }
}
```

## Advanced Features

### Request-Level Caching

Identical queries within a single `/compose` request are automatically deduplicated:

```typescript
// This will only execute /user/me once, even though it's requested twice
{
  "queries": {
    "user1": { "path": "/user/me", "body": { "@fields": ["id"] } },
    "user2": { "path": "/user/me", "body": { "@fields": ["id"] } }
  }
}
```

Cache key format: `path:normalizedBodyHash:fieldHash:paramsHash`

### Shared AsyncLocalStorage Context

All requests share an AsyncLocalStorage context that includes:

- Request ID
- Start time
- Per-request cache (for automatic deduplication)
- Selected fields (if FieldsModule is installed)
- Request metadata

The context is automatically managed by rest-orchestrator. The request-level cache is used internally for deduplication of identical queries within a `/compose` request.

### Pluggable Cache Adapter

Implement a custom cache adapter for distributed caching (e.g., Redis). The adapter interface is available in the internal API:

```typescript
// Note: CacheAdapter is an internal interface
// You can implement it based on the interface definition
interface CacheAdapter {
  get(key: string): Promise<any> | any;
  set(key: string, value: any): Promise<void> | void;
  has(key: string): Promise<boolean> | boolean;
  delete?(key: string): Promise<void> | void;
  clear?(): Promise<void> | void;
}

class RedisCacheAdapter implements CacheAdapter {
  async get(key: string): Promise<any> {
    // Implement Redis get
  }

  async set(key: string, value: any): Promise<void> {
    // Implement Redis set
  }

  async has(key: string): Promise<boolean> {
    // Implement Redis exists
  }
}

// Register in your module
@Module({
  providers: [
    {
      provide: "CACHE_ADAPTER",
      useClass: RedisCacheAdapter,
    },
  ],
})
export class CacheModule {}
```

## Safety Guards

All safety guards are configurable and fail-fast with clear error messages:

### maxBatchSize

Maximum number of queries per `/compose` request.

```typescript
// Error if exceeded:
// "Query count exceeds maximum of 50. Received 60 queries."
```

### maxExecutionTimeMs

Maximum execution time for the entire `/compose` request.

```typescript
// Error if exceeded:
// "Maximum execution time of 60000ms exceeded before executing query \"alias\""
```

### maxPayloadSize

Maximum request payload size in bytes.

```typescript
// Error if exceeded:
// "Request payload size 2097152 bytes exceeds maximum of 1048576 bytes"
// Status: 413 Payload Too Large
```

### perRouteCallLimit

Maximum number of times a single route can be called within one `/compose` request.

```typescript
// Error if exceeded:
// "Per-route call limit exceeded: route \"/user/me\" has been called 11 times, exceeding the limit of 10 calls per compose request"
// Status: 429 Too Many Requests
```

## Error Handling

### Validation Errors

Invalid request format returns `400 Bad Request`:

```json
{
  "statusCode": 400,
  "message": "Query \"alias\" must have a 'path' property",
  "error": "Bad Request"
}
```

### FieldsFeatureNotEnabledError

If you try to use `@fields` without FieldsModule installed:

```json
{
  "statusCode": 500,
  "message": "The \"@fields\" feature is being used but FieldsModule is not installed.\n\nFix:\n  import { FieldsModule } from \"rest-orchestrator\";\n  FieldsModule.forRoot()",
  "error": "FieldsFeatureNotEnabledError"
}
```

**Fix:** Install FieldsModule:

```typescript
@Module({
  imports: [
    FieldsModule.forRoot(),
    ComposeModule.forRoot({ routes: [...] }),
  ],
})
export class AppModule {}
```

### Query Errors

Failed queries are included in the response:

```json
{
  "user": {
    "id": "user-123",
    "name": "John Doe"
  },
  "posts": {
    "error": "Path \"/posts\" not found in registry",
    "statusCode": 404
  }
}
```

### Timeout Errors

Query or request timeouts return `408 Request Timeout`:

```json
{
  "statusCode": 408,
  "message": "Query \"alias\" timed out after 30000ms",
  "error": "Request Timeout"
}
```

## Best Practices

### 1. Choose the Right Module Combination

- **FieldsModule only**: When you only need field selection on normal endpoints
- **ComposeModule only**: When you only need batching without field selection
- **Both modules**: When you need both features (recommended for full functionality)

### 2. Register All Routes at Startup

Register all routes in `ComposeModule.forRoot()` to ensure validation at startup:

```typescript
ComposeModule.forRoot({
  routes: [
    // All your routes here
  ],
});
```

### 3. Use Field Selection Sparingly

Field selection adds processing overhead. Use it when you need to reduce payload size:

```typescript
// Good: Selecting only needed fields
{ "@fields": ["id", "name"] }

// Avoid: Selecting all fields (just omit @fields)
{ "@fields": ["id", "name", "email", "profile", "posts", ...] }
```

### 4. Leverage Request-Level Caching

Identical queries are automatically cached. Structure your queries to take advantage:

```typescript
// These will be deduplicated
{
  "queries": {
    "user1": { "path": "/user/me", "body": { "@fields": ["id"] } },
    "user2": { "path": "/user/me", "body": { "@fields": ["id"] } }
  }
}
```

### 5. Set Appropriate Safety Guards

Configure guards based on your application's needs:

```typescript
ComposeModule.forRoot({
  routes: [...],
  maxBatchSize: 20,              // Lower for stricter control
  maxExecutionTimeMs: 30000,      // 30 seconds
  maxPayloadSize: 512000,         // 500 KB
  perRouteCallLimit: 5,           // Prevent abuse
})
```

### 6. Handle Errors Gracefully

Always check for errors in `/compose` responses:

```typescript
const response = await fetch("/compose", {
  method: "POST",
  body: JSON.stringify({ queries: {...} }),
});

const data = await response.json();

// Check for errors
if (data.user?.error) {
  console.error("User query failed:", data.user.error);
}
```

## Migration Guide

If you were previously using `ComposeModule` with `maxFieldDepth`:

**OLD:**

```typescript
ComposeModule.forRoot({
  routes: [...],
  maxFieldDepth: 10,  // ❌ This option no longer exists
})
```

**NEW:**

```typescript
FieldsModule.forRoot({
  maxFieldDepth: 10,  // ✅ Now in FieldsModule
}),
ComposeModule.forRoot({
  routes: [...],
  // maxFieldDepth removed
})
```

## Examples

See [`examples/basic-usage.example.ts`](./examples/basic-usage.example.ts) for complete examples of all three usage patterns.

## Architecture

### How It Works

1. **Route Registration**: Routes are registered at startup and validated (ComposeModule)
2. **Field Interceptor**: Extracts and validates `@fields` from request body (FieldsModule)
3. **Field Selection Interceptor**: Applies field selection to responses (FieldsModule)
4. **Compose Controller**: Handles `/compose` endpoint, validates requests (ComposeModule)
5. **Compose Service**: Executes queries in parallel, applies caching, enforces limits (ComposeModule)
6. **Request Context**: Shared AsyncLocalStorage context across all operations (Core)

### Module Dependencies

```
ContextModule (core)
  ├── RequestContextService (AsyncLocalStorage)
  └── RequestContextMiddleware

FieldsModule
  ├── depends on: ContextModule
  ├── FieldsInterceptor (APP_INTERCEPTOR)
  ├── FieldSelectionInterceptor (APP_INTERCEPTOR)
  └── exports: FieldsContextHelper, FieldSelector

ComposeModule
  ├── depends on: ContextModule
  ├── ComposeController
  ├── ComposeService
  └── (does NOT depend on FieldsModule)
```

### Direct Method Invocation

Unlike GraphQL resolvers, rest-orchestrator calls service/controller methods directly:

```typescript
// No HTTP calls, no reflection hacks
const result = await serviceMethod.apply(serviceInstance, args);
```

This ensures:

- ✅ Performance equal to or better than naive REST
- ✅ No network overhead
- ✅ Type safety preserved
- ✅ Existing code unchanged

## Limitations

- **No Dynamic URLs**: Only registered paths can be used in `/compose`
- **No HTTP Calls**: All queries must be registered routes (no external APIs)
- **Synchronous Execution**: Queries execute in parallel but within the same process
- **Request-Scoped Cache**: Cache is cleared after each request (use adapter for persistence)
- **Field Selection Requires FieldsModule**: `@fields` feature must be explicitly enabled

## Contributing

Contributions are welcome! Please read our contributing guidelines first.

## License

MIT

## Support

For issues, questions, or contributions, please open an issue on GitHub.
