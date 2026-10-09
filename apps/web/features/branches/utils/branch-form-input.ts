import type { DefaultValues } from "react-hook-form";

import { formatPostCode } from "@repo/validation";
import type { BranchFormValues, CreateBranchInput } from "@repo/validation";

import type { BranchDetail } from "@/features/branches/types";

const NO_ADDRESS = { postCode: "", address1: "", pref: "", cityTown: "" };

/** 就業先部署追加's starting values: empty fields, no FAX or memo; 就業先番号 follows the client. */
export const emptyBranchValues = (): DefaultValues<BranchFormValues> => ({
  clientId: "",
  name: "",
  nameKana: "",
  chargerUserIds: [],
  departmentName: "",
  departmentNameKana: "",
  departmentFax: null,
  address: NO_ADDRESS,
  contactLastName: "",
  contactFirstName: "",
  contactLastNameKana: "",
  contactFirstNameKana: "",
  contactEmail: "",
  memo: null,
});

/** 就業先部署編集's starting values: the stored branch with the master's address parts. */
export const branchValuesOf = (branch: BranchDetail): DefaultValues<BranchFormValues> => ({
  clientId: branch.clientId,
  number: branch.number,
  name: branch.name,
  nameKana: branch.nameKana,
  area: branch.area,
  regionCode: branch.regionCode,
  chargerUserIds: branch.chargers.map((charger) => charger.userId),
  departmentNumber: branch.departmentNumber,
  departmentName: branch.departmentName,
  departmentNameKana: branch.departmentNameKana,
  departmentFax: branch.departmentFax,
  address: branch.address
    ? {
        postCode: formatPostCode(branch.address.postCode),
        address1: branch.address.address1,
        pref: branch.address.sourceAddress.pref,
        cityTown: `${branch.address.sourceAddress.city}${branch.address.sourceAddress.town}`,
      }
    : NO_ADDRESS,
  contactLastName: branch.contactLastName,
  contactFirstName: branch.contactFirstName,
  contactLastNameKana: branch.contactLastNameKana,
  contactFirstNameKana: branch.contactFirstNameKana,
  contactPosition: branch.contactPosition,
  contactEmail: branch.contactEmail,
  memo: branch.memo,
});

/** The form's values as `branch.create` / `branch.update` input: no address display parts. */
export const toBranchInput = (values: BranchFormValues): CreateBranchInput => {
  const { pref: _pref, cityTown: _cityTown, ...address } = values.address;
  return { ...values, address };
};
