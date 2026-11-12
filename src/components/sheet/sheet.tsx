import {Button, Spinner} from "@heroui/react";
import {posthog} from "posthog-js";
import {Component, lazy, type ReactNode, Suspense} from "react";

// Univer is large (a few MB), so it's in its own chunk, loaded by the first sheet opened (or
// ahead of time, by preloadSheet).
const loadSheetCanvas = () => import("./sheet-canvas");
const SheetCanvas = lazy(loadSheetCanvas);
// A failed preload is fine: opening a sheet tries again.
const preload = () => void loadSheetCanvas().catch(() => {});

/**
 * Downloads the spreadsheet code while the browser is idle, so the first puzzle opened shows its
 * sheet at once instead of after a multi-MB download.
 */
export function preloadSheet() {
  if ("requestIdleCallback" in window) {
    const handle = window.requestIdleCallback(preload, {timeout: 10_000});
    return () => window.cancelIdleCallback(handle);
  }
  const timer = setTimeout(preload, 3000);
  return () => clearTimeout(timer);
}

/**
 * Keeps a failure inside the spreadsheet to the spreadsheet: the puzzle's chat, details and
 * whiteboard keep working, and the sheet can be reopened (it reloads from the room).
 */
class SheetErrorBoundary extends Component<
  {children: ReactNode},
  {failed: boolean; attempt: number}
> {
  override state = {failed: false, attempt: 0};

  static getDerivedStateFromError() {
    return {failed: true};
  }

  override componentDidCatch(error: unknown) {
    if (import.meta.env.PROD) posthog.captureException(error, {area: "built-in sheet"});
    else console.error(error);
  }

  override render() {
    if (this.state.failed) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-muted text-sm">The spreadsheet ran into a problem.</p>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => this.setState(s => ({failed: false, attempt: s.attempt + 1}))}>
            Reload the sheet
          </Button>
        </div>
      );
    }
    // Keyed by attempt, so reloading starts a fresh sheet.
    return (
      <div key={this.state.attempt} className="contents">
        {this.props.children}
      </div>
    );
  }
}

/** The puzzle's built-in spreadsheet, for puzzles without a Google sheet. */
export function PuzzleSheet({puzzleId}: {puzzleId: string}) {
  return (
    <SheetErrorBoundary>
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <Spinner aria-label="Loading spreadsheet" />
          </div>
        }>
        <SheetCanvas puzzleId={puzzleId} />
      </Suspense>
    </SheetErrorBoundary>
  );
}
