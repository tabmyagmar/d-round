import { redirect } from "next/navigation";

import { RegisterForm } from "@/features/auth/register-form";
import { getServerSession } from "@/lib/auth/server";

const RegisterPage = async () => {
  if (await getServerSession()) {
    redirect("/dashboard");
  }
  return <RegisterForm />;
};

export default RegisterPage;
