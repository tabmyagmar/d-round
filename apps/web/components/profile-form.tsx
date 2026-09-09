"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { updateProfileSchema } from "@repo/validation";
import type { UpdateProfileInput } from "@repo/validation";

import { useTRPC } from "@/lib/trpc/react";

export type ProfileFormProps = {
  /** The user being edited; omit to edit yourself. */
  userId?: string;
  initial: { name: string; employeeCode: string | null; department: string | null };
  disabled?: boolean;
};

const emptyToNull = (value: string): string | null => (value.trim() === "" ? null : value.trim());

/** Shared by /profile (self) and /users/[id] (admins, HR). Same zod schema as the API. */
export const ProfileForm = ({ userId, initial, disabled = false }: ProfileFormProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      ...(userId ? { userId } : {}),
      name: initial.name,
      employeeCode: initial.employeeCode,
      department: initial.department,
    },
  });

  const update = useMutation(
    trpc.user.updateProfile.mutationOptions({
      onSuccess: async (user) => {
        toast.success("Profile saved");
        form.reset({
          ...(userId ? { userId } : {}),
          name: user.name,
          employeeCode: user.employeeCode,
          department: user.department,
        });
        await queryClient.invalidateQueries(trpc.user.pathFilter());
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  return (
    <form
      onSubmit={form.handleSubmit((values) => {
        update.mutate(values);
      })}
      noValidate
      className="flex flex-col gap-4"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Full name</FieldLabel>
          <Input id="name" disabled={disabled} {...form.register("name")} />
          <FieldError errors={[form.formState.errors.name]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="employeeCode">Employee code</FieldLabel>
          <Input
            id="employeeCode"
            disabled={disabled}
            {...form.register("employeeCode", { setValueAs: emptyToNull })}
          />
          <FieldError errors={[form.formState.errors.employeeCode]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="department">Department</FieldLabel>
          <Input
            id="department"
            disabled={disabled}
            {...form.register("department", { setValueAs: emptyToNull })}
          />
          <FieldError errors={[form.formState.errors.department]} />
        </Field>
      </FieldGroup>
      {disabled ? null : (
        <div>
          <Button type="submit" disabled={update.isPending || !form.formState.isDirty}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </form>
  );
};
