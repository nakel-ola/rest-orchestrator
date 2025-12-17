import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { RequestContextService } from "./request-context.service";
import { RequestContextUtil } from "./request-context.util";

interface OrchestratorConfig {
  maxFieldDepth: number;
}

/**
 * Fields context stored in AsyncLocalStorage
 */
export interface FieldsContext {
  fields: string[];
  maxDepth: number;
}

/**
 * Global interceptor that extracts, validates, and stores @fields from request body
 * 
 * Behavior:
 * - Detects "@fields" in request body
 * - Validates it is an array of strings
 * - Removes "@fields" from body before it reaches controllers/services
 * - Stores parsed field info in AsyncLocalStorage context
 * - Works for normal endpoints and /compose internal execution
 * - Adds near-zero overhead when @fields is not present
 */
@Injectable()
export class FieldsInterceptor implements NestInterceptor {
  constructor(
    @Inject("ORCHESTRATOR_CONFIG")
    private readonly config: OrchestratorConfig,
    private readonly requestContext: RequestContextService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // Fast path: no body or no @fields, no processing needed
    if (!request.body || typeof request.body !== "object" || !("@fields" in request.body)) {
      return next.handle();
    }

    // Ensure context exists (should be initialized by middleware)
    // If not, we can't store fields, so skip processing
    if (!this.requestContext.hasContext()) {
      // Context should be initialized by RequestContextMiddleware
      // If it's not, we'll still process but fields won't be stored in context
      // This is a fallback for cases where middleware isn't registered
    }

    const fields = request.body["@fields"];

    // Validate @fields is an array
    if (!Array.isArray(fields)) {
      throw new BadRequestException(
        '@fields must be an array of strings'
      );
    }

    // Validate all items are strings and check depth
    const validatedFields: string[] = [];
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      
      if (typeof field !== "string") {
        throw new BadRequestException(
          `@fields[${i}] must be a string, got ${typeof field}`
        );
      }

      if (field.length === 0) {
        throw new BadRequestException(
          `@fields[${i}] cannot be an empty string`
        );
      }

      // Validate field depth
      const depth = field.split(".").length;
      if (depth > this.config.maxFieldDepth) {
        throw new BadRequestException(
          `Field "${field}" exceeds maximum depth of ${this.config.maxFieldDepth}`
        );
      }

      validatedFields.push(field);
    }

    // Remove @fields from request body (mutate in place for performance)
    delete request.body["@fields"];

    // Store fields in AsyncLocalStorage context
    const fieldsContext: FieldsContext = {
      fields: validatedFields,
      maxDepth: this.config.maxFieldDepth,
    };
    
    this.requestContext.setFields(fieldsContext);

    // Continue with the request (fields are now in context, body is cleaned)
    return next.handle();
  }
}

