import { ProfileEditor } from "@/features/users/profile-editor";

const ProfilePage = () => (
  <>
    <header className="flex flex-col gap-1">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Your profile</h1>
      <p className="text-sm text-muted-foreground">Name, employee code and department.</p>
    </header>
    <ProfileEditor />
  </>
);

export default ProfilePage;
