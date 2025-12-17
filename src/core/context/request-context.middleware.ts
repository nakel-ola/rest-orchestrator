import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { RequestContextService } from "./request-context.service";
import { RequestContextUtil } from "./request-context.util";

/**
 * Middleware that automatically initializes request context for HTTP requests
 * 
 * Creates a new RequestContext with:
 * - Request start time
 * - Per-request cache Map
 * - Request metadata (ID, method, path)
 * 
 * Context is automatically cleaned up after request completes (zero memory leaks)
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const context = RequestContextUtil.createContext({
      requestId:
        (req.headers["x-request-id"] as string) ||
        `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      method: req.method,
      path: req.path,
      metadata: {
        user: (req as any).user, // If authentication middleware sets this
        ip: req.ip,
        userAgent: req.get("user-agent"),
      },
    });

    this.requestContext.run(context, () => {
      next();
    });
  }
}

