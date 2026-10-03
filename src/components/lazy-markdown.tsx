import {lazy, Suspense} from "react";
import type {Components} from "react-markdown";
import {cn} from "tailwind-variants";

import {authClient} from "@/lib/auth-client";
import {plainMentions} from "@/server/notifications";

// HeroUI Pro's Markdown pulls in react-markdown, streamdown and shiki (for code blocks), so it is
// loaded only once some markdown is on screen, not with the rest of the app.
const Markdown = lazy(() =>
  import("@heroui-pro/react/markdown").then(module => ({default: module.Markdown}))
);

/** An @mention in a chat message (stored as a "#mention-<userId>" link): yours stand out. */
function Mention({userId, children}: {userId: string; children: React.ReactNode}) {
  const me = authClient.useSession().data?.user.id;
  return (
    <span
      className={cn(
        "rounded px-0.5 font-medium",
        userId === me ? "bg-warning/20 text-warning" : "bg-accent/15 text-accent"
      )}>
      {children}
    </span>
  );
}

// Links open in a new tab, so following one never navigates away from the page.
// Module-level so Markdown's per-block memoization isn't defeated by a new object each render.
const components: Partial<Components> = {
  a: ({node: _node, children, href, ...props}) =>
    href?.startsWith("#mention-") ? (
      <Mention userId={href.slice("#mention-".length)}>{children}</Mention>
    ) : (
      <a {...props} href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
};

/** HeroUI Pro Markdown, lazy-loaded; shows the raw text until the renderer arrives. */
export function LazyMarkdown({children, className}: {children: string; className?: string}) {
  return (
    <Suspense fallback={<p className="whitespace-pre-wrap">{plainMentions(children)}</p>}>
      <Markdown className={className} components={components}>
        {children}
      </Markdown>
    </Suspense>
  );
}
