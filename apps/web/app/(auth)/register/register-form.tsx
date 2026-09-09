"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { signUpSchema } from "@repo/validation";
import type { SignUpInput } from "@repo/validation";

import { authClient } from "@/lib/auth/client";

export const RegisterForm = () => {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
      ...(values.employeeCode ? { employeeCode: values.employeeCode } : {}),
      ...(values.department ? { department: values.department } : {}),
      // Better Auth redirects here after the verification link is clicked.
      callbackURL: `${window.location.origin}/dashboard`,
    });
    if (error) {
      setServerError(error.message ?? "Registration failed");
      return;
    }
    router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>We will send a verification link to your email address.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent>
          <FieldGroup>
            {serverError ? (
              <Alert variant="destructive">
                <AlertTitle>Registration failed</AlertTitle>
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            ) : null}
            <Field>
              <FieldLabel htmlFor="name">Full name</FieldLabel>
              <Input id="name" autoComplete="name" {...form.register("name")} />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
              <FieldError errors={[form.formState.errors.email]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...form.register("password")}
              />
              <FieldDescription>At least 8 characters.</FieldDescription>
              <FieldError errors={[form.formState.errors.password]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="employeeCode">Employee code (optional)</FieldLabel>
              <Input
                id="employeeCode"
                {...form.register("employeeCode", { setValueAs: (v: string) => v || undefined })}
              />
              <FieldError errors={[form.formState.errors.employeeCode]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="department">Department (optional)</FieldLabel>
              <Input
                id="department"
                {...form.register("department", { setValueAs: (v: string) => v || undefined })}
              />
              <FieldError errors={[form.formState.errors.department]} />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Creating account…" : "Create account"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Already registered?{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
};
