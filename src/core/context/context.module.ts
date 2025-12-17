import { Global, Module } from "@nestjs/common";
import { RequestContextService } from "./request-context.service";
import { RequestContextMiddleware } from "./request-context.middleware";

/**
 * Core context module providing AsyncLocalStorage-based request context
 * 
 * This module is global and provides the foundation for request-scoped context
 * used by both FieldsModule and ComposeModule.
 */
@Global()
@Module({
  providers: [RequestContextService, RequestContextMiddleware],
  exports: [RequestContextService, RequestContextMiddleware],
})
export class ContextModule {}

