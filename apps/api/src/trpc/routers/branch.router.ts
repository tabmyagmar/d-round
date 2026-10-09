import {
  branchIdSchema,
  changeBranchStatusSchema,
  createBranchSchema,
  deleteBranchesSchema,
  listBranchesSchema,
  nextBranchNumberSchema,
  updateBranchSchema,
} from "@repo/validation";

import * as branchService from "../../modules/branch/branch.service";
import { protectedProcedure, requireAbility, router } from "../init";

/** zod input → ability check (the Admin_Branch catalog rows) → service. Nothing else. */
export const branchRouter = router({
  list: protectedProcedure
    .use(requireAbility("read", "Branch"))
    .input(listBranchesSchema)
    .query(({ ctx, input }) => branchService.list(ctx, input)),

  byId: protectedProcedure
    .use(requireAbility("read", "Branch"))
    .input(branchIdSchema)
    .query(({ ctx, input }) => branchService.getById(ctx, input.branchId)),

  create: protectedProcedure
    .use(requireAbility("create", "Branch"))
    .input(createBranchSchema)
    .mutation(({ ctx, input }) => branchService.create(ctx, input)),

  update: protectedProcedure
    .use(requireAbility("update", "Branch"))
    .input(updateBranchSchema)
    .mutation(({ ctx, input }) => branchService.update(ctx, input)),

  changeStatus: protectedProcedure
    .use(requireAbility("status", "Branch"))
    .input(changeBranchStatusSchema)
    .mutation(({ ctx, input }) => branchService.changeStatus(ctx, input)),

  deleteMany: protectedProcedure
    .use(requireAbility("delete", "Branch"))
    .input(deleteBranchesSchema)
    .mutation(({ ctx, input }) => branchService.removeMany(ctx, input)),

  // The create form fills 就業先番号 from it; the service also asks for `create` or `update Branch`.
  nextNumber: protectedProcedure
    .use(requireAbility("read", "Branch"))
    .input(nextBranchNumberSchema)
    .query(({ ctx, input }) => branchService.nextNumber(ctx, input)),
});
