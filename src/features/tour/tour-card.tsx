import {autoUpdate, flip, offset, shift, useFloating} from "@floating-ui/react";
import {Button, ProgressBar} from "@heroui/react";
import {ArrowLeftIcon, ArrowRightIcon, CheckIcon, SparklesIcon, XIcon} from "lucide-react";
import {useEffect, useState} from "react";
import {createPortal} from "react-dom";
import {cn} from "tailwind-variants";

import {IconButton} from "@/components/icon-button";

import type {TourContext, TourStep} from "./steps";

/** How long to wait for a step's target to show up before giving up on it. */
const MISSING_AFTER_MS = 1500;
const OPTIONAL_MISSING_AFTER_MS = 4000;
/** Room around the spotlit element. */
const PAD = 6;

// Something else is in front (a dialog, a menu, a select's list): step aside until it closes.
// React Aria's popovers carry data-trigger; tooltips are fine (the header's buttons have them).
const OVERLAY = "[role=dialog]:not([data-tour-card]), [data-trigger]:not([role=tooltip])";

type Rect = {top: number; left: number; width: number; height: number};

/** Finds the step's element (it may not be on the page yet, or be replaced as the page updates). */
function useTarget(step: TourStep, ctx: TourContext, onMissing: () => void) {
  const selector = step.target?.(ctx) || undefined;
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [isMissing, setIsMissing] = useState(!selector);
  const [isCovered, setIsCovered] = useState(false);
  useEffect(() => {
    const startedAt = Date.now();
    let scrolled = false;
    const find = () => {
      setIsCovered(document.querySelector(OVERLAY) !== null);
      if (!selector) return;
      let found = document.querySelector<HTMLElement>(selector);
      if (found && step.expandTo) found = found.closest<HTMLElement>(step.expandTo) ?? found;
      const rect = found?.getBoundingClientRect();
      const visible = found && rect && (rect.width > 0 || rect.height > 0) ? found : null;
      setElement(current => (current === visible ? current : visible));
      if (visible) {
        setIsMissing(false);
        if (!scrolled) {
          scrolled = true;
          visible.scrollIntoView({block: "nearest", inline: "nearest"});
        }
        return;
      }
      const waited = Date.now() - startedAt;
      if (step.optional && waited > OPTIONAL_MISSING_AFTER_MS) onMissing();
      else if (!step.optional && waited > MISSING_AFTER_MS) setIsMissing(true);
    };
    find();
    const interval = setInterval(find, 250);
    return () => clearInterval(interval);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- onMissing changes every render.
  }, [selector, step.expandTo, step.optional]);
  return {element, isMissing, isCovered};
}

/** The element's box, kept current as the page scrolls and resizes. */
function useRect(element: HTMLElement | null) {
  const [rect, setRect] = useState<Rect | null>(null);
  useEffect(() => {
    let frame = 0;
    if (!element) return () => cancelAnimationFrame(frame);
    const measure = () => {
      const r = element.getBoundingClientRect();
      setRect(current =>
        current &&
        current.top === r.top &&
        current.left === r.left &&
        current.width === r.width &&
        current.height === r.height
          ? current
          : {top: r.top, left: r.left, width: r.width, height: r.height}
      );
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [element]);
  return element ? rect : null;
}

export function TourCard({
  step,
  ctx,
  position,
  total,
  isFirst,
  isLast,
  isDone,
  onNext,
  onBack,
  onClose,
  onDoItForMe,
  onMissing,
}: {
  step: TourStep;
  ctx: TourContext;
  position: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  isDone: boolean;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
  onDoItForMe: () => void;
  onMissing: () => void;
}) {
  const {element, isMissing, isCovered} = useTarget(step, ctx, onMissing);
  const anchored = element !== null;
  const rect = useRect(element);
  const {refs, floatingStyles, isPositioned} = useFloating({
    elements: {reference: element},
    placement: "bottom",
    middleware: [offset(PAD + 10), flip({padding: 12}), shift({padding: 12})],
    whileElementsMounted: autoUpdate,
  });
  const waiting = step.task !== undefined && !isDone;
  // Not shown until it's somewhere: next to its target, or (no target) in the middle.
  const isReady = anchored ? isPositioned : isMissing;

  return createPortal(
    <div className={cn("transition-opacity", isCovered && "pointer-events-none opacity-0")}>
      {/* The spotlight: everything else dimmed, the target ringed. Clicks go through to the page,
          so the target can be used. */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-60 motion-safe:transition-all motion-safe:duration-300"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + 2 * PAD,
            height: rect.height + 2 * PAD,
            boxShadow: "0 0 0 2px var(--accent), 0 0 0 9999px rgb(0 0 0 / 0.5)",
          }}
        />
      ) : (
        isReady && (
          <div aria-hidden className="bg-backdrop pointer-events-none fixed inset-0 z-60" />
        )
      )}
      <div
        ref={refs.setFloating}
        data-tour-card
        role="dialog"
        aria-modal={false}
        aria-labelledby={`tour-${step.id}`}
        style={
          anchored
            ? floatingStyles
            : {position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)"}
        }
        className={cn(
          "bg-overlay shadow-overlay border-separator z-61 flex w-[min(22rem,calc(100vw-24px))] flex-col gap-3 border p-4 text-sm",
          !isReady && "invisible"
        )}>
        <div className="flex items-center gap-2">
          <span className="text-accent flex items-center gap-1.5 text-xs font-medium">
            <SparklesIcon className="size-3.5" aria-hidden />
            Tour · {position + 1} of {total}
          </span>
          <IconButton
            size="sm"
            variant="ghost"
            label="End tour"
            className="ms-auto -me-2 -mt-1"
            onPress={onClose}>
            <XIcon />
          </IconButton>
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 id={`tour-${step.id}`} className="text-base font-semibold">
            {step.title}
          </h2>
          <p className="text-muted leading-relaxed">{step.body(ctx)}</p>
        </div>
        {step.task && (
          <p
            className={cn(
              "flex items-center gap-2 text-xs font-medium",
              isDone ? "text-success" : "text-muted"
            )}>
            {isDone ? (
              <CheckIcon className="size-3.5" aria-hidden />
            ) : (
              <span className="relative flex size-2">
                <span className="bg-accent absolute inline-flex size-full rounded-full opacity-75 motion-safe:animate-ping" />
                <span className="bg-accent relative inline-flex size-2 rounded-full" />
              </span>
            )}
            {isDone ? "Done" : "Waiting for you…"}
          </p>
        )}
        <div className="flex items-center gap-2">
          {isFirst ? (
            // A plain way out (not just the ✕), so the tour never feels like a trap.
            <Button size="sm" variant="ghost" className="-ms-2" onPress={onClose}>
              Skip the tour
            </Button>
          ) : (
            <Button size="sm" variant="ghost" className="-ms-2" onPress={onBack}>
              <ArrowLeftIcon />
              Back
            </Button>
          )}
          <div className="ms-auto flex gap-2">
            {waiting ? (
              <Button size="sm" variant="secondary" onPress={onDoItForMe}>
                Do it for me
              </Button>
            ) : (
              <Button size="sm" onPress={onNext}>
                {isLast ? "Finish" : isFirst ? "Let's go" : "Next"}
                {!isLast && <ArrowRightIcon />}
              </Button>
            )}
          </div>
        </div>
        {/* How far along. */}
        <ProgressBar
          aria-label={`Step ${position + 1} of ${total}`}
          size="sm"
          value={position + 1}
          maxValue={total}>
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      </div>
    </div>,
    document.body
  );
}
