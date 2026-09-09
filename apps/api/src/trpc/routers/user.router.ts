import {
  changeRoleSchema,
  listUsersSchema,
  updateProfileSchema,
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

  changeRole: protectedProcedure
    .use(requireAbility("changeRole", "User"))
    .input(changeRoleSchema)
    .mutation(({ ctx, input }) => userService.changeRole(ctx, input)),

  deactivate: protectedProcedure
    .use(requireAbility("delete", "User"))
    .input(userIdSchema)
    .mutation(({ ctx, input }) => userService.deactivate(ctx, input.userId)),
});
