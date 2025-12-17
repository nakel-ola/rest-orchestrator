import {
  Controller,
  Post,
  Body,
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { RequestContextService } from "../core/context/request-context.service";
import { RequestContextUtil } from "../core/context/request-context.util";
import { ComposeService } from "./compose.service";
import {
  ComposeRequest,
  ComposeResponse,
  ComposeQuery,
} from "../interfaces/compose-request.interface";

interface OrchestratorConfig {
  maxBatchSize: number;
  maxPayloadSize?: number;
}

/**
 * Controller for POST /compose endpoint
 * 
 * This controller only handles:
 * - Request validation (shape, limits)
 * - Context initialization
 * - Delegation to ComposeService
 * 
 * No business logic here.
 */
@Controller()
export class ComposeController {
  constructor(
    private readonly composeService: ComposeService,
    private readonly requestContext: RequestContextService,
    @Inject("ORCHESTRATOR_CONFIG")
    private readonly config: OrchestratorConfig
  ) {}

  @Post("compose")
  async compose(@Body() request: ComposeRequest): Promise<ComposeResponse> {
    // Manually initialize request context for /compose sub-requests
    const existingContext = this.requestContext.getContext();
    const context = existingContext
      ? existingContext
      : RequestContextUtil.createContext({
          requestId: `compose-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          method: "POST",
          path: "/compose",
        });

    return this.requestContext.runAsync(context, async () => {
      // Validate request shape strictly
      this.validateRequestShape(request);

      // Enforce max payload size (fail fast before processing queries)
      if (this.config.maxPayloadSize) {
        const payloadSize = this.calculatePayloadSize(request);
        if (payloadSize > this.config.maxPayloadSize) {
          throw new HttpException(
            `Request payload size ${payloadSize} bytes exceeds maximum of ${this.config.maxPayloadSize} bytes`,
            HttpStatus.PAYLOAD_TOO_LARGE
          );
        }
      }

      // Validate and extract queries
      const queries = this.validateAndExtractQueries(request);

      // Enforce max queries limit
      const queryCount = Object.keys(queries).length;
      if (queryCount > this.config.maxBatchSize) {
        throw new BadRequestException(
          `Query count exceeds maximum of ${this.config.maxBatchSize}. Received ${queryCount} queries.`
        );
      }

      if (queryCount === 0) {
        throw new BadRequestException("At least one query is required");
      }

      // Delegate execution to ComposeService
      return this.composeService.executeQueries(queries);
    });
  }

  /**
   * Validate request shape strictly
   */
  private validateRequestShape(request: any): void {
    if (!request || typeof request !== "object" || Array.isArray(request)) {
      throw new BadRequestException(
        "Request must be an object with a 'queries' property"
      );
    }

    if (!("queries" in request)) {
      throw new BadRequestException(
        "Request must have a 'queries' property"
      );
    }

    if (
      request.queries === null ||
      typeof request.queries !== "object" ||
      Array.isArray(request.queries)
    ) {
      throw new BadRequestException(
        "Request 'queries' must be an object mapping aliases to query definitions"
      );
    }

    // Reject unknown top-level properties
    const allowedKeys = ["queries"];
    const requestKeys = Object.keys(request);
    const unknownKeys = requestKeys.filter((key) => !allowedKeys.includes(key));
    if (unknownKeys.length > 0) {
      throw new BadRequestException(
        `Request contains unknown properties: ${unknownKeys.join(", ")}. Only 'queries' is allowed.`
      );
    }
  }

  /**
   * Validate and extract queries
   */
  private validateAndExtractQueries(
    request: ComposeRequest
  ): Record<string, ComposeQuery> {
    const queries: Record<string, ComposeQuery> = {};

    for (const [alias, query] of Object.entries(request.queries)) {
      // Validate alias
      if (!alias || typeof alias !== "string" || alias.length === 0) {
        throw new BadRequestException(
          "Query alias must be a non-empty string"
        );
      }

      // Validate query shape
      this.validateQueryShape(alias, query);

      queries[alias] = query;
    }

    return queries;
  }

  /**
   * Validate a single query shape
   */
  private validateQueryShape(alias: string, query: any): void {
    if (!query || typeof query !== "object" || Array.isArray(query)) {
      throw new BadRequestException(
        `Query "${alias}" must be an object`
      );
    }

    // Validate required 'path' property
    if (!("path" in query)) {
      throw new BadRequestException(
        `Query "${alias}" must have a 'path' property`
      );
    }

    if (typeof query.path !== "string" || query.path.length === 0) {
      throw new BadRequestException(
        `Query "${alias}" 'path' must be a non-empty string`
      );
    }

    // Validate optional properties
    const allowedKeys = ["path", "body", "params", "query"];
    const queryKeys = Object.keys(query);
    const unknownKeys = queryKeys.filter((key) => !allowedKeys.includes(key));
    if (unknownKeys.length > 0) {
      throw new BadRequestException(
        `Query "${alias}" contains unknown properties: ${unknownKeys.join(", ")}. Allowed: ${allowedKeys.join(", ")}`
      );
    }

    // Validate body if present
    if ("body" in query && query.body !== undefined) {
      if (typeof query.body !== "object" || query.body === null || Array.isArray(query.body)) {
        throw new BadRequestException(
          `Query "${alias}" 'body' must be an object`
        );
      }
    }

    // Validate params if present
    if ("params" in query && query.params !== undefined) {
      if (typeof query.params !== "object" || query.params === null || Array.isArray(query.params)) {
        throw new BadRequestException(
          `Query "${alias}" 'params' must be an object`
        );
      }
    }

    // Validate query if present
    if ("query" in query && query.query !== undefined) {
      if (typeof query.query !== "object" || query.query === null || Array.isArray(query.query)) {
        throw new BadRequestException(
          `Query "${alias}" 'query' must be an object`
        );
      }
    }
  }

  /**
   * Calculate payload size in bytes
   * Uses JSON stringification to get accurate size
   */
  private calculatePayloadSize(request: ComposeRequest): number {
    try {
      const jsonString = JSON.stringify(request);
      // Use Buffer.byteLength for accurate UTF-8 byte count
      return Buffer.byteLength(jsonString, "utf8");
    } catch (error) {
      // If stringification fails, estimate based on object
      // This is a fallback and shouldn't normally happen
      return JSON.stringify(request).length * 2; // Rough estimate
    }
  }
}

