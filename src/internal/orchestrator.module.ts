import { Module, Global, Provider } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { ContextModule } from "../core/context/context.module";
import { RequestCacheService } from "./request-cache.service";
import { ComposeController } from "../compose/compose.controller";
import { ComposeService } from "../compose/compose.service";
import { MethodInvokerService } from "./method-invoker.service";
import { RouteRegistry, RouteEntry } from "./route-registry.service";

export interface OrchestratorModuleConfig {
  routes: RouteEntry[];
  maxBatchSize?: number;
  enableCaching?: boolean;
  queryTimeout?: number; // Timeout per query in milliseconds
  totalTimeout?: number; // Total timeout for all queries in milliseconds (deprecated, use maxExecutionTimeMs)
  maxExecutionTimeMs?: number; // Maximum execution time for entire compose request in milliseconds
  maxPayloadSize?: number; // Maximum payload size in bytes
  perRouteCallLimit?: number; // Maximum calls per route within one compose request
  maxCost?: number; // Maximum cost (total execution time in ms)
}

const DEFAULT_CONFIG = {
  maxBatchSize: 50,
  enableCaching: true,
  queryTimeout: 30000, // 30 seconds per query
  totalTimeout: 60000, // 60 seconds total (deprecated)
  maxExecutionTimeMs: 60000, // 60 seconds total
  maxPayloadSize: 1048576, // 1 MB
  perRouteCallLimit: 10, // 10 calls per route
};

@Global()
@Module({})
export class OrchestratorModule {
  static forRoot(config: OrchestratorModuleConfig) {
    const mergedConfig = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    const configProvider: Provider = {
      provide: "ORCHESTRATOR_CONFIG",
      useValue: {
        maxBatchSize: mergedConfig.maxBatchSize,
        enableCaching: mergedConfig.enableCaching,
        queryTimeout: mergedConfig.queryTimeout,
        totalTimeout:
          mergedConfig.maxExecutionTimeMs || mergedConfig.totalTimeout, // Support both for backward compatibility
        maxExecutionTimeMs:
          mergedConfig.maxExecutionTimeMs || mergedConfig.totalTimeout,
        maxPayloadSize: mergedConfig.maxPayloadSize,
        perRouteCallLimit: mergedConfig.perRouteCallLimit,
        maxCost: mergedConfig.maxCost,
      },
    };

    return {
      module: OrchestratorModule,
      imports: [ContextModule],
      controllers: [ComposeController],
      providers: [
        configProvider,
        RouteRegistry,
        RequestCacheService,
        MethodInvokerService,
        ComposeService,
        {
          provide: "ORCHESTRATOR_INIT",
          useFactory: (routeRegistry: RouteRegistry) => {
            // Register routes with validation
            routeRegistry.register(mergedConfig.routes);
            return true;
          },
          inject: [RouteRegistry],
        },
      ],
      exports: [
        RouteRegistry,
        RequestCacheService,
        "ORCHESTRATOR_CONFIG",
      ],
    };
  }
}
