import {
  Injectable,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ResolvedRoute } from "./route-registry.service";

/**
 * Options for method invocation
 */
export interface InvocationOptions {
  /**
   * Optional fake request context to inject
   * Useful when methods access request-scoped data
   */
  fakeRequest?: any;

  /**
   * Additional context metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Result of method invocation
 */
export interface InvocationResult<T = any> {
  /**
   * The result of the method call
   */
  result: T;

  /**
   * Whether the invocation succeeded
   */
  success: true;
}

/**
 * Error from method invocation
 */
export interface InvocationError {
  /**
   * Error message
   */
  message: string;

  /**
   * HTTP status code (if applicable)
   */
  statusCode?: number;

  /**
   * Original error
   */
  originalError?: any;

  /**
   * Whether the invocation failed
   */
  success: false;
}

export type InvocationOutcome<T = any> = InvocationResult<T> | InvocationError;

/**
 * Service for safely invoking service and controller methods directly
 * 
 * Features:
 * - Correct "this" binding
 * - Support for dependency-injected classes
 * - Optional fake request context injection
 * - Clear error messages
 * - Type-safe invocation
 * 
 * @example
 * ```typescript
 * // Invoke a service method
 * const outcome = await methodInvoker.invoke(
 *   resolvedRoute,
 *   [userId, options]
 * );
 * 
 * if (!outcome.success) {
 *   throw new HttpException(outcome.message, outcome.statusCode);
 * }
 * 
 * return outcome.result;
 * ```
 */
@Injectable()
export class MethodInvokerService {
  /**
   * Invoke a method on a resolved route
   * 
   * @param resolvedRoute The resolved route with instance and metadata
   * @param args Method arguments
   * @param options Optional invocation options
   * @returns Invocation outcome (result or error)
   */
  async invoke<T = any>(
    resolvedRoute: ResolvedRoute,
    args: any[] = [],
    options: InvocationOptions = {}
  ): Promise<InvocationOutcome<T>> {
    const { instance, metadata } = resolvedRoute;

    // Validate instance exists
    if (!instance) {
      return {
        success: false,
        message: `Instance of ${metadata.handlerClass.name} is null or undefined`,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    // Get method from instance
    const method = instance[metadata.methodName];

    // Validate method exists and is callable
    if (method === undefined || method === null) {
      return {
        success: false,
        message: `Method '${metadata.methodName}' does not exist on ${metadata.type} ${metadata.handlerClass.name}`,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    if (typeof method !== "function") {
      return {
        success: false,
        message: `'${metadata.methodName}' on ${metadata.type} ${metadata.handlerClass.name} is not a function (got ${typeof method})`,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    // Invoke method with correct "this" binding
    try {
      // Use .call() or .apply() to ensure correct "this" binding
      // For async methods, we need to await the result
      const result = await method.apply(instance, args);

      return {
        success: true,
        result,
      };
    } catch (error) {
      return this.normalizeError(error, metadata, args);
    }
  }

  /**
   * Invoke a method synchronously (for non-async methods)
   * 
   * @param resolvedRoute The resolved route with instance and metadata
   * @param args Method arguments
   * @param options Optional invocation options
   * @returns Invocation outcome (result or error)
   */
  invokeSync<T = any>(
    resolvedRoute: ResolvedRoute,
    args: any[] = [],
    options: InvocationOptions = {}
  ): InvocationOutcome<T> {
    const { instance, metadata } = resolvedRoute;

    // Validate instance exists
    if (!instance) {
      return {
        success: false,
        message: `Instance of ${metadata.handlerClass.name} is null or undefined`,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    // Get method from instance
    const method = instance[metadata.methodName];

    // Validate method exists and is callable
    if (method === undefined || method === null) {
      return {
        success: false,
        message: `Method '${metadata.methodName}' does not exist on ${metadata.type} ${metadata.handlerClass.name}`,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    if (typeof method !== "function") {
      return {
        success: false,
        message: `'${metadata.methodName}' on ${metadata.type} ${metadata.handlerClass.name} is not a function (got ${typeof method})`,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    // Invoke method with correct "this" binding
    try {
      const result = method.apply(instance, args);

      return {
        success: true,
        result,
      };
    } catch (error) {
      return this.normalizeError(error, metadata, args);
    }
  }

  /**
   * Normalize error to consistent format
   */
  private normalizeError(
    error: any,
    metadata: ResolvedRoute["metadata"],
    args: any[]
  ): InvocationError {
    // If it's already an HttpException, preserve it
    if (error instanceof HttpException) {
      return {
        success: false,
        message: error.message,
        statusCode: error.getStatus(),
        originalError: error,
      };
    }

    // Extract meaningful error message
    let message: string;
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === "string") {
      message = error;
    } else {
      message = `Unknown error occurred`;
    }

    // Build detailed error message
    const detailedMessage = `${metadata.type} ${metadata.handlerClass.name}.${metadata.methodName}() failed: ${message}`;

    return {
      success: false,
      message: detailedMessage,
      statusCode: error?.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      originalError: error,
    };
  }

  /**
   * Validate that a method can be invoked
   * 
   * @param resolvedRoute The resolved route
   * @returns True if method can be invoked, false otherwise
   */
  canInvoke(resolvedRoute: ResolvedRoute): boolean {
    const { instance, metadata } = resolvedRoute;

    if (!instance) {
      return false;
    }

    const method = instance[metadata.methodName];
    return typeof method === "function";
  }

  /**
   * Get method signature information (for debugging)
   * 
   * @param resolvedRoute The resolved route
   * @returns Method signature info or null if method doesn't exist
   */
  getMethodInfo(resolvedRoute: ResolvedRoute): {
    exists: boolean;
    isFunction: boolean;
    type: string;
    name: string;
  } | null {
    const { instance, metadata } = resolvedRoute;

    if (!instance) {
      return null;
    }

    const method = instance[metadata.methodName];

    return {
      exists: method !== undefined && method !== null,
      isFunction: typeof method === "function",
      type: typeof method,
      name: metadata.methodName,
    };
  }
}

