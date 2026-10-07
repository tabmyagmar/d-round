"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { CardContent, CardFooter } from "@repo/ui/components/card";
import { FieldGroup } from "@repo/ui/components/field";
import { PasswordField } from "@repo/ui/components/form";
import { resetPasswordSchema } from "@repo/validation";
import type { ResetPasswordInput } from "@repo/validation";

import { href, routes } from "@/config/routes";
import { AuthCard } from "@/features/auth/auth-card";
import { authErrorMessage } from "@/features/auth/auth-errors";
import { authClient } from "@/lib/auth/client";

const PASSWORD_RULE = "8文字以上で、英字と数字をそれぞれ1文字以上含めてください。";

/** An expired or used link (Better Auth redirected with `?error=INVALID_TOKEN`). */
export const InvalidPasswordLink = () => (
  <AuthCard title={routes.auth.newPassword.title}>
    <CardContent>
      <Alert variant="destructive">
        <AlertTitle>パスワード変更用のURLはすでに使用されています。</AlertTitle>
        <AlertDescription>
          再度パスワードを変更する場合は、「パスワードを忘れた方はこちら」から新しいURLを再発行してください。
        </AlertDescription>
      </Alert>
    </CardContent>
    <CardFooter className="flex flex-col gap-3">
      <Button
        className="w-full"
        render={<Link href={href(routes.auth.forgotPassword)} />}
        nativeButton={false}
      >
        パスワードを忘れた方はこちら
      </Button>
      <Link href={href(routes.auth.login)} className="text-sm underline">
        ログイン画面へ戻る
      </Link>
    </CardFooter>
  </AuthCard>
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
    toast.success("パスワードが変更されました。");
  });

  if (invalidLink) {
    return <InvalidPasswordLink />;
  }

  return (
    <AuthCard title={routes.auth.newPassword.title} description={done ? null : PASSWORD_RULE}>
      {done ? (
        <>
          <CardContent>
            <Alert>
              <AlertDescription>ログイン画面へ戻り、ログインしてください。</AlertDescription>
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
        <form onSubmit={onSubmit} noValidate autoComplete="off">
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
                placeholder="新しいパスワード"
                autoComplete="new-password"
              />
              <PasswordField
                control={form.control}
                name="confirmPassword"
                label="新しいパスワード再入力"
                placeholder="新しいパスワード再入力"
                autoComplete="new-password"
              />
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "変更中…" : "変更"}
            </Button>
          </CardFooter>
        </form>
      )}
    </AuthCard>
  );
};
