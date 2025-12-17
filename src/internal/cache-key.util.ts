import { createHash } from "crypto";

/**
 * Normalize body by removing @fields and sorting keys
 * This ensures consistent cache keys for identical requests
 */
function normalizeBody(body: any): any {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }

  const normalized: any = {};
  const keys = Object.keys(body).sort();

  for (const key of keys) {
    // Skip @fields - it's handled separately via field hash
    if (key === "@fields") {
      continue;
    }

    const value = body[key];
    if (value !== undefined && value !== null) {
      // Recursively normalize nested objects
      if (typeof value === "object" && !Array.isArray(value) && value !== null) {
        normalized[key] = normalizeBody(value);
      } else {
        normalized[key] = value;
      }
    }
  }

  return normalized;
}

/**
 * Generate a hash of fields array for cache key
 * Ensures consistent hashing regardless of field order
 */
function hashFields(fields: string[] | undefined): string {
  if (!fields || fields.length === 0) {
    return "";
  }

  // Sort fields to ensure consistent hash
  const sortedFields = [...fields].sort();
  const fieldsStr = JSON.stringify(sortedFields);
  
  // Generate short hash (first 8 chars of SHA256)
  return createHash("sha256").update(fieldsStr).digest("hex").substring(0, 8);
}

/**
 * Generate cache key from path, normalized body, and field hash
 * 
 * Format: path:normalizedBodyHash:fieldHash
 * 
 * Requirements:
 * - path: Request path
 * - normalized body: Body excluding @fields, normalized (sorted keys, etc.)
 * - field hash: Hash of @fields array
 * 
 * Note: Params are merged into the normalized body for cache key generation
 * to ensure identical queries with same params produce same cache keys.
 * 
 * @param path Request path
 * @param body Request body (will be normalized, @fields excluded)
 * @param fields Field selection array (will be hashed)
 * @param params Optional path/query parameters (merged into body for hashing)
 * @returns Cache key string
 */
export function generateCacheKey(
  path: string,
  body?: any,
  fields?: string[],
  params?: Record<string, any>
): string {
  // Normalize body (exclude @fields)
  let normalizedBody = normalizeBody(body);
  
  // Merge params into normalized body for consistent hashing
  // This ensures same path + body + params = same cache key
  if (params && Object.keys(params).length > 0) {
    normalizedBody = {
      ...normalizedBody,
      ...params,
    };
  }
  
  // Create body hash from normalized body (path + normalized body)
  const bodyHash = normalizedBody && Object.keys(normalizedBody).length > 0
    ? createHash("sha256")
        .update(JSON.stringify(normalizedBody))
        .digest("hex")
        .substring(0, 8)
    : "";

  // Create field hash
  const fieldHash = hashFields(fields);

  // Build cache key: path:normalizedBodyHash:fieldHash
  const parts = [path];
  
  if (bodyHash) {
    parts.push(bodyHash);
  }
  
  if (fieldHash) {
    parts.push(fieldHash);
  }

  return parts.join(":");
}

