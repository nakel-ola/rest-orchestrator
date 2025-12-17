export interface FieldSelectorOptions {
  maxDepth?: number;
}

export class FieldSelector {
  private readonly fieldMap: Map<string, Set<string>>;
  private readonly maxDepth: number;

  constructor(fields: string[], options: FieldSelectorOptions = {}) {
    this.maxDepth = options.maxDepth ?? 10;
    this.fieldMap = this.buildFieldMap(fields);
  }

  private buildFieldMap(fields: string[]): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();

    for (const field of fields) {
      const parts = field.split(".");
      const root = parts[0];
      const nested = parts.slice(1).join(".");

      if (!map.has(root)) {
        map.set(root, new Set());
      }

      if (nested) {
        map.get(root)!.add(nested);
      }
    }

    return map;
  }

  select<T = any>(data: T, depth: number = 0): T {
    if (depth > this.maxDepth) {
      return data;
    }

    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.select(item, depth)) as T;
    }

    if (typeof data === "object" && !(data instanceof Date)) {
      const result: any = {};

      for (const [key, value] of Object.entries(data)) {
        const fieldSet = this.fieldMap.get(key);

        if (fieldSet) {
          if (fieldSet.size === 0) {
            // Include entire field if no nested fields specified
            result[key] = value;
          } else {
            // Include field but filter nested fields
            if (typeof value === "object" && value !== null) {
              const nestedSelector = new FieldSelector(Array.from(fieldSet), {
                maxDepth: this.maxDepth,
              });
              result[key] = nestedSelector.select(value, depth + 1);
            } else {
              result[key] = value;
            }
          }
        }
      }

      return result as T;
    }

    return data;
  }

  static selectFields<T = any>(
    data: T,
    fields: string[],
    options: FieldSelectorOptions = {}
  ): T {
    if (!fields || fields.length === 0) {
      return data;
    }

    const selector = new FieldSelector(fields, options);
    return selector.select(data);
  }
}
