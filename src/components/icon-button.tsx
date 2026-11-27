import {Button, type ButtonProps, Focusable, Tooltip} from "@heroui/react";
import type {ComponentProps, ReactNode} from "react";

type TooltipPlacement = ComponentProps<typeof Tooltip.Content>["placement"];

/**
 * Names an icon-only control on hover and keyboard focus. HeroUI's Tooltip hooks into a React Aria
 * focusable child: a HeroUI `Button` (also as the trigger of a Dropdown, Popover or Drawer, which
 * keep working), `CloseButton` or `Modal.CloseTrigger`. A plain `<a>`, `<button>` or TanStack
 * `<Link>` child gets no tooltip; use `NativeTooltip` for those.
 */
export function IconTooltip({
  label,
  placement,
  children,
}: {
  label: ReactNode;
  placement?: TooltipPlacement;
  children: ReactNode;
}) {
  return (
    <Tooltip delay={300}>
      {children}
      <Tooltip.Content placement={placement}>{label}</Tooltip.Content>
    </Tooltip>
  );
}

/**
 * `IconTooltip` for a native `<a>`/`<button>` or a TanStack `<Link>` (one element that passes its
 * props and ref to the DOM): React Aria's `Focusable` hands it the tooltip's hover/focus wiring.
 */
export function NativeTooltip({
  label,
  placement,
  children,
}: {
  label: ReactNode;
  placement?: TooltipPlacement;
  children: ComponentProps<typeof Focusable>["children"];
}) {
  return (
    <IconTooltip label={label} placement={placement}>
      <Focusable>{children}</Focusable>
    </IconTooltip>
  );
}

/** An icon-only HeroUI `Button` whose `label` is both its accessible name and its tooltip. */
export function IconButton({
  label,
  tooltipPlacement,
  ...props
}: Omit<ButtonProps, "isIconOnly" | "aria-label"> & {
  label: string;
  tooltipPlacement?: TooltipPlacement;
}) {
  return (
    <IconTooltip label={label} placement={tooltipPlacement}>
      <Button {...props} isIconOnly aria-label={label} />
    </IconTooltip>
  );
}
