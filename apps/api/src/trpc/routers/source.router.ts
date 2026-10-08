import { addressByPostCodeSchema } from "@repo/validation";

import * as sourceService from "../../modules/source/source.service";
import { protectedProcedure, requireAbility, router } from "../init";

/** zod input → ability check → service. Reference data is read by every signed-in user. */
export const sourceRouter = router({
  regions: protectedProcedure
    .use(requireAbility("read", "Source"))
    .query(({ ctx }) => sourceService.regions(ctx)),

  prefectures: protectedProcedure
    .use(requireAbility("read", "Source"))
    .query(({ ctx }) => sourceService.prefectures(ctx)),

  addressByPostCode: protectedProcedure
    .use(requireAbility("read", "Source"))
    .input(addressByPostCodeSchema)
    .query(({ ctx, input }) => sourceService.addressByPostCode(ctx, input.postCode)),
});
