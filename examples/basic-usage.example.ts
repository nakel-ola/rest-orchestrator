/**
 * End-to-End Example: rest-orchestrator
 *
 * This example demonstrates three usage patterns:
 * 1. FieldsModule only (field selection for normal endpoints)
 * 2. ComposeModule only (REST composition without fields)
 * 3. Both modules together (REST composition with field selection)
 */

import { Module, Controller, Get, Injectable } from "@nestjs/common";
import { ComposeModule, FieldsModule } from "../src";

// ============================================================================
// 1. Define Services/Controllers
// ============================================================================

/**
 * User Service - Example service with methods that can be orchestrated
 */
@Injectable()
export class UserService {
  /**
   * Get current authenticated user
   * This method will be registered as /user/me
   */
  findAuthUser(): {
    id: string;
    email: string;
    name: string;
    profile: {
      bio: string;
      avatar: string;
      settings: {
        theme: string;
        notifications: boolean;
      };
    };
    posts: Array<{
      id: string;
      title: string;
      content: string;
      author: {
        id: string;
        name: string;
      };
    }>;
  } {
    return {
      id: "user-123",
      email: "john@example.com",
      name: "John Doe",
      profile: {
        bio: "Software developer",
        avatar: "https://example.com/avatar.jpg",
        settings: {
          theme: "dark",
          notifications: true,
        },
      },
      posts: [
        {
          id: "post-1",
          title: "My First Post",
          content: "This is my first post content...",
          author: {
            id: "user-123",
            name: "John Doe",
          },
        },
        {
          id: "post-2",
          title: "My Second Post",
          content: "This is my second post content...",
          author: {
            id: "user-123",
            name: "John Doe",
          },
        },
      ],
    };
  }

  /**
   * Get user by ID
   * This method will be registered as /users/:id
   */
  findById(params: { id: string }): {
    id: string;
    email: string;
    name: string;
    createdAt: string;
  } {
    return {
      id: params.id,
      email: `user${params.id}@example.com`,
      name: `User ${params.id}`,
      createdAt: "2024-01-01T00:00:00Z",
    };
  }
}

/**
 * Post Service - Another service for demonstration
 */
@Injectable()
export class PostService {
  /**
   * Get all posts
   * This method will be registered as /posts
   */
  findAll(): Array<{
    id: string;
    title: string;
    content: string;
    authorId: string;
    comments: Array<{
      id: string;
      text: string;
      author: {
        id: string;
        name: string;
      };
    }>;
  }> {
    return [
      {
        id: "post-1",
        title: "First Post",
        content: "Content of first post",
        authorId: "user-123",
        comments: [
          {
            id: "comment-1",
            text: "Great post!",
            author: {
              id: "user-456",
              name: "Jane Smith",
            },
          },
        ],
      },
      {
        id: "post-2",
        title: "Second Post",
        content: "Content of second post",
        authorId: "user-123",
        comments: [],
      },
    ];
  }

  /**
   * Get post by ID
   * This method will be registered as /posts/:id
   */
  findById(params: { id: string }): {
    id: string;
    title: string;
    content: string;
    authorId: string;
    publishedAt: string;
  } {
    return {
      id: params.id,
      title: `Post ${params.id}`,
      content: `Content for post ${params.id}`,
      authorId: "user-123",
      publishedAt: "2024-01-15T10:00:00Z",
    };
  }
}

/**
 * Stats Controller - Example controller
 */
@Controller("stats")
export class StatsController {
  /**
   * Get application statistics
   * This method will be registered as /stats
   */
  @Get()
  getStats(): {
    totalUsers: number;
    totalPosts: number;
    activeUsers: number;
  } {
    return {
      totalUsers: 1000,
      totalPosts: 5000,
      activeUsers: 250,
    };
  }
}

// ============================================================================
// 2. Usage Pattern 1: FieldsModule Only
// ============================================================================

/**
 * Example: Using only FieldsModule for field selection on normal endpoints
 *
 * This enables @fields feature for regular REST endpoints but does NOT
 * provide the /compose endpoint.
 */
@Module({
  imports: [
    FieldsModule.forRoot({
      maxFieldDepth: 10, // Optional: default is 10
    }),
  ],
  providers: [UserService, PostService],
  controllers: [StatsController],
})
export class FieldsOnlyModule {}

/**
 * Usage with FieldsModule only:
 *
 * POST /user/me
 * Body: { "@fields": ["id", "email", "name", "profile.bio"] }
 *
 * Response:
 * {
 *   "id": "user-123",
 *   "email": "john@example.com",
 *   "name": "John Doe",
 *   "profile": {
 *     "bio": "Software developer"
 *   }
 * }
 *
 * Note: /compose endpoint is NOT available with FieldsModule only
 */

// ============================================================================
// 3. Usage Pattern 2: ComposeModule Only
// ============================================================================

/**
 * Example: Using only ComposeModule for REST composition
 *
 * This provides the /compose endpoint for batching queries but does NOT
 * enable @fields feature. If you try to use @fields in a compose query,
 * you'll get a clear error message.
 */
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
        {
          path: "/posts",
          handler: {
            handler: PostService,
            method: "findAll",
            httpMethod: "GET",
          },
        },
        {
          path: "/stats",
          handler: {
            handler: StatsController,
            method: "getStats",
            httpMethod: "GET",
          },
        },
      ],
      maxBatchSize: 50,
      maxExecutionTimeMs: 60000,
      maxPayloadSize: 1048576,
      perRouteCallLimit: 10,
      enableCaching: true,
    }),
  ],
  providers: [UserService, PostService],
  controllers: [StatsController],
})
export class ComposeOnlyModule {}

/**
 * Usage with ComposeModule only:
 *
 * POST /compose
 * Body: {
 *   "queries": {
 *     "user": { "path": "/user/me" },
 *     "posts": { "path": "/posts" },
 *     "stats": { "path": "/stats" }
 *   }
 * }
 *
 * Response:
 * {
 *   "user": { "id": "user-123", "email": "john@example.com", ... },
 *   "posts": [ { "id": "post-1", ... }, ... ],
 *   "stats": { "totalUsers": 1000, ... }
 * }
 *
 * Note: @fields feature is NOT available. If you try to use it:
 * POST /compose
 * Body: {
 *   "queries": {
 *     "user": { "path": "/user/me", "body": { "@fields": ["id"] } }
 *   }
 * }
 *
 * Error: FieldsFeatureNotEnabledError
 * The "@fields" feature is being used but FieldsModule is not installed.
 */

// ============================================================================
// 4. Usage Pattern 3: Both Modules Together
// ============================================================================

/**
 * Example: Using both FieldsModule and ComposeModule together
 *
 * This provides both:
 * - @fields feature for normal endpoints
 * - /compose endpoint with @fields support
 */
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
        {
          path: "/users/:id",
          handler: {
            handler: UserService,
            method: "findById",
            httpMethod: "GET",
          },
        },
        {
          path: "/posts",
          handler: {
            handler: PostService,
            method: "findAll",
            httpMethod: "GET",
          },
        },
        {
          path: "/posts/:id",
          handler: {
            handler: PostService,
            method: "findById",
            httpMethod: "GET",
          },
        },
        {
          path: "/stats",
          handler: {
            handler: StatsController,
            method: "getStats",
            httpMethod: "GET",
          },
        },
      ],
      maxBatchSize: 50,
      maxExecutionTimeMs: 60000,
      maxPayloadSize: 1048576,
      perRouteCallLimit: 10,
      enableCaching: true,
    }),
  ],
  providers: [UserService, PostService],
  controllers: [StatsController],
})
export class AppModule {}

/**
 * Usage with both modules:
 *
 * 1. Normal endpoint with @fields:
 * POST /user/me
 * Body: { "@fields": ["id", "email", "name", "profile.bio"] }
 *
 * Response:
 * {
 *   "id": "user-123",
 *   "email": "john@example.com",
 *   "name": "John Doe",
 *   "profile": {
 *     "bio": "Software developer"
 *   }
 * }
 *
 * 2. /compose with @fields:
 * POST /compose
 * Body: {
 *   "queries": {
 *     "user": {
 *       "path": "/user/me",
 *       "body": { "@fields": ["id", "email", "name"] }
 *     },
 *     "posts": {
 *       "path": "/posts",
 *       "body": { "@fields": ["id", "title", "authorId"] }
 *     },
 *     "stats": {
 *       "path": "/stats"
 *     }
 *   }
 * }
 *
 * Response:
 * {
 *   "user": {
 *     "id": "user-123",
 *     "email": "john@example.com",
 *     "name": "John Doe"
 *   },
 *   "posts": [
 *     { "id": "post-1", "title": "First Post", "authorId": "user-123" },
 *     { "id": "post-2", "title": "Second Post", "authorId": "user-123" }
 *   ],
 *   "stats": {
 *     "totalUsers": 1000,
 *     "totalPosts": 5000,
 *     "activeUsers": 250
 *   }
 * }
 *
 * Features:
 * - All queries execute in parallel
 * - Field selection applied per query
 * - Request-level caching deduplicates identical queries
 * - Shared AsyncLocalStorage context across all queries
 * - Fail-fast error handling
 */

// ============================================================================
// 5. Migration Notes
// ============================================================================

/**
 * If you were previously using ComposeModule with maxFieldDepth:
 *
 * OLD:
 * ComposeModule.forRoot({
 *   routes: [...],
 *   maxFieldDepth: 10,  // ❌ This option no longer exists
 * })
 *
 * NEW:
 * FieldsModule.forRoot({
 *   maxFieldDepth: 10,  // ✅ Now in FieldsModule
 * }),
 * ComposeModule.forRoot({
 *   routes: [...],
 *   // maxFieldDepth removed
 * })
 */
