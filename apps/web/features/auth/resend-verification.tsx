"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/button";

import { href, routes } from "@/config/routes";
import { authClient } from "@/lib/auth/client";

export const ResendVerification = ({ email }: { email: string }) => {
  const [pending, setPending] = useState(false);

  const resend = async () => {
    setPending(true);
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: `${window.location.origin}${href(routes.home)}`,
    });
    setPending(false);
    if (error) {
      toast.error(error.message ?? "Could not resend the email");
      return;
    }
    toast.success("Verification email sent again");
  };

  return (
    <Button variant="outline" className="w-full" onClick={() => void resend()} disabled={pending}>
      {pending ? "Sending…" : "Resend verification email"}
    </Button>
  );
};
