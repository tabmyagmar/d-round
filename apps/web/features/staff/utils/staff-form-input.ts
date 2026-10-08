import type { DefaultValues } from "react-hook-form";

import { todayIsoDay, toIsoDay } from "@repo/dayjs";
import { FIXED_MEMO_TYPES } from "@repo/validation";
import type { CreateStaffInput, StaffFormValues } from "@repo/validation";

import type { StaffDetail } from "@/features/staff/types";

type StaffMemoValue = StaffFormValues["memos"][number];

/** The five fixed memo slots in the legacy order with their stored text, then the added memos. */
const memosOf = (stored: readonly StaffMemoValue[]): StaffMemoValue[] => [
  ...FIXED_MEMO_TYPES.map((memoType) => ({
    memoType,
    content: stored.find((memo) => memo.memoType === memoType)?.content ?? "",
  })),
  ...stored
    .filter((memo) => memo.memoType === "CUSTOM")
    .map(({ memoType, content }) => ({ memoType, content })),
];

/** An employment period starting today, as the legacy form's first 在籍情報 row. */
export const newJobHistory = (): StaffFormValues["jobHistories"][number] => ({
  hireDate: todayIsoDay(),

  resignationDate: null,
  resignationReason: null,
});

/** スタッフ追加's starting values: empty fields, one period from today, the five memo slots. */
export const emptyStaffValues = (): DefaultValues<StaffFormValues> => ({
  lastName: "",
  firstName: "",
  lastNameKana: "",
  firstNameKana: "",
  branchName: "",
  email: null,
  phoneNumber: "",
  emergencyPhoneNumber: null,
  areas: [],
  regionCodes: [],
  prefectureCodes: [],
  chargerUserIds: [],
  address: { postCode: "", address1: "", pref: "", cityTown: "" },
  jobHistories: [newJobHistory()],
  familyMembers: [],
  memos: memosOf([]),
});

/**
 * スタッフ情報編集's starting values: the stored staff, its current 担当者, the address with the
 * master's parts and the memo slots. A value the legacy import left empty stays for the user.
 */
export const staffValuesOf = (staff: StaffDetail): DefaultValues<StaffFormValues> => ({
  employeeType: staff.employeeType,
  employeeNumber: staff.employeeNumber,
  lastName: staff.lastName,
  firstName: staff.firstName,
  lastNameKana: staff.lastNameKana,
  firstNameKana: staff.firstNameKana,
  gender: staff.gender,
  ...(staff.birthday ? { birthday: toIsoDay(staff.birthday) } : {}),
  ...(staff.position ? { position: staff.position } : {}),
  branchName: staff.branchName ?? "",
  email: staff.email,
  phoneNumber: staff.phoneNumber ?? "",
  emergencyPhoneNumber: staff.emergencyPhoneNumber,
  areas: staff.areas,
  regionCodes: staff.regions.map((region) => region.regionCode),
  prefectureCodes: staff.prefectures.map((prefecture) => prefecture.prefectureCode),
  chargerUserIds: staff.chargers
    .filter((charger) => charger.unassignedAt === null)
    .map((charger) => charger.userId),
  address: staff.address
    ? {
        postCode: staff.address.postCode,
        address1: staff.address.address1,
        pref: staff.address.sourceAddress.pref,
        cityTown: `${staff.address.sourceAddress.city}${staff.address.sourceAddress.town}`,
      }
    : { postCode: "", address1: "", pref: "", cityTown: "" },
  jobHistories: staff.jobHistories.map((job) => ({
    hireDate: toIsoDay(job.hireDate),
    resignationDate: job.resignationDate ? toIsoDay(job.resignationDate) : null,
    resignationReason: job.resignationReason,
  })),
  familyMembers: staff.familyMembers.map((member) => ({
    lastName: member.lastName,
    firstName: member.firstName,
    lastNameKana: member.lastNameKana,
    firstNameKana: member.firstNameKana,
    relation: member.relation,
    birthday: member.birthday ? toIsoDay(member.birthday) : null,
  })),
  memos: memosOf(staff.memos),
});

/** The form's values as `staff.create` / `staff.update` input: no address display parts, no empty memos. */
export const toStaffInput = (values: StaffFormValues): CreateStaffInput => {
  const { pref: _pref, cityTown: _cityTown, ...address } = values.address;
  return {
    ...values,
    address,
    memos: values.memos.filter((memo) => memo.content.trim() !== ""),
  };
};
