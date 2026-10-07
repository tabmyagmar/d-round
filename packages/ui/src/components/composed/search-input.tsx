"use client";

import { cn } from "cn";
import { Search } from "lucide-react";
import { useState } from "react";

import { useDebouncedCallback } from "../../hooks/use-debounced-callback";
import { Input } from "../input";

export type SearchInputProps = {
  /** The search in effect (usually the URL's `search` parameter). */
  value: string;
  /** Called with the trimmed text once typing pauses. */
  onSearch: (value: string) => void;
  /** Accessible name; also the placeholder unless one is given. */
  label: string;
  placeholder?: string;
  className?: string;
  delayMs?: number;
};

/**
 * A search box for list toolbars (domain-free; the app passes the label and wires `onSearch` to its
 * URL state). The text is local while typing and reported after a pause.
 * When `value` changes from elsewhere (back/forward, a cleared filter) the box shows it; when it
 * changes because this box reported it, what the user typed meanwhile is kept.
 */
export const SearchInput = ({
  value,
  onSearch,
  label,
  placeholder = label,
  className,
  delayMs = 300,
}: SearchInputProps) => {
  const [text, setText] = useState(value);
  // The value last received from the parent, and the one this box last reported.
  const [seen, setSeen] = useState(value);
  const [sent, setSent] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value !== sent) {
      setSent(value);
      setText(value);
    }
  }

  const report = useDebouncedCallback((next: string) => {
    setSent(next);
    onSearch(next);
  }, delayMs);

  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          report(event.target.value.trim());
        }}
        className="pl-8"
      />
    </div>
  );
};
