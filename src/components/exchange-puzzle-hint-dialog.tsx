import {AlertDialog, Button} from "@heroui/react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {ControlledAlertDialog} from "./controlled-dialog";

export function ExchangePuzzleHintDialog({
  open,
  setOpen,
  title,
  message,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  title: string;
  message: string;
}) {
  return (
    <ControlledAlertDialog isOpen={open} onOpenChange={setOpen}>
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog>
          <AlertDialog.CloseTrigger />
          <AlertDialog.Header>
            <AlertDialog.Heading>{title}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <div className="[&_a]:underline">
              <Markdown remarkPlugins={[remarkGfm]}>{message}</Markdown>
            </div>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary">
              Close
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </ControlledAlertDialog>
  );
}
