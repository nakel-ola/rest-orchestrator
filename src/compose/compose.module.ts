import { Module } from "@nestjs/common";
import { ComposeModuleOptions } from "./compose.module.interface";
import { adaptRoutesToRegistry } from "../public/route-adapter";
import { OrchestratorModule } from "../internal/orchestrator.module";
import { RouteEntry } from "../internal/route-registry.service";

/**
 * Main module for REST orchestration
 *
 * @example
 * ```typescript
 * ComposeModule.forRoot({
 *   routes: [
 *     {
 *       path: "/user/me",
 *       handler: {
 *         handler: UserService,
 *         method: "findAuthUser",
 *         httpMethod: "GET"
 *       }
 *     }
 *   ]
 * })
 * ```
 */
@Module({})
export class ComposeModule {
  static forRoot(options: ComposeModuleOptions) {
    // Convert public API format to RouteEntry[] format
    const routeEntries = adaptRoutesToRegistry(options.routes);

    // Build internal config with route entries
    const internalConfig = {
      routes: routeEntries,
      maxBatchSize: options.maxBatchSize,
      enableCaching: options.enableCaching,
      maxExecutionTimeMs: options.maxExecutionTimeMs,
      maxPayloadSize: options.maxPayloadSize,
      perRouteCallLimit: options.perRouteCallLimit,
    };

    // Delegate to internal OrchestratorModule
    return OrchestratorModule.forRoot(internalConfig);
  }
}

