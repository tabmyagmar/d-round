import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/login-form";
import { getServerSession } from "@/lib/auth/server";

const LoginPage = async ({ searchParams }: { searchParams: Promise<{ next?: string }> }) => {
  const [session, params] = await Promise.all([getServerSession(), searchParams]);
  if (session) {
    redirect("/dashboard");
  }
  return <LoginForm next={params.next?.startsWith("/") ? params.next : "/dashboard"} />;
};

export default LoginPage;
