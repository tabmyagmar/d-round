import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/auth/server";

import { LoginForm } from "./login-form";

const LoginPage = async ({ searchParams }: { searchParams: Promise<{ next?: string }> }) => {
  const [session, params] = await Promise.all([getServerSession(), searchParams]);
  if (session) {
    redirect("/dashboard");
  }
  return <LoginForm next={params.next?.startsWith("/") ? params.next : "/dashboard"} />;
};

export default LoginPage;
