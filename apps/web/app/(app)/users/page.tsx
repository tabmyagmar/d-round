import { UsersTable } from "@/features/users/users-table";

const UsersPage = () => (
  <>
    <header className="flex flex-col gap-1">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Users</h1>
      <p className="text-sm text-muted-foreground">
        You only see the users your role allows; admins see everyone.
      </p>
    </header>
    <UsersTable />
  </>
);

export default UsersPage;
