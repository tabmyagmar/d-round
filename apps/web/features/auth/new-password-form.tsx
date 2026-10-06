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
import { PasswordField } from "@repo/ui/components/form";
import { resetPasswordSchema } from "@repo/validation";
import type { ResetPasswordInput } from "@repo/validation";

import { href, routes } from "@/config/routes";
import { authErrorMessage } from "@/features/auth/auth-errors";
import { authClient } from "@/lib/auth/client";

const PASSWORD_RULE = "8文字以上で、英字と数字をそれぞれ1文字以上含めてください。";

/** An expired or used link (Better Auth redirected with `?error=INVALID_TOKEN`). */
export const InvalidPasswordLink = () => (
  <Card>
    <CardHeader>
      <CardTitle>{routes.auth.newPassword.title}</CardTitle>
    </CardHeader>
    <CardContent>
      <Alert variant="destructive">
        <AlertTitle>このURLは無効です</AlertTitle>
        <AlertDescription>
          URLの有効期限が切れているか、すでに使用されています。お手数ですが「パスワードをお忘れの方」から新しいURLを再発行してください。
        </AlertDescription>
      </Alert>
    </CardContent>
    <CardFooter className="flex flex-col gap-3">
      <Button
        className="w-full"
        render={<Link href={href(routes.auth.forgotPassword)} />}
        nativeButton={false}
      >
        パスワードをお忘れの方
      </Button>
      <Link href={href(routes.auth.login)} className="text-sm underline">
        ログインへ戻る
      </Link>
    </CardFooter>
  </Card>
);

/**
 * Sets the password from a mailed link: the first password of an invited user or a reset. Every
 * other session of the user ends on success (Better Auth `revokeSessionsOnPasswordReset`).
 */
export const NewPasswordForm = ({ token }: { token: string }) => {
  const [done, setDone] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const onSubmit = form.handleSubmit(async ({ newPassword }) => {
    setServerError(null);
    const { error } = await authClient.resetPassword({ newPassword, token });
    if (error) {
      if (error.code === "INVALID_TOKEN") {
        setInvalidLink(true);
        return;
      }
      setServerError(authErrorMessage(error));
      return;
    }
    setDone(true);
  });

  if (invalidLink) {
    return <InvalidPasswordLink />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{routes.auth.newPassword.title}</CardTitle>
        <CardDescription>{done ? null : PASSWORD_RULE}</CardDescription>
      </CardHeader>
      {done ? (
        <>
          <CardContent>
            <Alert>
              <AlertTitle>パスワードを設定しました</AlertTitle>
              <AlertDescription>
                ログイン画面から新しいパスワードでログインしてください。
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              render={<Link href={href(routes.auth.login)} />}
              nativeButton={false}
            >
              ログイン画面へ
            </Button>
          </CardFooter>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <CardContent>
            <FieldGroup>
              {serverError ? (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              ) : null}
              <PasswordField
                control={form.control}
                name="newPassword"
                label="新しいパスワード"
                autoComplete="new-password"
              />
              <PasswordField
                control={form.control}
                name="confirmPassword"
                label="新しいパスワード（確認）"
                autoComplete="new-password"
              />
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "設定中…" : "設定する"}
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  );
};
