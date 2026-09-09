import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/auth/server";

import { RegisterForm } from "./register-form";

const RegisterPage = async () => {
  if (await getServerSession()) {
    redirect("/dashboard");
  }
  return <RegisterForm />;
};

export default RegisterPage;
