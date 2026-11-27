import {AlertDialog, Button} from "@heroui/react";

import {IconTooltip} from "@/components/icon-button";

import {ControlledAlertDialog} from "./controlled-dialog";

/**
 * Asks before something that's hard to take back. Open it from the action's own button; it runs
 * `onConfirm` and stays open (with the button pending) until the caller closes it.
 */
export function ConfirmDialog({
  isOpen,
  onOpenChange,
  heading,
  children,
  confirmLabel,
  onConfirm,
  isPending = false,
  status = "danger",
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  heading: string;
  /** What happens, in a sentence or two. */
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  isPending?: boolean;
  status?: "danger" | "warning";
}) {
  return (
    <ControlledAlertDialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog>
          <IconTooltip label="Close">
            <AlertDialog.CloseTrigger />
          </IconTooltip>
          <AlertDialog.Header>
            <AlertDialog.Icon status={status} />
            <AlertDialog.Heading>{heading}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>{children}</p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary">
              Cancel
            </Button>
            <Button
              variant={status === "danger" ? "danger" : "primary"}
              isPending={isPending}
              onPress={onConfirm}>
              {confirmLabel}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </ControlledAlertDialog>
  );
}
