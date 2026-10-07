"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { CardContent, CardFooter } from "@repo/ui/components/card";
import { FieldGroup } from "@repo/ui/components/field";
import { CheckboxField, PasswordField, TextField } from "@repo/ui/components/form";
import { signInSchema } from "@repo/validation";
import type { SignInInput } from "@repo/validation";

import { href, routes } from "@/config/routes";
import { AuthCard } from "@/features/auth/auth-card";
import { authErrorMessage } from "@/features/auth/auth-errors";
import { authClient } from "@/lib/auth/client";

export const LoginForm = ({ next }: { next: string }) => {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", rememberMe: true },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    // rememberMe off: the session cookie ends when the browser closes.
    const { error } = await authClient.signIn.email({ ...values, callbackURL: next });
    if (error) {
      setServerError(authErrorMessage(error));
      return;
    }
    router.push(next);
    router.refresh();
  });

  return (
    <AuthCard
      title={routes.auth.login.title}
      description={
        <>
          メールアドレス・パスワードを付与されていない、第三者の利用は禁じられています。
          <br />
          必要な情報を記入してログインしてください。
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate autoComplete="off">
        <CardContent>
          <FieldGroup>
            {serverError ? (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            ) : null}
            <TextField
              control={form.control}
              name="email"
              label="メールアドレス"
              placeholder="メールアドレス"
              type="email"
              autoComplete="email"
            />
            <PasswordField
              control={form.control}
              name="password"
              placeholder="パスワード"
              label="パスワード"
              autoComplete="current-password"
            />
            <CheckboxField
              control={form.control}
              name="rememberMe"
              label="ログイン状態を保持する"
            />
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "ログイン中…" : "ログイン"}
          </Button>
          <Link href={href(routes.auth.forgotPassword)} className="text-sm underline">
            パスワードを忘れた方はこちら
          </Link>
        </CardFooter>
      </form>
    </AuthCard>
  );
};
