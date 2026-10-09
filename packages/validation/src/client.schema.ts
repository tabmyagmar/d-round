import { z } from "zod";

import { idSchema, paginationSchema, requiredText } from "./common.schema";
import { faxSchema, phoneSchema } from "./phone.schema";
import {
  addressFormSchema,
  addressSchema,
  areasSchema,
  regionCodeSchema,
  regionCodesSchema,
  sourceAreaSchema,
} from "./source.schema";
import { chargerUserIdsSchema, employeeNumberSchema, kanaSchema, SORT_ORDERS } from "./user.schema";

/** クライアント (ADR 0011): the legacy form's fields and messages, shared by the API and the form. */

/** 利用中 / 保留 / 停止 of a クライアント or a 就業先部署; deletion is allowed for 停止 only. */
export const GENERAL_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;
export const generalStatusSchema = z.enum(GENERAL_STATUSES);
export type GeneralStatus = z.infer<typeof generalStatusSchema>;

/** 受注区分 (legacy EnumClientOrder), in the legacy order. */
export const CLIENT_ORDER_TYPES = ["CONTRACT_WORK", "DISPATCH", "SPOT_WORK"] as const;
export const clientOrderTypeSchema = z.enum(CLIENT_ORDER_TYPES);
export type ClientOrderType = z.infer<typeof clientOrderTypeSchema>;

/** Clients in one delete (the legacy limit). */
export const CLIENT_DELETE_MAX = 50;

/** Distinct 受注区分 in the legacy order. */
const orderTypesSchema = z
  .array(clientOrderTypeSchema)
  .transform((types) => CLIENT_ORDER_TYPES.filter((type) => types.includes(type)));

/** A host with a dot and a top-level domain of two or more letters, the scheme optional. */
const isWebAddress = (value: string): boolean => {
  try {
    const { hostname } = new URL(/^https?:\/\//i.test(value) ? value : `http://${value}`);
    const labels = hostname.split(".");
    return labels.length > 1 && (labels.at(-1) ?? "").length >= 2;
  } catch {
    return false;
  }
};

/** URL as the legacy UrlSchema took it (`example.com` or `https://example.com`), stored as typed. */
export const urlSchema = z
  .string()
  .trim()
  .max(255, { error: "URLは255文字以内で入力してください" })
  .refine(isWebAddress, {
    error: "有効なURLを入力してください（例: example.com または https://example.com）",
  });

/** クライアント追加: every field of the legacy form but the image (the file-upload ticket). */
export const createClientSchema = z.object({
  number: employeeNumberSchema("クライアント番号"),
  name: requiredText("クライアント名", 100),
  nameKana: kanaSchema("クライアント名（カタカナ）", 100),
  areas: areasSchema.refine((areas) => areas.length > 0, { error: "エリアを選択してください" }),
  regionCodes: regionCodesSchema.refine((codes) => codes.length > 0, {
    error: "地域を選択してください",
  }),
  chargerUserIds: chargerUserIdsSchema,
  address: addressSchema,
  phoneNumber: phoneSchema,
  fax: faxSchema.nullable(),
  webUrl: urlSchema.nullable(),
  orderTypes: orderTypesSchema.refine((types) => types.length > 0, {
    error: "受注種別を選択してください",
  }),
});
export type CreateClientInput = z.output<typeof createClientSchema>;

/** The client form (create and edit): the API's fields with the address as `AddressFields` edits it. */
export const clientFormSchema = createClientSchema.extend({ address: addressFormSchema });
export type ClientFormValues = z.input<typeof clientFormSchema>;

/** クライアント情報編集: the whole form again (regions and 担当者 are replaced). */
export const updateClientSchema = createClientSchema.extend({ clientId: idSchema });
export type UpdateClientInput = z.output<typeof updateClientSchema>;

export const clientIdSchema = z.object({ clientId: idSchema });

export const changeClientStatusSchema = z.object({
  clientId: idSchema,
  status: generalStatusSchema,
});
export type ChangeClientStatusInput = z.output<typeof changeClientStatusSchema>;

/** クライアント削除: one row or the selection, 停止 clients only. */
export const deleteClientsSchema = z.object({
  clientIds: z.array(idSchema).min(1).max(CLIENT_DELETE_MAX),
});
export type DeleteClientsInput = z.output<typeof deleteClientsSchema>;

/** Whether a クライアント番号 is free among non-deleted clients; `excludeClientId` is the one edited. */
export const clientNumberAvailableSchema = z.object({
  number: employeeNumberSchema("クライアント番号"),
  excludeClientId: idSchema.optional(),
});
export type ClientNumberAvailableInput = z.output<typeof clientNumberAvailableSchema>;

/** The clients the 就業先部署 form offers: by クライアント番号 (digits), name or reading. */
export const clientOptionsSchema = z.object({
  search: z.string().trim().max(100).optional(),
});
export type ClientOptionsInput = z.output<typeof clientOptionsSchema>;

/** Columns the client list may be sorted by; `name` sorts by the reading. */
export const CLIENT_SORT_FIELDS = ["number", "name", "createdAt"] as const;
export type ClientSortField = (typeof CLIENT_SORT_FIELDS)[number];

/** The list: without `statuses`, every client but the 停止 ones (legacy `status not DELETE`). */
export const listClientsSchema = paginationSchema.extend({
  /** クライアント番号 (digits), name, reading or a 担当者's name. */
  search: z.string().trim().min(1).max(100).optional(),
  statuses: z.array(generalStatusSchema).optional(),
  areas: z.array(sourceAreaSchema).optional(),
  regionCodes: z.array(regionCodeSchema).optional(),
  orderTypes: z.array(clientOrderTypeSchema).optional(),
  sortBy: z.enum(CLIENT_SORT_FIELDS).default("number"),
  sortOrder: z.enum(SORT_ORDERS).default("asc"),
});
export type ListClientsInput = z.input<typeof listClientsSchema>;
export type ListClientsQuery = z.output<typeof listClientsSchema>;
