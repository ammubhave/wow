import {Button, Kbd, Typography} from "@heroui/react";
import {Link} from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  ChevronDownIcon,
  MessageSquareWarningIcon,
  SearchIcon,
} from "lucide-react";
import {lazy, Suspense, useEffect, useRef, useState} from "react";
import {cn} from "tailwind-variants";

import {IconButton} from "@/components/icon-button";
import {DocTextSkeleton} from "@/components/page-skeletons";
import {PROSE_FLOW} from "@/lib/prose";

import {
  DOC_PAGES,
  DOC_SECTIONS,
  type DocPage,
  findDoc,
  loadDoc,
  loadedDoc,
  neighbours,
} from "../registry";
import {DocsBaseContext, useDocHref} from "./docs-base";
import {DocsSearch} from "./docs-search";
import {MDX_COMPONENTS} from "./mdx-components";

// Each page's content component, made once (so revisiting a page doesn't reload it).
const contents = new Map<
  string,
  React.LazyExoticComponent<React.ComponentType<{components?: object}>>
>();
function contentFor(slug: string) {
  let content = contents.get(slug);
  if (!content) {
    content = lazy(() => loadDoc(slug));
    contents.set(slug, content);
  }
  return content;
}

/** The sidebar: every section's pages, the current one marked. */
function DocsNav({slug, onNavigate}: {slug: string; onNavigate?: () => void}) {
  const docHref = useDocHref();
  return (
    <nav aria-label="Documentation" className="flex flex-col gap-6">
      {DOC_SECTIONS.map(section => (
        <div key={section} className="flex flex-col gap-1">
          <h2 className="text-foreground px-3 text-xs font-semibold">{section}</h2>
          {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- Tailwind preflight removes list styling, and Safari/VoiceOver then drops the implicit role. */}
          <ul role="list" className="flex flex-col">
            {DOC_PAGES.filter(page => page.section === section).map(page => {
              const isCurrent = page.slug === slug;
              return (
                <li key={page.slug || "welcome"}>
                  <Link
                    to={docHref(page.slug)}
                    onClick={onNavigate}
                    aria-current={isCurrent ? "page" : undefined}
                    className={cn(
                      "block px-3 py-1.5 text-sm transition-colors",
                      isCurrent
                        ? "bg-accent/10 text-accent font-medium"
                        : "text-muted hover:text-foreground hover:bg-default/60"
                    )}>
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

type Heading = {id: string; text: string; level: 2 | 3};

/** "On this page": the page's sections, the one being read highlighted. */
function OnThisPage({headings, activeId}: {headings: Heading[]; activeId: string | undefined}) {
  if (headings.length < 2) return null;
  return (
    <nav aria-label="On this page" className="flex flex-col gap-2">
      <h2 className="text-foreground text-xs font-semibold">On this page</h2>
      {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- as above. */}
      <ul role="list" className="border-separator flex flex-col border-s">
        {headings.map(heading => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              onClick={event => {
                event.preventDefault();
                document
                  .getElementById(heading.id)
                  ?.scrollIntoView({behavior: "smooth", block: "start"});
                history.replaceState(null, "", `#${heading.id}`);
              }}
              className={cn(
                "-ms-px block border-s py-1 text-xs transition-colors",
                heading.level === 3 ? "ps-6" : "ps-3",
                heading.id === activeId
                  ? "border-accent text-accent font-medium"
                  : "text-muted hover:text-foreground border-transparent"
              )}>
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Calls back once it's mounted: here, once a page's content has loaded and rendered. */
function Rendered({onRender}: {onRender: () => void}) {
  useEffect(onRender, [onRender]);
  return null;
}

function Pager({page}: {page: DocPage}) {
  const docHref = useDocHref();
  const {previous, next} = neighbours(page.slug);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {previous ? (
        <Link
          to={docHref(previous.slug)}
          className="border-separator hover:bg-default/40 flex flex-col gap-1 border p-4 transition-colors">
          <span className="text-muted flex items-center gap-1 text-xs">
            <ArrowLeftIcon className="size-3" aria-hidden="true" />
            Previous
          </span>
          <span className="font-medium">{previous.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link
          to={docHref(next.slug)}
          className="border-separator hover:bg-default/40 flex flex-col items-end gap-1 border p-4 text-end transition-colors">
          <span className="text-muted flex items-center gap-1 text-xs">
            Next
            <ArrowRightIcon className="size-3" aria-hidden="true" />
          </span>
          <span className="font-medium">{next.title}</span>
        </Link>
      )}
    </div>
  );
}

/**
 * The docs: sidebar, the page (title, lead, content), "On this page", previous/next, and search.
 * The same docs on the public site (/docs) and in a workspace's Help tab (/<workspace>/help):
 * `base` is where it's mounted, and links between pages stay under it.
 */
export function DocsShell({base, slug}: {base: string; slug: string}) {
  const page = findDoc(slug);
  const articleRef = useRef<HTMLDivElement>(null);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const isPublic = base === "/docs";

  // Once the page has rendered: list its sections, follow the one being read, and go to the
  // section in the address (#…), which wasn't there to scroll to before.
  const [renderedSlug, setRenderedSlug] = useState<string>();
  useEffect(() => {
    if (renderedSlug !== slug) return undefined;
    const elements = [
      ...(articleRef.current?.querySelectorAll<HTMLElement>("h2[id], h3[id]") ?? []),
    ];
    setHeadings(
      elements.map(element => ({
        id: element.id,
        text: element.textContent ?? "",
        level: element.tagName === "H3" ? 3 : 2,
      }))
    );
    setActiveId(elements[0]?.id);
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash) document.getElementById(hash)?.scrollIntoView({block: "start"});
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.find(entry => entry.isIntersecting);
        if (visible) setActiveId(visible.target.id);
      },
      {rootMargin: "0px 0px -70% 0px"}
    );
    elements.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [renderedSlug, slug]);

  // / opens search (and ⌘K on the public docs; in a workspace that's the workspace's palette).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? "");
      if (
        (event.key === "/" && !isTyping) ||
        (isPublic && event.key === "k" && (event.metaKey || event.ctrlKey))
      ) {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isPublic]);

  // Preloaded by the route (so it renders at once), else loaded here.
  const Content = page ? (loadedDoc(page.slug) ?? contentFor(page.slug)) : undefined;
  const searchButton = (
    <Button
      variant="secondary"
      className="text-muted w-full justify-start"
      onPress={() => setIsSearchOpen(true)}>
      <SearchIcon />
      <span className="flex-1 text-start">Search the docs</span>
      <Kbd>/</Kbd>
    </Button>
  );

  return (
    <DocsBaseContext value={base}>
      <div className="mx-auto flex w-full max-w-7xl gap-10 px-4 py-6 md:px-8 md:py-8">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-6 flex max-h-[calc(100dvh-6rem)] flex-col gap-5 overflow-y-auto pb-6">
            {searchButton}
            <DocsNav slug={page?.slug ?? ""} />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 gap-10">
          <article className="flex max-w-3xl min-w-0 flex-1 flex-col gap-8">
            {/* Narrow screens: search, and the pages behind a toggle, above the page. */}
            <div className="flex flex-col gap-3 lg:hidden">
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  aria-expanded={isNavOpen}
                  onPress={() => setIsNavOpen(open => !open)}>
                  <BookOpenIcon />
                  Browse the docs
                  <ChevronDownIcon
                    className={cn("transition-transform", isNavOpen && "rotate-180")}
                  />
                </Button>
                <IconButton
                  variant="secondary"
                  label="Search the docs"
                  onPress={() => setIsSearchOpen(true)}>
                  <SearchIcon />
                </IconButton>
              </div>
              {isNavOpen && (
                <div className="border-separator border p-3">
                  <DocsNav slug={page?.slug ?? ""} onNavigate={() => setIsNavOpen(false)} />
                </div>
              )}
            </div>
            {page && Content ? (
              <>
                <header className="flex flex-col gap-3">
                  <span className="text-accent text-xs font-semibold tracking-wider uppercase">
                    {page.section}
                  </span>
                  <Typography type="h1">{page.title}</Typography>
                  <p className="text-muted text-lg leading-relaxed">{page.description}</p>
                </header>
                <div ref={articleRef}>
                  <Suspense fallback={<DocTextSkeleton />}>
                    <Typography.Prose
                      className={cn(
                        PROSE_FLOW,
                        "[&_li+li]:mt-1.5 [&_ol]:list-decimal [&_ol]:ps-6 [&_ul]:list-disc [&_ul]:ps-6"
                      )}>
                      <Content components={MDX_COMPONENTS} />
                    </Typography.Prose>
                    <Rendered key={page.slug} onRender={() => setRenderedSlug(page.slug)} />
                  </Suspense>
                </div>
                <footer className="border-separator flex flex-col gap-6 border-t pt-6">
                  <a
                    href="https://github.com/ammubhave/wow/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted hover:text-foreground flex items-center gap-2 text-sm">
                    <MessageSquareWarningIcon className="size-4" aria-hidden="true" />
                    Something missing, wrong or unclear? Tell us on GitHub.
                  </a>
                  <Pager page={page} />
                </footer>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <Typography type="h1">Page not found</Typography>
                <p className="text-muted">
                  This docs page doesn&apos;t exist (it may have moved). Try searching, or start
                  from the{" "}
                  <Link to={base} className="text-accent">
                    welcome page
                  </Link>
                  .
                </p>
              </div>
            )}
          </article>
          <aside className="hidden w-52 shrink-0 xl:block">
            <div className="sticky top-6">
              <OnThisPage headings={headings} activeId={activeId} />
            </div>
          </aside>
        </div>
      </div>
      <DocsSearch isOpen={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </DocsBaseContext>
  );
}
