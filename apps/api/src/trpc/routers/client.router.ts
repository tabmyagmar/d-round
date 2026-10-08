import {
  changeClientStatusSchema,
  clientIdSchema,
  clientNumberAvailableSchema,
  clientOptionsSchema,
  createClientSchema,
  deleteClientsSchema,
  listClientsSchema,
  updateClientSchema,
} from "@repo/validation";

import * as clientService from "../../modules/client/client.service";
import { protectedProcedure, requireAbility, router } from "../init";

/** zod input → ability check (the Admin_Client catalog rows) → service. Nothing else. */
export const clientRouter = router({
  list: protectedProcedure
    .use(requireAbility("read", "Client"))
    .input(listClientsSchema)
    .query(({ ctx, input }) => clientService.list(ctx, input)),

  byId: protectedProcedure
    .use(requireAbility("read", "Client"))
    .input(clientIdSchema)
    .query(({ ctx, input }) => clientService.getById(ctx, input.clientId)),

  create: protectedProcedure
    .use(requireAbility("create", "Client"))
    .input(createClientSchema)
    .mutation(({ ctx, input }) => clientService.create(ctx, input)),

  update: protectedProcedure
    .use(requireAbility("update", "Client"))
    .input(updateClientSchema)
    .mutation(({ ctx, input }) => clientService.update(ctx, input)),

  changeStatus: protectedProcedure
    .use(requireAbility("status", "Client"))
    .input(changeClientStatusSchema)
    .mutation(({ ctx, input }) => clientService.changeStatus(ctx, input)),

  deleteMany: protectedProcedure
    .use(requireAbility("delete", "Client"))
    .input(deleteClientsSchema)
    .mutation(({ ctx, input }) => clientService.removeMany(ctx, input)),

  // The form's pre-check; the service also asks for `create` or `update Client`.
  numberAvailable: protectedProcedure
    .use(requireAbility("read", "Client"))
    .input(clientNumberAvailableSchema)
    .query(({ ctx, input }) => clientService.isNumberAvailable(ctx, input)),

  // The 就業先部署 form's クライアント picker.
  options: protectedProcedure
    .use(requireAbility("read", "Client"))
    .input(clientOptionsSchema)
    .query(({ ctx, input }) => clientService.options(ctx, input)),
});
