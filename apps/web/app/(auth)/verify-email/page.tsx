import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { href, routes } from "@/config/routes";
import { ResendVerification } from "@/features/auth/resend-verification";

const VerifyEmailPage = async ({ searchParams }: { searchParams: Promise<{ email?: string }> }) => {
  const { email } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check your inbox</CardTitle>
        <CardDescription>
          {email ? (
            <>
              We sent a verification link to <span className="font-medium">{email}</span>.
            </>
          ) : (
            "We sent you a verification link."
          )}{" "}
          Open it to activate your account — you will be signed in automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        The link is valid for one hour. In development every email lands in Mailpit at{" "}
        <a className="underline" href="http://localhost:8025" target="_blank" rel="noreferrer">
          localhost:8025
        </a>
        .
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        {email ? <ResendVerification email={email} /> : null}
        <Link href={href(routes.auth.login)} className="text-sm underline">
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
};

export default VerifyEmailPage;
