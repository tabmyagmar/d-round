import {
  chargerOptionsSchema,
  employeeNumberAvailableSchema,
  inviteUserSchema,
  listUsersSchema,
  updateProfileSchema,
  updateUserSchema,
  userIdSchema,
} from "@repo/validation";

import * as userService from "../../modules/user/user.service";
import { protectedProcedure, requireAbility, router } from "../init";

/** zod input → ability check → service. Nothing else. */
export const userRouter = router({
  me: protectedProcedure
    .use(requireAbility("read", "User"))
    .query(({ ctx }) => userService.getById(ctx, ctx.user.id)),

  byId: protectedProcedure
    .use(requireAbility("read", "User"))
    .input(userIdSchema)
    .query(({ ctx, input }) => userService.getById(ctx, input.userId)),

  list: protectedProcedure
    .use(requireAbility("read", "User"))
    .input(listUsersSchema)
    .query(({ ctx, input }) => userService.list(ctx, input)),

  updateProfile: protectedProcedure
    .use(requireAbility("update", "User"))
    .input(updateProfileSchema)
    .mutation(({ ctx, input }) => userService.updateProfile(ctx, input)),

  // Role and permission changes additionally need `changeRole`; the service checks them.
  update: protectedProcedure
    .use(requireAbility("update", "User"))
    .input(updateUserSchema)
    .mutation(({ ctx, input }) => userService.update(ctx, input)),

  deactivate: protectedProcedure
    .use(requireAbility("status", "User"))
    .input(userIdSchema)
    .mutation(({ ctx, input }) => userService.deactivate(ctx, input.userId)),

  reactivate: protectedProcedure
    .use(requireAbility("status", "User"))
    .input(userIdSchema)
    .mutation(({ ctx, input }) => userService.reactivate(ctx, input.userId)),

  invite: protectedProcedure
    .use(requireAbility("create", "User"))
    .input(inviteUserSchema)
    .mutation(({ ctx, input }) => userService.invite(ctx, input)),

  sendPasswordReset: protectedProcedure
    .use(requireAbility("update", "User"))
    .input(userIdSchema)
    .mutation(({ ctx, input }) => userService.sendPasswordReset(ctx, input.userId)),

  employeeNumberAvailable: protectedProcedure
    .use(requireAbility("read", "User"))
    .input(employeeNumberAvailableSchema)
    .query(({ ctx, input }) => userService.isEmployeeNumberAvailable(ctx, input)),

  // The スタッフ form's 担当者 picker: users covering the staff's regions.
  chargerOptions: protectedProcedure
    .use(requireAbility("read", "User"))
    .input(chargerOptionsSchema)
    .query(({ ctx, input }) => userService.chargerOptions(ctx, input)),
});
