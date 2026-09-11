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
import { signInSchema } from "@repo/validation";
import type { SignInInput } from "@repo/validation";

import { authClient } from "@/lib/auth/client";

export const LoginForm = ({ next }: { next: string }) => {
  const router = useRouter();
  const [serverError, setServerError] = useState<{ message: string; unverified: boolean } | null>(
    null,
  );
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const { error } = await authClient.signIn.email({ ...values, callbackURL: next });
    if (error) {
      setServerError({
        message: error.message ?? "Sign in failed",
        unverified: error.status === 403,
      });
      return;
    }
    router.push(next);
    router.refresh();
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use the email and password of your d-round account.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent>
          <FieldGroup>
            {serverError ? (
              <Alert variant="destructive">
                <AlertTitle>
                  {serverError.unverified ? "Email not verified" : "Sign in failed"}
                </AlertTitle>
                <AlertDescription>
                  {serverError.message}
                  {serverError.unverified ? (
                    <>
                      {" "}
                      <Link
                        className="underline"
                        href={`/verify-email?email=${encodeURIComponent(form.getValues("email"))}`}
                      >
                        Resend the verification email
                      </Link>
                    </>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}
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
              autoComplete="current-password"
            />
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-sm text-muted-foreground">
            No account yet?{" "}
            <Link href="/register" className="underline">
              Create one
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
};
