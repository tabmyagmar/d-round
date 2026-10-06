import { redirect } from "next/navigation";

import { href, LANDING_ROUTE, safeNextPath } from "@/config/routes";
import { LoginForm } from "@/features/auth/login-form";
import { getServerSession } from "@/lib/auth/server";

// A repeated query key (`?next=a&next=b`) arrives as an array; safeNextPath accepts strings only.
const LoginPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) => {
  const [session, params] = await Promise.all([getServerSession(), searchParams]);
  if (session) {
    redirect(href(LANDING_ROUTE));
  }
  return <LoginForm next={safeNextPath(params.next, href(LANDING_ROUTE))} />;
};

export default LoginPage;
