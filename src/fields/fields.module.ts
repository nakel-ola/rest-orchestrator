import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ContextModule } from "../core/context/context.module";
import { FieldsInterceptor } from "./fields.interceptor";
import { FieldSelectionInterceptor } from "./field-selection.interceptor";
import { FieldsModuleOptions } from "./fields.module.interface";

/**
 * FieldsModule - Optional module for @fields feature
 *
 * Provides:
 * - FieldsInterceptor: Extracts and validates @fields from request body
 * - FieldSelectionInterceptor: Applies field selection to responses
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [FieldsModule.forRoot()]
 * })
 * export class AppModule {}
 * ```
 */
@Global()
@Module({})
export class FieldsModule {
  static forRoot(options?: FieldsModuleOptions) {
    const mergedConfig = {
      maxFieldDepth: options?.maxFieldDepth ?? 10,
    };

    return {
      module: FieldsModule,
      imports: [ContextModule],
      providers: [
        {
          provide: "FIELDS_CONFIG",
          useValue: mergedConfig,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: FieldsInterceptor,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: FieldSelectionInterceptor,
        },
        {
          provide: "FIELDS_MODULE_ENABLED",
          useValue: true,
        },
      ],
    };
  }
}
