import * as React from "react";

const MOBILE_BREAKPOINT = 768;

// Local patch (shadcn ships useState + a synchronous setState in useEffect, which the
// react-hooks rules reject): the same media query read through useSyncExternalStore.
// The server snapshot is `false`, as upstream's first render (`!!undefined`).
const subscribe = (onChange: () => void) => {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener("change", onChange);
  return () => {
    mql.removeEventListener("change", onChange);
  };
};

export const useIsMobile = () =>
  React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  );
