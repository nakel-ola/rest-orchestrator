import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { Observable, from, firstValueFrom } from "rxjs";
import { RequestContextService } from "../core/context/request-context.service";
import { RequestContextUtil } from "../core/context/request-context.util";
import { FieldsContext } from "./fields.types";

interface FieldsConfig {
  maxFieldDepth: number;
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
    @Inject("FIELDS_CONFIG")
    private readonly config: FieldsConfig,
    private readonly requestContext: RequestContextService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Fast path: no body or no @fields, no processing needed
    if (
      !request.body ||
      typeof request.body !== "object" ||
      !("@fields" in request.body)
    ) {
      return next.handle();
    }

    // Ensure context exists - initialize if it doesn't exist
    // This ensures fields can be stored even if middleware isn't registered
    const needsContextInit = !this.requestContext.hasContext();
    let contextData: any = null;

    if (needsContextInit) {
      const httpContext = context.switchToHttp();
      const req = httpContext.getRequest();
      contextData = RequestContextUtil.createContext({
        requestId:
          (req.headers["x-request-id"] as string) ||
          `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        method: req.method,
        path: req.path,
        metadata: {
          ip: req.ip,
          userAgent: req.get("user-agent"),
        },
      });
    }

    const fields = request.body["@fields"];

    // Validate @fields is an array
    if (!Array.isArray(fields)) {
      throw new BadRequestException("@fields must be an array of strings");
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

    // If context needs initialization, wrap the entire Observable chain
    if (needsContextInit && contextData) {
      return from(
        this.requestContext.runAsync(contextData, async () => {
          // Set fields in the newly created context
          this.requestContext.setFields(fieldsContext);

          // Get the Observable and convert to Promise using firstValueFrom
          const obs = next.handle();
          return firstValueFrom(obs);
        })
      );
    }

    // Context already exists, just set fields and continue
    this.requestContext.setFields(fieldsContext);

    // Continue with the request (fields are now in context, body is cleaned)
    return next.handle();
  }
}
