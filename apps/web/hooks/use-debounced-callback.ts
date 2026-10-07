"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * A stable function that runs `callback` once the calls have stopped for `delayMs`, with the last
 * arguments. Debounce the event (a keystroke that updates the URL), not a value mirrored into an
 * effect. The latest `callback` is used; a pending call is dropped on unmount.
 */
export const useDebouncedCallback = <TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delayMs = 300,
): ((...args: TArgs) => void) => {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
    },
    [],
  );

  return useCallback(
    (...args: TArgs) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delayMs);
    },
    [delayMs],
  );
};
