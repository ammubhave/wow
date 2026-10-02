import {lazy, Suspense} from "react";
import type {Components} from "react-markdown";

// HeroUI Pro's Markdown pulls in react-markdown, streamdown and shiki (for code blocks), so it is
// loaded only once some markdown is on screen, not with the rest of the app.
const Markdown = lazy(() =>
  import("@heroui-pro/react/markdown").then(module => ({default: module.Markdown}))
);

// Links open in a new tab, so following one never navigates away from the page.
// Module-level so Markdown's per-block memoization isn't defeated by a new object each render.
const components: Partial<Components> = {
  a: ({node: _node, children, ...props}) => (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

/** HeroUI Pro Markdown, lazy-loaded; shows the raw text until the renderer arrives. */
export function LazyMarkdown({children, className}: {children: string; className?: string}) {
  return (
    <Suspense fallback={<p className="whitespace-pre-wrap">{children}</p>}>
      <Markdown className={className} components={components}>
        {children}
      </Markdown>
    </Suspense>
  );
}
