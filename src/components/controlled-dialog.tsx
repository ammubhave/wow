import {AlertDialog, Modal} from "@heroui/react";

type ControlledDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Optional pressable element that opens the dialog. */
  trigger?: React.ReactElement;
  /** The dialog's `*.Container` content. */
  children: React.ReactNode;
};

// HeroUI's `<Modal>` / `<AlertDialog>` roots are react-aria `DialogTrigger`s, which wrap their
// children in a PressResponder and warn on every render when no pressable trigger child is
// rendered. So only render the root when there is a trigger (keeping the open state on the root,
// since a Backdrop-level `isOpen` would ignore the trigger); otherwise control the overlay
// (`*.Backdrop`, a react-aria `ModalOverlay`) directly.

export function ControlledModal({isOpen, onOpenChange, trigger, children}: ControlledDialogProps) {
  if (!trigger) {
    return (
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        {children}
      </Modal.Backdrop>
    );
  }
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      {trigger}
      <Modal.Backdrop>{children}</Modal.Backdrop>
    </Modal>
  );
}

export function ControlledAlertDialog({
  isOpen,
  onOpenChange,
  trigger,
  children,
}: ControlledDialogProps) {
  if (!trigger) {
    return (
      <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        {children}
      </AlertDialog.Backdrop>
    );
  }
  return (
    <AlertDialog isOpen={isOpen} onOpenChange={onOpenChange}>
      {trigger}
      <AlertDialog.Backdrop>{children}</AlertDialog.Backdrop>
    </AlertDialog>
  );
}
