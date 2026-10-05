import Link from "next/link";

import { Card, CardContent, CardFooter } from "@repo/ui/components/card";

import { PlaceholderPage } from "@/components/placeholder-page";
import { href, routes } from "@/config/routes";

const NewPasswordPage = () => (
  <Card>
    <CardContent>
      <PlaceholderPage route={routes.auth.newPassword} />
    </CardContent>
    <CardFooter>
      <Link href={href(routes.auth.login)} className="text-sm underline">
        ログインへ戻る
      </Link>
    </CardFooter>
  </Card>
);

export default NewPasswordPage;
