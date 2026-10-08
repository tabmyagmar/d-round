import { z } from "zod";

import { generalStatusSchema } from "./client.schema";
import { idSchema, paginationSchema, requiredText } from "./common.schema";
import { faxSchema } from "./phone.schema";
import {
  addressFormSchema,
  addressSchema,
  regionCodeSchema,
  SOURCE_AREAS,
  sourceAreaSchema,
} from "./source.schema";
import {
  chargerUserIdsSchema,
  emailSchema,
  employeeNumberSchema,
  kanaSchema,
  positionSchema,
  SORT_ORDERS,
} from "./user.schema";

/** 就業先部署 (ADR 0011): the legacy form's fields and messages, shared by the API and the form. */

/** Branches in one delete (the legacy limit). */
export const BRANCH_DELETE_MAX = 50;

/** The longest メモ a branch keeps. */
export const BRANCH_MEMO_MAX = 2000;

/**
 * 就業先部署追加: the legacy form's four cards — the 就業先 (クライアント, 番号, 名, カナ, one エリア,
 * one 地域, 担当者), the 部署 with its address, the 連絡担当者 and the メモ.
 */
export const createBranchSchema = z.object({
  clientId: z.uuid({ error: "クライアントを選択してください" }),
  number: employeeNumberSchema("就業先番号"),
  name: requiredText("就業先名", 100),
  nameKana: kanaSchema("就業先名（カタカナ）", 100),
  area: z.enum(SOURCE_AREAS, { error: "エリアを選択してください" }),
  regionCode: z
    .number({ error: "地域を選択してください" })
    .int()
    .min(1, { error: "地域を選択してください" }),
  chargerUserIds: chargerUserIdsSchema,
  departmentNumber: employeeNumberSchema("部署番号"),
  departmentName: requiredText("部署名", 100),
  departmentNameKana: kanaSchema("部署名（カタカナ）", 100),
  departmentFax: faxSchema.nullable(),
  address: addressSchema,
  contactLastName: requiredText("姓", 80),
  contactFirstName: requiredText("名", 80),
  contactLastNameKana: kanaSchema("セイ"),
  contactFirstNameKana: kanaSchema("メイ"),
  contactPosition: positionSchema,
  contactEmail: emailSchema,
  /** Blank text is no memo. */
  memo: z
    .string()
    .trim()
    .max(BRANCH_MEMO_MAX, {
      error: `メモは${String(BRANCH_MEMO_MAX)}文字以内で入力してください`,
    })
    .nullable()
    .transform((memo) => (memo === "" ? null : memo)),
});
export type CreateBranchInput = z.output<typeof createBranchSchema>;

/** The branch form (create and edit): the API's fields with the address as `AddressFields` edits it. */
export const branchFormSchema = createBranchSchema.extend({ address: addressFormSchema });
export type BranchFormValues = z.input<typeof branchFormSchema>;

/** 就業先部署編集: the whole form again (the 担当者 are replaced). */
export const updateBranchSchema = createBranchSchema.extend({ branchId: idSchema });
export type UpdateBranchInput = z.output<typeof updateBranchSchema>;

export const branchIdSchema = z.object({ branchId: idSchema });

export const changeBranchStatusSchema = z.object({
  branchId: idSchema,
  status: generalStatusSchema,
});
export type ChangeBranchStatusInput = z.output<typeof changeBranchStatusSchema>;

/** 就業先部署削除: one row or the selection, 停止 branches only. */
export const deleteBranchesSchema = z.object({
  branchIds: z.array(idSchema).min(1).max(BRANCH_DELETE_MAX),
});
export type DeleteBranchesInput = z.output<typeof deleteBranchesSchema>;

/** The next free 就業先番号 of a client (legacy nextBranchNumber). */
export const nextBranchNumberSchema = z.object({ clientId: idSchema });
export type NextBranchNumberInput = z.output<typeof nextBranchNumberSchema>;

/** Columns the branch list may be sorted by; `name` and `client` sort by the readings. */
export const BRANCH_SORT_FIELDS = ["number", "name", "client", "createdAt"] as const;
export type BranchSortField = (typeof BRANCH_SORT_FIELDS)[number];

/** The list: without `statuses`, every branch but the 停止 ones (legacy `status not DELETE`). */
export const listBranchesSchema = paginationSchema.extend({
  /** 就業先番号 (digits), name, reading, the client's name or reading, or a 担当者's name. */
  search: z.string().trim().min(1).max(100).optional(),
  /** One client's branches (the client detail's 就業先部署情報). */
  clientId: idSchema.optional(),
  statuses: z.array(generalStatusSchema).optional(),
  areas: z.array(sourceAreaSchema).optional(),
  regionCodes: z.array(regionCodeSchema).optional(),
  sortBy: z.enum(BRANCH_SORT_FIELDS).default("number"),
  sortOrder: z.enum(SORT_ORDERS).default("asc"),
});
export type ListBranchesInput = z.input<typeof listBranchesSchema>;
export type ListBranchesQuery = z.output<typeof listBranchesSchema>;
