/*
 * Replacement for `structuredClone` (used 4× by the v17 source) which is
 * not available under the v12 build target (lib ES2018) / older runtimes.
 *
 * The cloned payloads here are plain JSON — PropertyModel fields are
 * string / boolean / number only (no Date, Map, RegExp, functions or
 * cyclic refs) — so a JSON round-trip is a correct, dependency-free clone.
 * Documented limitation: do NOT pass non-JSON-serialisable values in
 * `properties` / `importableEvents`.
 */
export function deepClone<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
