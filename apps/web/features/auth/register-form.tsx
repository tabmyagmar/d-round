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
import { FieldGroup } from "@repo/ui/components/field";
import { PasswordField, TextField } from "@repo/ui/components/form";
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
            <TextField control={form.control} name="name" label="Full name" autoComplete="name" />
            <TextField
              control={form.control}
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
            />
            <PasswordField
              control={form.control}
              name="password"
              label="Password"
              autoComplete="new-password"
              description="At least 8 characters."
            />
            <TextField
              control={form.control}
              name="employeeCode"
              label="Employee code (optional)"
              emptyAs="undefined"
            />
            <TextField
              control={form.control}
              name="department"
              label="Department (optional)"
              emptyAs="undefined"
            />
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
