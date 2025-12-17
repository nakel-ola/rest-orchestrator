import { RequestContextService } from "./request-context.service";
import { FieldsContext } from "./fields.interceptor";

/**
 * Helper functions for accessing fields context from AsyncLocalStorage
 * 
 * These helpers provide a type-safe way to access field selection information
 * stored by FieldsInterceptor in the request context.
 */
export class FieldsContextHelper {
  /**
   * Get fields context from AsyncLocalStorage
   * @param requestContext The RequestContextService instance
   * @returns FieldsContext if fields were specified, undefined otherwise
   */
  static getFields(
    requestContext: RequestContextService
  ): FieldsContext | undefined {
    return requestContext.get<FieldsContext>("fields");
  }

  /**
   * Check if fields were specified in the current request
   * @param requestContext The RequestContextService instance
   * @returns True if fields were specified
   */
  static hasFields(requestContext: RequestContextService): boolean {
    return requestContext.has("fields");
  }

  /**
   * Get the fields array from context
   * @param requestContext The RequestContextService instance
   * @returns Array of field paths, or empty array if not specified
   */
  static getFieldsArray(
    requestContext: RequestContextService
  ): string[] {
    const context = this.getFields(requestContext);
    return context?.fields || [];
  }

  /**
   * Get max depth from context
   * @param requestContext The RequestContextService instance
   * @returns Max field depth, or undefined if fields not specified
   */
  static getMaxDepth(
    requestContext: RequestContextService
  ): number | undefined {
    const context = this.getFields(requestContext);
    return context?.maxDepth;
  }

  /**
   * Set fields in context (for programmatic use, e.g., in /compose)
   * @param requestContext The RequestContextService instance
   * @param fields Array of field paths
   * @param maxDepth Maximum field depth
   */
  static setFields(
    requestContext: RequestContextService,
    fields: string[],
    maxDepth: number
  ): void {
    const context: FieldsContext = {
      fields,
      maxDepth,
    };
    requestContext.set("fields", context);
  }
}

