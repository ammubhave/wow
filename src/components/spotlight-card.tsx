import {useRef} from "react";
import {cn} from "tailwind-variants";

// Adapted from React Bits' Spotlight Card (https://reactbits.dev/components/spotlight-card): a
// soft glow follows the pointer across the card. Only on hover (so not on touch screens), and a
// colour only, so reduced motion needs nothing special.

/** A card whose surface lights up under the pointer, in the given colour. */
export function SpotlightCard({
  children,
  className,
  color = "color-mix(in oklab, var(--accent) 22%, transparent)",
}: {
  children: React.ReactNode;
  className?: string;
  /** The glow's colour (any CSS colour). */
  color?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onPointerMove={event => {
        const card = ref.current;
        if (!card || event.pointerType !== "mouse") return;
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
        card.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
      }}
      className={cn(
        "group/spotlight bg-surface border-separator relative isolate overflow-hidden rounded-2xl border",
        className
      )}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover/spotlight:opacity-100"
        style={{
          background: `radial-gradient(240px circle at var(--spot-x, 50%) var(--spot-y, 0%), ${color}, transparent 70%)`,
        }}
      />
      {children}
    </div>
  );
}

// Adapted from React Bits' Shiny Text (https://reactbits.dev/text-animations/shiny-text).

/** Text with a band of light sweeping across it (plain colour for reduced motion). */
export function ShinyText({
  children,
  className,
  color = "var(--success)",
}: {
  children: React.ReactNode;
  className?: string;
  /** The text's colour (any CSS colour); the shine is a lighter band of it. */
  color?: string;
}) {
  return (
    <span
      className={cn(
        "motion-safe:animate-shine bg-size-[200%_100%] bg-clip-text motion-safe:text-transparent",
        className
      )}
      style={{
        color,
        backgroundImage: `linear-gradient(110deg, ${color} 35%, color-mix(in oklab, ${color} 30%, white) 50%, ${color} 65%)`,
      }}>
      {children}
    </span>
  );
}
