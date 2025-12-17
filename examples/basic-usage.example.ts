/**
 * End-to-End Example: rest-orchestrator
 *
 * This example demonstrates:
 * 1. Registering route mappings
 * 2. Normal endpoint using @fields
 * 3. /compose batching multiple endpoints
 * 4. Shared AsyncLocalStorage context
 * 5. Response format
 */

import {
  Module,
  Controller,
  Get,
  Post,
  Body,
  Injectable,
} from "@nestjs/common";
import { ComposeModule, ComposeModuleOptions } from "../src";

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
// 2. Register Routes in AppModule
// ============================================================================

@Module({
  imports: [
    ComposeModule.forRoot({
      // Register route mappings
      routes: [
        // Service method registration
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
        // Controller method registration
        {
          path: "/stats",
          handler: {
            handler: StatsController,
            method: "getStats",
            httpMethod: "GET",
          },
        },
      ],

      // Optional: Configure safety guards
      maxBatchSize: 50, // Max queries per /compose request
      maxExecutionTimeMs: 60000, // Max execution time (60s)
      maxPayloadSize: 1048576, // Max payload size (1 MB)
      perRouteCallLimit: 10, // Max calls per route
      maxFieldDepth: 10, // Max field selection depth
      enableCaching: true, // Enable request-level caching
    } as ComposeModuleOptions),
  ],
  providers: [UserService, PostService],
  controllers: [StatsController],
})
export class AppModule {}

// ============================================================================
// 3. Example Usage: Normal Endpoint with @fields
// ============================================================================

/**
 * Example: GET /user/me with field selection
 *
 * Request:
 * POST /user/me
 * Body: {
 *   "@fields": ["id", "email", "name", "profile.bio", "posts.id", "posts.title"]
 * }
 *
 * Response:
 * {
 *   "id": "user-123",
 *   "email": "john@example.com",
 *   "name": "John Doe",
 *   "profile": {
 *     "bio": "Software developer"
 *   },
 *   "posts": [
 *     {
 *       "id": "post-1",
 *       "title": "My First Post"
 *     },
 *     {
 *       "id": "post-2",
 *       "title": "My Second Post"
 *     }
 *   ]
 * }
 *
 * Note: The @fields property is automatically removed from the body
 * before it reaches the service method, and field selection is applied
 * to the response automatically.
 */

// ============================================================================
// 4. Example Usage: /compose Batching
// ============================================================================

/**
 * Example: POST /compose - Batch multiple queries
 *
 * Request:
 * POST /compose
 * Body: {
 *   "queries": {
 *     "user": {
 *       "path": "/user/me",
 *       "body": {
 *         "@fields": ["id", "email", "name"]
 *       }
 *     },
 *     "posts": {
 *       "path": "/posts",
 *       "body": {
 *         "@fields": ["id", "title", "authorId"]
 *       }
 *     },
 *     "stats": {
 *       "path": "/stats"
 *     },
 *     "userById": {
 *       "path": "/users/:id",
 *       "params": {
 *         "id": "user-456"
 *       },
 *       "body": {
 *         "@fields": ["id", "name", "email"]
 *       }
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
 *     {
 *       "id": "post-1",
 *       "title": "First Post",
 *       "authorId": "user-123"
 *     },
 *     {
 *       "id": "post-2",
 *       "title": "Second Post",
 *       "authorId": "user-123"
 *     }
 *   ],
 *   "stats": {
 *     "totalUsers": 1000,
 *     "totalPosts": 5000,
 *     "activeUsers": 250
 *   },
 *   "userById": {
 *     "id": "user-456",
 *     "name": "User user-456",
 *     "email": "useruser-456@example.com"
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
// 5. Shared AsyncLocalStorage Context
// ============================================================================

/**
 * The AsyncLocalStorage context is automatically shared across:
 *
 * 1. Normal endpoints: Context initialized by RequestContextMiddleware
 * 2. /compose requests: Context initialized in ComposeController
 * 3. Sub-queries in /compose: Each query gets its own context, but can
 *    access the parent compose request context
 *
 * Context includes:
 * - Request ID
 * - Start time
 * - Per-request cache (for automatic deduplication)
 * - Selected fields (@fields)
 * - Request metadata
 *
 * Note: The AsyncLocalStorage context is automatically managed by rest-orchestrator.
 * The request-level cache is used internally for automatic deduplication of identical
 * queries within a /compose request. You don't need to manually access the context
 * in most cases - the caching and deduplication happen automatically.
 */

// ============================================================================
// 6. Response Format Examples
// ============================================================================

/**
 * Normal Endpoint Response (with @fields):
 *
 * Request: POST /user/me
 * Body: { "@fields": ["id", "email", "profile.bio"] }
 *
 * Response: 200 OK
 * {
 *   "id": "user-123",
 *   "email": "john@example.com",
 *   "profile": {
 *     "bio": "Software developer"
 *   }
 * }
 *
 *
 * /compose Response:
 *
 * Request: POST /compose
 * Body: {
 *   "queries": {
 *     "user": { "path": "/user/me", "body": { "@fields": ["id", "name"] } },
 *     "posts": { "path": "/posts" }
 *   }
 * }
 *
 * Response: 200 OK
 * {
 *   "user": {
 *     "id": "user-123",
 *     "name": "John Doe"
 *   },
 *   "posts": [
 *     { "id": "post-1", "title": "First Post", ... },
 *     { "id": "post-2", "title": "Second Post", ... }
 *   ]
 * }
 *
 *
 * Error Response (from /compose):
 *
 * If a query fails, the error is included in the response:
 * {
 *   "user": {
 *     "id": "user-123",
 *     "name": "John Doe"
 *   },
 *   "posts": {
 *     "error": "Path \"/posts\" not found in registry",
 *     "statusCode": 404
 *   }
 * }
 *
 *
 * Validation Error Response:
 *
 * Request: POST /compose
 * Body: { "queries": { "user": { "path": "/user/me" }, "invalid": {} } }
 *
 * Response: 400 Bad Request
 * {
 *   "statusCode": 400,
 *   "message": "Query \"invalid\" must have a 'path' property",
 *   "error": "Bad Request"
 * }
 */
