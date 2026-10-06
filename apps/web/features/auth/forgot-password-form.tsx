"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
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
import { TextField } from "@repo/ui/components/form";
import { forgotPasswordSchema } from "@repo/validation";
import type { ForgotPasswordInput } from "@repo/validation";

import { href, routes } from "@/config/routes";
import { authErrorMessage } from "@/features/auth/auth-errors";
import { authClient } from "@/lib/auth/client";

/**
 * Asks Better Auth to mail a reset link. The answer is the same whether or not the address is
 * registered, so the confirmation never reveals who has an account.
 */
export const ForgotPasswordForm = () => {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setServerError(null);
    const { error } = await authClient.requestPasswordReset({
      email,
      // Absolute: Better Auth redirects there from its own origin and checks it is trusted.
      redirectTo: `${window.location.origin}${href(routes.auth.newPassword)}`,
    });
    if (error) {
      setServerError(authErrorMessage(error));
      return;
    }
    setSent(true);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{routes.auth.forgotPassword.title}</CardTitle>
        <CardDescription>
          登録されているメールアドレスを入力してください。パスワード再設定用のURLをお送りします。
        </CardDescription>
      </CardHeader>
      {sent ? (
        <CardContent>
          <Alert>
            <AlertTitle>メールを送信しました。ご確認ください。</AlertTitle>
            <AlertDescription>
              メールが届かない場合は、入力したメールアドレスに誤りや不要なスペースがないかご確認のうえ、再度お試しください。URLの有効期限は1時間です。
            </AlertDescription>
          </Alert>
        </CardContent>
      ) : (
        <form onSubmit={onSubmit} noValidate>
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
                type="email"
                autoComplete="email"
              />
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "送信中…" : "送信"}
            </Button>
          </CardFooter>
        </form>
      )}
      <CardFooter>
        <Link href={href(routes.auth.login)} className="text-sm underline">
          ログインへ戻る
        </Link>
      </CardFooter>
    </Card>
  );
};
