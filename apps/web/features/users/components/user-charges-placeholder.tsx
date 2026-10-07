import { Building2, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";

// TODO(D_ROUND-TBD): 担当クライアント / 担当スタッフ — list the clients and the staff this user is in
// charge of once the Client and Staff models exist (legacy UserClients / UserStaffs: one card each,
// rows open a detail dialog). Until then the two cards only say so.
const CHARGES = [
  { title: "担当クライアント", icon: Building2 },
  { title: "担当スタッフ", icon: Users },
] as const;

export const UserChargesPlaceholder = () => (
  <div className="grid gap-4 md:grid-cols-2">
    {CHARGES.map(({ title, icon: Icon }) => (
      <Card key={title}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon aria-hidden className="size-4 text-muted-foreground" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            準備中です。クライアント管理・スタッフ管理の実装後に表示されます。
          </p>
        </CardContent>
      </Card>
    ))}
  </div>
);
