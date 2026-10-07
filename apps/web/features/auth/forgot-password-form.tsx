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
import { TextField } from "@repo/ui/components/form";
import { forgotPasswordSchema } from "@repo/validation";
import type { ForgotPasswordInput } from "@repo/validation";

import { href, routes } from "@/config/routes";
import { AuthCard } from "@/features/auth/auth-card";
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
    toast.success("メールが送信されました。メールリンクから続行してください。");
  });

  return (
    <AuthCard
      title={routes.auth.forgotPassword.title}
      description="登録されているメールアドレスを入力してください。パスワード変更に必要情報をお送りいたします。"
    >
      {sent ? (
        <CardContent className="flex flex-col gap-4">
          <p className="text-center text-lg font-bold">
            メールアドレス宛に送信いたしましたので、ご確認ください。
          </p>
          <Alert>
            <AlertTitle>【ご確認のお願い】</AlertTitle>
            <AlertDescription>
              万が一メールが届かない場合は、入力されたメールアドレスに
              <strong>誤りや不要なスペース</strong>
              がないかご確認のうえ、再度送信してみてください。
            </AlertDescription>
          </Alert>
        </CardContent>
      ) : (
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
          ログイン画面へ戻る
        </Link>
      </CardFooter>
    </AuthCard>
  );
};
