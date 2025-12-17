import { RouteRegistration } from "../compose/compose.module.interface";
import {
  RouteEntry,
  HandlerMetadata,
  HandlerType,
} from "../internal/route-registry.service";

/**
 * Infers handler type from class name
 * @param handlerClass The handler class
 * @returns Inferred handler type
 */
function inferHandlerType(handlerClass: any): HandlerType {
  const className = handlerClass?.name || "";
  
  // Check if it's a controller (common NestJS patterns)
  if (
    className.endsWith("Controller") ||
    className.toLowerCase().includes("controller")
  ) {
    return "controller";
  }
  
  // Default to service
  return "service";
}

/**
 * Converts public RouteRegistration[] format to RouteEntry[] format for RouteRegistry
 */
export function adaptRoutesToRegistry(
  routes: RouteRegistration[]
): RouteEntry[] {
  return routes.map((route) => {
    const handlerType = inferHandlerType(route.handler.handler);
    
    const metadata: HandlerMetadata = {
      type: handlerType,
      handlerClass: route.handler.handler,
      methodName: route.handler.method,
      httpMethod: route.handler.httpMethod,
    };

    return {
      path: route.path,
      handler: metadata,
    };
  });
}

