import { Injectable, Scope } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import {
  PathRegistryMap,
  PathRegistration,
} from "../interfaces/path-registration.interface";

export interface ResolvedPath {
  registration: PathRegistration;
  serviceInstance: any;
  params: Record<string, string>;
}

@Injectable({ scope: Scope.DEFAULT })
export class PathRegistryService {
  private pathRegistry: PathRegistryMap = {};

  constructor(private readonly moduleRef: ModuleRef) {}

  registerPaths(registry: PathRegistryMap): void {
    this.pathRegistry = { ...this.pathRegistry, ...registry };
  }

  resolve(path: string, httpMethod: string): ResolvedPath | null {
    // Try exact match first
    if (this.pathRegistry[path]) {
      const registration = this.pathRegistry[path];
      if (registration.httpMethod === httpMethod) {
        const serviceInstance = this.moduleRef.get(registration.service, {
          strict: false,
        });
        if (!serviceInstance) {
          return null;
        }
        return {
          registration,
          serviceInstance,
          params: {},
        };
      }
    }

    // Try pattern matching for path parameters
    for (const [pattern, registration] of Object.entries(this.pathRegistry)) {
      if (registration.httpMethod !== httpMethod) {
        continue;
      }

      const params = this.matchPath(pattern, path);
      if (params !== null) {
        const serviceInstance = this.moduleRef.get(registration.service, {
          strict: false,
        });
        if (!serviceInstance) {
          continue;
        }
        return {
          registration,
          serviceInstance,
          params,
        };
      }
    }

    return null;
  }

  private matchPath(
    pattern: string,
    actualPath: string
  ): Record<string, string> | null {
    const patternParts = pattern.split("/");
    const actualParts = actualPath.split("/");

    if (patternParts.length !== actualParts.length) {
      return null;
    }

    const params: Record<string, string> = {};

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const actualPart = actualParts[i];

      if (patternPart.startsWith(":")) {
        const paramName = patternPart.slice(1);
        params[paramName] = actualPart;
      } else if (patternPart !== actualPart) {
        return null;
      }
    }

    return params;
  }

  getRegistry(): PathRegistryMap {
    return { ...this.pathRegistry };
  }
}
