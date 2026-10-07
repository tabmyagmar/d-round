import { z } from "zod";

/** A permission catalog key (`permissions.key`, e.g. "1101"). The API checks it exists. */
export const permissionKeySchema = z.string().trim().min(1).max(32);

/** The child permissions ticked for one user; duplicates are harmless and dropped by the API. */
export const permissionKeysSchema = z.array(permissionKeySchema).max(500);
