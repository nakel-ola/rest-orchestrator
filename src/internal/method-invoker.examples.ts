/**
 * Examples of using MethodInvokerService
 * 
 * This file demonstrates how to safely invoke service and controller methods
 * without HTTP calls, with correct "this" binding and proper error handling.
 */

import { MethodInvokerService } from "./method-invoker.service";
import { ResolvedRoute } from "./route-registry.service";

/**
 * Example 1: Basic service method invocation
 */
export async function example1_BasicInvocation(
  methodInvoker: MethodInvokerService,
  resolvedRoute: ResolvedRoute
) {
  // Invoke a service method with arguments
  const outcome = await methodInvoker.invoke(
    resolvedRoute,
    [123, { includeDeleted: false }] // method arguments
  );

  if (!outcome.success) {
    // Handle error - outcome contains clear error message
    throw new Error(`Invocation failed: ${outcome.message}`);
  }

  // Use result
  return outcome.result;
}

/**
 * Example 2: Invoking with different argument patterns
 */
export async function example2_DifferentArgumentPatterns(
  methodInvoker: MethodInvokerService,
  resolvedRoute: ResolvedRoute
) {
  // Pattern 1: Single object argument (common for GET requests)
  const outcome1 = await methodInvoker.invoke(resolvedRoute, [
    { id: 123, includeRelations: true },
  ]);

  // Pattern 2: Multiple arguments (common for POST/PUT requests)
  const outcome2 = await methodInvoker.invoke(resolvedRoute, [
    { id: 123 }, // params
    { page: 1, limit: 10 }, // query
    { name: "John", email: "john@example.com" }, // body
  ]);

  // Pattern 3: No arguments
  const outcome3 = await methodInvoker.invoke(resolvedRoute, []);

  return { outcome1, outcome2, outcome3 };
}

/**
 * Example 3: Error handling with detailed messages
 */
export async function example3_ErrorHandling(
  methodInvoker: MethodInvokerService,
  resolvedRoute: ResolvedRoute
) {
  const outcome = await methodInvoker.invoke(resolvedRoute, [123]);

  if (!outcome.success) {
    // outcome.message contains detailed error:
    // "service UserService.findById() failed: User not found"
    console.error("Invocation error:", outcome.message);
    console.error("Status code:", outcome.statusCode);
    console.error("Original error:", outcome.originalError);

    // Re-throw as HttpException if needed
    throw new Error(outcome.message);
  }

  return outcome.result;
}

/**
 * Example 4: Checking if method can be invoked before calling
 */
export function example4_PreflightCheck(
  methodInvoker: MethodInvokerService,
  resolvedRoute: ResolvedRoute
) {
  // Check if method exists and is callable
  if (!methodInvoker.canInvoke(resolvedRoute)) {
    throw new Error("Method cannot be invoked");
  }

  // Get method info for debugging
  const methodInfo = methodInvoker.getMethodInfo(resolvedRoute);
  if (methodInfo) {
    console.log("Method exists:", methodInfo.exists);
    console.log("Is function:", methodInfo.isFunction);
    console.log("Type:", methodInfo.type);
  }
}

/**
 * Example 5: Invoking with fake request context
 * 
 * Some methods might access request-scoped data.
 * You can provide a fake request context if needed.
 */
export async function example5_WithFakeRequest(
  methodInvoker: MethodInvokerService,
  resolvedRoute: ResolvedRoute
) {
  const outcome = await methodInvoker.invoke(
    resolvedRoute,
    [123],
    {
      fakeRequest: {
        user: { id: 1, role: "admin" },
        headers: { "x-request-id": "fake-123" },
      },
      metadata: {
        source: "compose",
        operation: "getUser",
      },
    }
  );

  return outcome;
}

/**
 * Example 6: Synchronous invocation (for non-async methods)
 */
export function example6_SyncInvocation(
  methodInvoker: MethodInvokerService,
  resolvedRoute: ResolvedRoute
) {
  // For synchronous methods, use invokeSync
  const outcome = methodInvoker.invokeSync(resolvedRoute, [123]);

  if (!outcome.success) {
    throw new Error(outcome.message);
  }

  return outcome.result;
}

/**
 * Example 7: Real-world usage in ComposeService
 */
export async function example7_ComposeServiceUsage(
  methodInvoker: MethodInvokerService,
  resolvedRoute: ResolvedRoute,
  methodArgs: any[]
) {
  // This is how ComposeService uses MethodInvokerService
  const invocation = await methodInvoker.invoke(
    resolvedRoute,
    methodArgs,
    {
      metadata: {
        alias: "getUser",
        path: "/user/123",
        httpMethod: "GET",
      },
    }
  );

  // Fail fast on errors
  if (!invocation.success) {
    throw new Error(
      `Query execution failed: ${invocation.message} (${invocation.statusCode})`
    );
  }

  return invocation.result;
}

/**
 * Example 8: Handling different error types
 */
export async function example8_ErrorTypes(
  methodInvoker: MethodInvokerService,
  resolvedRoute: ResolvedRoute
) {
  const outcome = await methodInvoker.invoke(resolvedRoute, [123]);

  if (!outcome.success) {
    // Check error type
    if (outcome.statusCode === 404) {
      // Handle not found
      console.log("Resource not found");
    } else if (outcome.statusCode === 500) {
      // Handle server error
      console.error("Server error:", outcome.originalError);
    } else {
      // Handle other errors
      console.error("Error:", outcome.message);
    }
  }

  return outcome;
}

