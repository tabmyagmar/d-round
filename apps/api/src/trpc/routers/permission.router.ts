import * as permissionService from "../../modules/permission/permission.service";
import { protectedProcedure, requireAbility, router } from "../init";

/** zod input → ability check → service. Nothing else. */
export const permissionRouter = router({
  catalog: protectedProcedure
    .use(requireAbility("changeRole", "User"))
    .query(({ ctx }) => permissionService.catalog(ctx)),
});
