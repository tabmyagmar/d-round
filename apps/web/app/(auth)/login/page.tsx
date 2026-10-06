import { redirect } from "next/navigation";

import { href, routes, safeNextPath } from "@/config/routes";
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
    redirect(href(routes.home));
  }
  return <LoginForm next={safeNextPath(params.next, href(routes.home))} />;
};

export default LoginPage;
