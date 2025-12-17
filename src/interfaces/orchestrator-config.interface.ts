import { PathRegistryMap } from "./path-registration.interface";

export interface OrchestratorConfig {
  maxBatchSize?: number;
  maxFieldDepth?: number;
  enableCaching?: boolean;
  pathRegistry: PathRegistryMap;
}

export const DEFAULT_ORCHESTRATOR_CONFIG: Required<
  Omit<OrchestratorConfig, "pathRegistry">
> & { pathRegistry: PathRegistryMap } = {
  maxBatchSize: 50,
  maxFieldDepth: 10,
  enableCaching: true,
  pathRegistry: {},
};
