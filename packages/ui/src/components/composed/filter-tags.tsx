import { X } from "lucide-react";

import { Badge } from "../badge";
import { Button } from "../button";

export type FilterTag = {
  /** The filter's key (usually its URL parameter); handed back to `onRemove`. */
  key: string;
  label: string;
  value: string;
};

export type FilterTagsProps = {
  tags: readonly FilterTag[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
  clearAllLabel?: string;
  removeLabel?: (tag: FilterTag) => string;
};

const defaultRemoveLabel = (tag: FilterTag): string => `Remove ${tag.label}`;

/** The filters in effect as removable chips under a list toolbar; nothing when there are none. */
export const FilterTags = ({
  tags,
  onRemove,
  onClearAll,
  clearAllLabel = "Clear all",
  removeLabel = defaultRemoveLabel,
}: FilterTagsProps) => {
  if (tags.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <Badge key={tag.key} variant="secondary" className="h-7 gap-1 pr-1 pl-2.5">
          <span className="text-muted-foreground">{tag.label}:</span>
          <span>{tag.value}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={removeLabel(tag)}
            onClick={() => {
              onRemove(tag.key);
            }}
          >
            <X />
          </Button>
        </Badge>
      ))}
      <Button variant="ghost" size="xs" onClick={onClearAll}>
        {clearAllLabel}
      </Button>
    </div>
  );
};
