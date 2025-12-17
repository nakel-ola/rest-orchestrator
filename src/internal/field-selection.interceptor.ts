import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { FieldSelector } from "./field-selector.util";
import { RequestContextService } from "./request-context.service";
import { FieldsContextHelper } from "./fields-context.helper";

interface OrchestratorConfig {
  maxFieldDepth: number;
}

/**
 * Interceptor that applies field selection to responses based on fields stored in context
 * 
 * This interceptor reads fields from AsyncLocalStorage context (set by FieldsInterceptor)
 * and applies field selection to the response data.
 * 
 * Works for:
 * - Normal endpoints (fields set by FieldsInterceptor)
 * - /compose operations (fields set manually in ComposeController)
 */
@Injectable()
export class FieldSelectionInterceptor implements NestInterceptor {
  constructor(
    @Inject("ORCHESTRATOR_CONFIG")
    private readonly config: OrchestratorConfig,
    private readonly requestContext: RequestContextService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Get fields from context (set by FieldsInterceptor or manually for /compose)
    const fieldsContext = FieldsContextHelper.getFields(this.requestContext);

    if (!fieldsContext || !fieldsContext.fields || fieldsContext.fields.length === 0) {
      return next.handle();
    }

    const fields = fieldsContext.fields;

    return next.handle().pipe(
      map((data) => {
        try {
          return FieldSelector.selectFields(data, fields, {
            maxDepth: fieldsContext.maxDepth,
          });
        } catch (error) {
          throw new BadRequestException(
            `Field selection failed: ${error?.message || "Unknown error"}`
          );
        }
      })
    );
  }
}
