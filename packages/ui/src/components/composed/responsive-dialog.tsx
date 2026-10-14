"use client";

import { useIsMobile } from "../../hooks/use-mobile";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "../drawer";

import { ContentDialog } from "./content-dialog";
import type { ContentDialogProps } from "./content-dialog";

export type ResponsiveDialogProps = ContentDialogProps;

/**
 * `ContentDialog` at `md` and up; below, the same title, body and footer in a `Drawer` from the
 * bottom of the screen, as `FilterPopover` switches (the legacy d-round `ResponsiveOverlay`). The
 * body scrolls inside the drawer, so a wide table never widens the page. Render it only when
 * needed, as `ContentDialog`; the body mounts only while it is open.
 */
export const ResponsiveDialog = (props: ResponsiveDialogProps) => {
  const isMobile = useIsMobile();
  if (!isMobile) {
    return <ContentDialog {...props} />;
  }
  const { open, onOpenChange, title, description, children, footer } = props;
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          {description ? <DrawerDescription>{description}</DrawerDescription> : null}
        </DrawerHeader>
        <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto p-4 pb-6">
          {open ? children : null}
        </div>
        {footer ? <DrawerFooter>{footer}</DrawerFooter> : null}
      </DrawerContent>
    </Drawer>
  );
};
