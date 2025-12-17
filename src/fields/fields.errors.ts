/**
 * Error thrown when @fields feature is used but FieldsModule is not installed
 */
export class FieldsFeatureNotEnabledError extends Error {
  constructor() {
    super(
      'The "@fields" feature is being used but FieldsModule is not installed.\n\n' +
      'Fix:\n' +
      '  import { FieldsModule } from "rest-orchestrator";\n' +
      '  FieldsModule.forRoot()'
    );
    this.name = "FieldsFeatureNotEnabledError";
  }
}

