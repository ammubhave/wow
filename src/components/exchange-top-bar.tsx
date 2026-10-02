import {cn} from "tailwind-variants";

/**
 * The Exchange pages' breadcrumb row, pinned to the top while the page scrolls (long puzzles
 * shouldn't lose the way back), over a blurred backdrop so content passing beneath stays legible.
 */
export function ExchangeTopBar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("bg-background/85 sticky top-0 z-20 -my-3 py-3 backdrop-blur", className)}>
      {children}
    </div>
  );
}
