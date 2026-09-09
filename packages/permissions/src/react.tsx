"use client";

import {
  AbilityProvider as CaslAbilityProvider,
  Can as CaslCan,
  useAbility as useCaslAbility,
} from "@casl/react";
import type { CanProps } from "@casl/react";
import { useMemo } from "react";
import type { ReactNode } from "react";

import { defineAbilityFor } from "./ability";
import type { AppAbility } from "./ability";
import type { AbilityUser } from "./rules";

/** Wrap the app once; `user` comes from the session (null when signed out → nothing allowed). */
export const AbilityProvider = ({
  user,
  children,
}: {
  user: AbilityUser | null;
  children: ReactNode;
}) => {
  const ability = useMemo(() => defineAbilityFor(user), [user]);
  return <CaslAbilityProvider value={ability}>{children}</CaslAbilityProvider>;
};

export const useAbility = (): AppAbility => useCaslAbility<AppAbility>();

/**
 * `<Can I="update" this={userSubject(user)}>...</Can>` hides UI the user may not use.
 * UI hiding is a convenience; the API enforces the same rules on every request.
 */
export const Can = (props: CanProps<AppAbility>) => <CaslCan<AppAbility> {...props} />;
