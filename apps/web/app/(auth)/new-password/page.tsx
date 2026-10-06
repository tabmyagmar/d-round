import { InvalidPasswordLink, NewPasswordForm } from "@/features/auth/new-password-form";
import { newPasswordState } from "@/features/auth/new-password-state";
import type { NewPasswordParams } from "@/features/auth/new-password-state";

/** Landing page of the mailed link (invitation or reset), after Better Auth checked the token. */
const NewPasswordPage = async ({ searchParams }: { searchParams: Promise<NewPasswordParams> }) => {
  const state = newPasswordState(await searchParams);
  return state.kind === "form" ? <NewPasswordForm token={state.token} /> : <InvalidPasswordLink />;
};

export default NewPasswordPage;
