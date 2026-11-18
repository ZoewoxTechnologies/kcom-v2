/**
 * Shared building blocks for content resources (capsules, series, blog, books,
 * events). Small explicit helpers plus two router factories for the standard
 * publishable-table routes; a resource with custom behaviour (capsules, series)
 * hand-writes its routes from the helpers instead.
 *
 * - `schemas`: id/slug params, http(s) URL, publish status, pagination.
 * - `richTextSchema` / `sanitizeRichText`: validate and sanitise rich-text JSON.
 * - `assertCanChange`: the publish-permission rule, in one place.
 * - `rethrowWriteError`: map unique/foreign-key/check violations to 409/422.
 * - `notFound(what)`, `findById(db, table, id, label)`: 404 helpers.
 * - `publicCache`: middleware for cacheable public routers.
 * - `adminCrudRoutes` / `publicContentRoutes`: the standard admin CRUD and public read routers.
 * - `isLive(table)`: public-read filter (published and publish time passed).
 */
export {
  adminCrudRoutes,
  publicContentRoutes,
  type AdminCrudOptions,
  type PublicRoutesOptions,
} from "./crud.js";
export { assertCanChange, findById, notFound, publicCache } from "./access.js";
export { richTextSchema, sanitizeRichText } from "./rich-text.js";
export { httpUrl, idParam, pagination, publishStatus, slugParam } from "./schemas.js";
export { rethrowWriteError, type WriteErrorOptions } from "./write-errors.js";
export { isLive } from "@kcom/db";
