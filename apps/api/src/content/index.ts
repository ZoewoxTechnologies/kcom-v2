/**
 * Shared building blocks for content resources (capsules, series, and later
 * blog, books and events). Small explicit helpers, not a CRUD factory: each
 * resource keeps its own hand-written route file and uses these where needed.
 *
 * - `schemas`: id/slug params, http(s) URL, publish status, pagination.
 * - `richTextSchema` / `sanitizeRichText`: validate and sanitise rich-text JSON.
 * - `assertCanChange`: the publish-permission rule, in one place.
 * - `rethrowWriteError`: map unique/foreign-key/check violations to 409/422.
 * - `notFound(what)`, `findById(db, table, id, label)`: 404 helpers.
 * - `publicCache`: middleware for cacheable public routers.
 * - `isLive(table)`: public-read filter (published and publish time passed).
 */
export { assertCanChange, findById, notFound, publicCache } from "./access.js";
export { richTextSchema, sanitizeRichText } from "./rich-text.js";
export { httpUrl, idParam, pagination, publishStatus, slugParam } from "./schemas.js";
export { rethrowWriteError, type WriteErrorOptions } from "./write-errors.js";
export { isLive } from "@kcom/db";
