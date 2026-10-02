import {Button, Modal, Tooltip} from "@heroui/react";
import {ExternalLinkIcon, MinusIcon, PlusIcon, RotateCcwIcon} from "lucide-react";
import type {ReactNode} from "react";
import {TransformComponent, TransformWrapper} from "react-zoom-pan-pinch";

function ControlButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger>
        <Button isIconOnly size="sm" variant="ghost" aria-label={label} onPress={onPress}>
          {children}
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}

/**
 * A thumbnail that opens the full image in a modal: scroll or pinch to zoom, drag to pan,
 * double-click to zoom in and out.
 */
export function ImageLightbox({src, alt}: {src: string; alt: string}) {
  return (
    <Modal>
      <Modal.Trigger className="block w-fit max-w-full cursor-zoom-in">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="border-separator max-h-60 max-w-full rounded-lg border object-contain"
        />
      </Modal.Trigger>
      <Modal.Backdrop variant="blur">
        <Modal.Container size="cover">
          <Modal.Dialog aria-label={alt} className="relative h-full overflow-hidden p-0">
            <Modal.CloseTrigger className="z-10" />
            <TransformWrapper doubleClick={{mode: "toggle"}} centerOnInit>
              {({zoomIn, zoomOut, resetTransform}) => (
                <>
                  <TransformComponent wrapperClass="size-full!" contentClass="size-full!">
                    <img src={src} alt={alt} className="size-full object-contain" />
                  </TransformComponent>
                  <div className="bg-overlay/80 absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full p-1 shadow-lg backdrop-blur">
                    <ControlButton label="Zoom out" onPress={() => void zoomOut()}>
                      <MinusIcon />
                    </ControlButton>
                    <ControlButton label="Reset zoom" onPress={() => void resetTransform()}>
                      <RotateCcwIcon />
                    </ControlButton>
                    <ControlButton label="Zoom in" onPress={() => void zoomIn()}>
                      <PlusIcon />
                    </ControlButton>
                    <ControlButton
                      label="Open original"
                      onPress={() => window.open(src, "_blank", "noopener,noreferrer")}>
                      <ExternalLinkIcon />
                    </ControlButton>
                  </div>
                </>
              )}
            </TransformWrapper>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
