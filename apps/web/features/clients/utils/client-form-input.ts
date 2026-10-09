import type { DefaultValues } from "react-hook-form";

import { formatPostCode } from "@repo/validation";
import type { ClientFormValues, CreateClientInput } from "@repo/validation";

import type { ClientDetail } from "@/features/clients/types";

const NO_ADDRESS = { postCode: "", address1: "", pref: "", cityTown: "" };

/** クライアント追加's starting values: empty fields, no FAX or URL. */
export const emptyClientValues = (): DefaultValues<ClientFormValues> => ({
  name: "",
  nameKana: "",
  areas: [],
  regionCodes: [],
  chargerUserIds: [],
  address: NO_ADDRESS,
  phoneNumber: "",
  fax: null,
  webUrl: null,
  orderTypes: [],
});

/** クライアント情報編集's starting values: the stored client with the master's address parts. */
export const clientValuesOf = (client: ClientDetail): DefaultValues<ClientFormValues> => ({
  number: client.number,
  name: client.name,
  nameKana: client.nameKana,
  areas: client.areas,
  regionCodes: client.regions.map((region) => region.regionCode),
  chargerUserIds: client.chargers.map((charger) => charger.userId),
  address: client.address
    ? {
        postCode: formatPostCode(client.address.postCode),
        address1: client.address.address1,
        pref: client.address.sourceAddress.pref,
        cityTown: `${client.address.sourceAddress.city}${client.address.sourceAddress.town}`,
      }
    : NO_ADDRESS,
  phoneNumber: client.phoneNumber,
  fax: client.fax,
  webUrl: client.webUrl,
  orderTypes: client.orderTypes,
});

/** The form's values as `client.create` / `client.update` input: no address display parts. */
export const toClientInput = (values: ClientFormValues): CreateClientInput => {
  const { pref: _pref, cityTown: _cityTown, ...address } = values.address;
  return { ...values, address };
};
