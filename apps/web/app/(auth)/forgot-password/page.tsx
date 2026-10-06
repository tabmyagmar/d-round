import Link from "next/link";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/card";

import { PlaceholderPage } from "@/components/placeholder-page";
import { href, routes } from "@/config/routes";

const ForgotPasswordPage = () => (
  <Card>
    <CardHeader>
      <CardTitle>{routes.auth.forgotPassword.title}</CardTitle>
    </CardHeader>
    <CardContent>
      <PlaceholderPage route={routes.auth.forgotPassword} />
    </CardContent>
    <CardFooter>
      <Link href={href(routes.auth.login)} className="text-sm underline">
        ログインへ戻る
      </Link>
    </CardFooter>
  </Card>
);

export default ForgotPasswordPage;
