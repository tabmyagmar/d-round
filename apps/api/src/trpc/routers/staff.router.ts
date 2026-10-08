import {
  changeStaffStatusSchema,
  createStaffSchema,
  deleteStaffsSchema,
  listStaffsSchema,
  staffIdSchema,
  staffNumberAvailableSchema,
  updateStaffSchema,
  userIdSchema,
} from "@repo/validation";

import * as staffService from "../../modules/staff/staff.service";
import { protectedProcedure, requireAbility, router } from "../init";

/** zod input → ability check (the Admin_Staff catalog rows) → service. Nothing else. */
export const staffRouter = router({
  list: protectedProcedure
    .use(requireAbility("read", "Staff"))
    .input(listStaffsSchema)
    .query(({ ctx, input }) => staffService.list(ctx, input)),

  byId: protectedProcedure
    .use(requireAbility("read", "Staff"))
    .input(staffIdSchema)
    .query(({ ctx, input }) => staffService.getById(ctx, input.staffId)),

  create: protectedProcedure
    .use(requireAbility("create", "Staff"))
    .input(createStaffSchema)
    .mutation(({ ctx, input }) => staffService.create(ctx, input)),

  update: protectedProcedure
    .use(requireAbility("update", "Staff"))
    .input(updateStaffSchema)
    .mutation(({ ctx, input }) => staffService.update(ctx, input)),

  changeStatus: protectedProcedure
    .use(requireAbility("status", "Staff"))
    .input(changeStaffStatusSchema)
    .mutation(({ ctx, input }) => staffService.changeStatus(ctx, input)),

  deleteMany: protectedProcedure
    .use(requireAbility("delete", "Staff"))
    .input(deleteStaffsSchema)
    .mutation(({ ctx, input }) => staffService.removeMany(ctx, input)),

  // The form's pre-check; the service also accepts `update Staff` (the edit form).
  employeeNumberAvailable: protectedProcedure
    .use(requireAbility("read", "Staff"))
    .input(staffNumberAvailableSchema)
    .query(({ ctx, input }) => staffService.isEmployeeNumberAvailable(ctx, input)),

  // The user detail's 担当スタッフ.
  byCharger: protectedProcedure
    .use(requireAbility("read", "Staff"))
    .input(userIdSchema)
    .query(({ ctx, input }) => staffService.listByCharger(ctx, input.userId)),
});
