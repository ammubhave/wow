import {cn} from "tailwind-variants";

/**
 * The frame every page sits in (except the board, puzzles and full-screen splashes): one width,
 * padding and title style, top-aligned. Pages used to center their own widths (512px to 1152px),
 * so the left edge and title jumped about when moving between them; now they line up.
 */
export function Page({
  title,
  actions,
  children,
  className,
}: {
  /** The page's heading (an h1); leave it out when the page draws its own. */
  title?: React.ReactNode;
  /** Buttons at the heading's far end. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8",
        className
      )}>
      {(title || actions) && (
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {title && <PageTitle>{title}</PageTitle>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/** A page's heading: the same size and weight on every page. */
export function PageTitle({children}: {children: React.ReactNode}) {
  return <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>;
}

/**
 * Text-heavy content (feeds, help, single forms) at a comfortable line length, kept to the frame's
 * left edge so it lines up with the title and other pages.
 */
export const READING_WIDTH = "w-full max-w-3xl";
