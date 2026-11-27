import {Card, Skeleton, Tabs, Typography} from "@heroui/react";
import {type AnyRoute, useLocation, useMatches, useRouter} from "@tanstack/react-router";
import {useState} from "react";
import {cn} from "tailwind-variants";

import {DOC_PAGES, DOC_SECTIONS, findDoc} from "@/docs/registry";

import {Page, READING_WIDTH} from "./page";

/**
 * Loading placeholders shaped like the pages they stand in for, so a load shows the page's outline
 * instead of a blank screen, a lone spinner or the previous page. Used as route `pendingComponent`s
 * (shown as soon as a navigation has to wait; see the router's defaultPendingMs) and as in-page
 * fallbacks.
 *
 * Each one reserves the space of what replaces it: the same frame (Page), title position, column
 * widths and row heights as the real page, so nothing moves when the content arrives. Static text
 * (page titles, tab names) is drawn as itself. Keep them light: route files import them eagerly.
 */

/** Rows of a list, `count` of them, keyed by index (placeholders never reorder). */
function rows(count: number, render: (index: number) => React.ReactNode) {
  return Array.from({length: count}, (_, index) => render(index));
}

/**
 * The skeleton of whatever is loading below the layout route `from`: the pending component of the
 * nearest route under it that has one, else the generic page. A layout's own pending component
 * draws its frame around this, so whichever route the router is waiting on, the whole screen
 * shows the page being opened.
 */
export function ChildSkeleton({from}: {from: string}) {
  const router = useRouter();
  const routeIds: string[] = useMatches({select: matches => matches.map(match => match.routeId)});
  const index = routeIds.indexOf(from);
  if (index === -1) return <PageSkeleton />;
  const routes: AnyRoute[] = Object.values(router.routesById);
  for (const routeId of routeIds.slice(index + 1)) {
    const Pending = routes.find(route => route.id === routeId)?.options.pendingComponent;
    if (Pending) return <Pending />;
  }
  return <PageSkeleton />;
}

/** A title-sized bar, for pages whose title comes with their data. */
const TITLE = "h-8 w-56";

/**
 * A page in the app's frame (Page) while it loads: its title (as itself when it's fixed) and, by
 * default, a few lines. The router's default for routes without a skeleton of their own.
 */
export function PageSkeleton({
  title,
  actions,
  children,
}: {
  title?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div aria-busy="true" aria-label="Loading" className="contents">
      <Page title={title ?? <Skeleton className={TITLE} />} actions={actions}>
        {children ?? (
          <div className={cn(READING_WIDTH, "flex flex-col gap-3")}>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-3 h-48 w-full" />
          </div>
        )}
      </Page>
    </div>
  );
}

/** A form field while it loads: its label above its input, as the app's form fields draw them. */
export function FieldSkeleton({label = "w-24"}: {label?: string}) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className={cn("h-4", label)} />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

/**
 * A card while it loads: its title, `description` lines under it, then `body` (or `fields` form
 * fields).
 */
export function CardSkeleton({
  description = 1,
  fields = 2,
  body,
  footer = false,
  className,
}: {
  description?: number;
  fields?: number;
  body?: React.ReactNode;
  /** A Save button under the fields. */
  footer?: boolean;
  className?: string;
}) {
  return (
    <Card className={className}>
      <Card.Header className="gap-2">
        <Skeleton className="h-5 w-40" />
        {rows(description, i => (
          <Skeleton key={i} className={cn("h-4", i === description - 1 ? "w-2/3" : "w-full")} />
        ))}
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        {body ?? rows(fields, i => <FieldSkeleton key={i} />)}
      </Card.Content>
      {footer && (
        <Card.Footer>
          <Skeleton className="h-9 w-16" />
        </Card.Footer>
      )}
    </Card>
  );
}

// --- Signed-in app (/workspaces, /hunts, …) ------------------------------------------------------

/** The app's header (SiteHeader) around the page loading below it (routes/_workspace/_app). */
export function AppSkeleton() {
  return (
    <div className="[--header-height:calc(--spacing(14))]" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col">
        <div className="flex h-12 items-center gap-2 px-4">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-52" />
          <div className="flex-1" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="me-2 h-4 w-16" />
          <Skeleton className="size-8 rounded-full" />
        </div>
        <div className="flex min-h-[calc(100svh-var(--header-height))] flex-col">
          <ChildSkeleton from="/_workspace/_app" />
        </div>
      </div>
    </div>
  );
}

/** A centered single-card form page (join, invitation). */
export function CardFormSkeleton() {
  return (
    <div className="flex flex-1 items-center justify-center" aria-busy="true" aria-label="Loading">
      <Card className="w-full max-w-sm">
        <Card.Header>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card.Content>
      </Card>
    </div>
  );
}

/** My workspaces: the list (a row per workspace) beside the Join card. */
export function WorkspacesSkeleton() {
  return (
    <PageSkeleton title="My workspaces" actions={<Skeleton className="h-8 w-40" />}>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <WorkspaceListSkeleton />
        <CardSkeleton description={0} body={<JoinCardBody />} />
      </div>
    </PageSkeleton>
  );
}

function JoinCardBody() {
  return (
    <>
      <FieldSkeleton />
      <FieldSkeleton label="w-36" />
      <Skeleton className="mt-1 h-9 w-full" />
    </>
  );
}

/** The workspaces list on My workspaces, while it loads. */
export function WorkspaceListSkeleton() {
  return (
    <Card className="gap-0 p-0" aria-busy="true" aria-label="Loading workspaces">
      {rows(2, i => (
        <div key={i} className={cn("flex items-center gap-4 p-4", i > 0 && "border-t")}>
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="size-4" />
        </div>
      ))}
    </Card>
  );
}

/** Puzzle hunts: the view tabs, search and filters, then the list. */
export function HuntsSkeleton() {
  return (
    <PageSkeleton title="Puzzle hunts" actions={<Skeleton className="h-10 w-36" />}>
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-full sm:w-64" />
        <Skeleton className="h-10 w-52" />
      </div>
      <HuntListingsSkeleton />
    </PageSkeleton>
  );
}

/** The hunts list (a month's heading, then rows shaped like HuntRow). */
export function HuntListingsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading hunts">
      {[2, 5].map(count => (
        <section key={count} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Card className="gap-0 p-0">
            {rows(count, i => (
              <div key={i} className={cn("flex items-center gap-4 px-4 py-3", i > 0 && "border-t")}>
                <Skeleton className="size-12 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-56 max-w-full" />
                  <Skeleton className="h-3 w-80 max-w-full" />
                </div>
                <Skeleton className="h-8 w-36 max-sm:hidden" />
              </div>
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
}

/** My stats: the four numbers, then the charts. */
export function StatsSkeleton() {
  return (
    <PageSkeleton title="My stats">
      <div className={cn(READING_WIDTH, "flex flex-col gap-4")}>
        <StatsBodySkeleton />
      </div>
    </PageSkeleton>
  );
}

export function StatsBodySkeleton() {
  return (
    <>
      <Skeleton className="h-[106px] w-full" />
      <Skeleton className="h-72 w-full" />
    </>
  );
}

/** Account: the profile card, then the sign-in, passkey and session cards. */
export function ProfileSkeleton() {
  return (
    <PageSkeleton title="Account">
      <div className={cn(READING_WIDTH, "flex flex-col gap-4")}>
        <CardSkeleton
          body={
            <>
              <FieldSkeleton label="w-12" />
              <FieldSkeleton label="w-12" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <div className="flex items-center gap-4">
                  <Skeleton className="size-10 rounded-full" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              <Skeleton className="mt-4 h-9 w-16" />
            </>
          }
        />
        <CardSkeleton
          fields={0}
          body={
            <>
              <Skeleton className="h-[52px] w-full" />
              <Skeleton className="h-[52px] w-full" />
            </>
          }
        />
        <CardSkeleton fields={0} body={<Skeleton className="h-10 w-full" />} />
      </div>
    </PageSkeleton>
  );
}

/** Create a workspace: the form card. */
export function CreateWorkspaceSkeleton() {
  return (
    <PageSkeleton title="Create workspace">
      <div className={cn(READING_WIDTH, "flex flex-col gap-4")}>
        <CardSkeleton fields={8} />
      </div>
    </PageSkeleton>
  );
}

// --- A workspace ---------------------------------------------------------------------------------

/**
 * A workspace's frame (header, footer) around the page loading inside it
 * (routes/_workspace/$workspaceSlug): heights and widths as WorkspaceHeader and WorkspaceFooter.
 */
export function WorkspaceSkeleton() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true" aria-label="Loading workspace">
      <div className="flex h-12 shrink-0 items-center gap-3 px-4">
        <Skeleton className="size-5 shrink-0 rounded-full" />
        <Skeleton className="hidden h-10 w-[296px] md:block" />
        <Skeleton className="h-4 w-32 md:hidden" />
        <div className="flex-1" />
        <Skeleton className="hidden h-4 w-48 md:block" />
        <Skeleton className="size-5 rounded-full" />
        <Skeleton className="size-8 rounded-full" />
      </div>
      <div className="relative flex flex-1">
        <div className="absolute inset-0 flex overflow-hidden">
          <ChildSkeleton from="/_workspace/$workspaceSlug" />
        </div>
      </div>
      <div className="flex h-[37px] shrink-0 items-center gap-3 border-t px-4">
        <Skeleton className="h-4 w-40" />
        <div className="flex-1" />
        <Skeleton className="hidden h-4 w-64 md:block" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

/** A workspace's home pages (routes/_workspace/$workspaceSlug/_home): the same scroll area. */
export function HomeSkeleton() {
  return (
    <div className="flex flex-1">
      <div className="flex flex-1 flex-col overflow-hidden">
        <ChildSkeleton from="/_workspace/$workspaceSlug/_home" />
      </div>
    </div>
  );
}

/** The board's height for a row (and a round's heading), as the board's ROW_HEIGHT. */
const BOARD_ROW = "h-[37px]";

/** A little something to read while the board loads. */
const LOADING_LINES = [
  "Shuffling the puzzle pieces…",
  "Untangling the red herrings…",
  "Counting the enumerations…",
  "Consulting Nutrimatic…",
  "Sharpening the pencils…",
  "Checking under the metas…",
  "Waking up the waffle…",
];

function LoadingLine() {
  const [line] = useState(() => LOADING_LINES[Math.floor(Math.random() * LOADING_LINES.length)]);
  return (
    // A server-rendered shell picks its own line; whichever, it's the same size.
    <p suppressHydrationWarning className="text-muted px-3 text-xs">
      {line}
    </p>
  );
}

/** The board: the search and filter row, the table (header, rows), and the sidebar. */
export function BoardSkeleton() {
  return (
    <div className="flex flex-1" aria-busy="true" aria-label="Loading the board">
      {/* Fills the space like the board's table does, rather than growing to its rows. */}
      <div className="relative min-w-0 flex-1">
        <div className="absolute inset-0 flex flex-col divide-y overflow-hidden">
          <div className="flex shrink-0 items-center gap-2 p-2">
            <Skeleton className="h-9 min-w-0 flex-1 sm:w-56 sm:flex-none lg:w-64" />
            <div className="hidden flex-1 gap-1.5 sm:flex">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-9 w-28" />
            </div>
            <Skeleton className="h-9 w-9 sm:w-32" />
            <Skeleton className="hidden h-9 w-24 sm:block" />
          </div>
          <div className="flex h-10 shrink-0 items-center">
            <LoadingLine />
          </div>
          <div className="flex flex-col">
            {/* A round's row, its unassigned puzzles' row, then its puzzles. */}
            {rows(21, i => (
              <div
                key={i}
                className={cn(
                  BOARD_ROW,
                  "flex shrink-0 items-center px-3",
                  i % 7 === 0 && "bg-surface-secondary"
                )}>
                <Skeleton
                  className={cn(
                    "h-4",
                    i % 7 === 0 ? "ms-14 w-24" : i % 7 === 1 ? "ms-14 w-32" : "ms-14 w-40"
                  )}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <SidebarSkeleton />
    </div>
  );
}

/** The board's sidebar (AppSidebar): notes and rounds above, team chat below. Wide screens only. */
function SidebarSkeleton() {
  return (
    <div className="hidden w-80 shrink-0 flex-col border-l md:flex">
      <div className="flex h-2/5 flex-col gap-4 p-2 ps-2">
        <Skeleton className="mt-2 h-3 w-12" />
        <Skeleton className="ms-4 h-4 w-28" />
      </div>
      <div className="flex flex-1 flex-col gap-3 border-t p-3">
        <Skeleton className="h-3 w-20" />
        <div className="flex-1" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}

/** A puzzle's page: the sheet beside its details and chat (one view at a time on phones). */
export function PuzzlePageSkeleton() {
  return (
    <div className="flex flex-1" aria-busy="true" aria-label="Loading the puzzle">
      <div className="flex min-w-0 flex-1 flex-col md:w-3/4 md:flex-none">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b px-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-28" />
          <div className="flex-1" />
          <Skeleton className="h-4 w-12" />
        </div>
        <SheetSkeleton />
      </div>
      <div className="hidden w-1/4 flex-col border-l md:flex">
        <div className="flex h-[45%] flex-col gap-3 p-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-16" />
          <div className="flex flex-col gap-2">
            {rows(5, i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-9 flex-1" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 border-t p-3">
          <div className="flex-1" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

/** A spreadsheet while it loads: its toolbar, then a grid of empty cells. */
export function SheetSkeleton({label = "Loading the sheet"}: {label?: string}) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      aria-busy="true"
      aria-label={label}>
      <div className="flex h-24 shrink-0 flex-col justify-center gap-3 border-b px-4">
        <Skeleton className="mx-auto h-4 w-80 max-w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
      <div
        className="flex-1 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--separator) 1px, transparent 1px), linear-gradient(to bottom, var(--separator) 1px, transparent 1px)",
          backgroundSize: "88px 24px",
        }}
      />
    </div>
  );
}

/** A whiteboard while it loads: its toolbar over an empty canvas. */
export function WhiteboardSkeleton() {
  return (
    <div
      className="flex flex-1 flex-col items-center p-4"
      aria-busy="true"
      aria-label="Loading whiteboard">
      <Skeleton className="h-11 w-96 max-w-full rounded-lg" />
    </div>
  );
}

/** Workspace settings: the title and tabs around the tab being opened. */
export function SettingsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="contents">
      <Page title="Workspace settings">
        <div className="grid items-start gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
          <SettingsTabs />
          <div className="flex min-w-0 flex-col gap-4">
            <ChildSkeleton from="/_workspace/$workspaceSlug/_home/settings" />
          </div>
        </div>
      </Page>
    </div>
  );
}

const SETTINGS_TABS = [
  ["", "General"],
  ["/members", "Members"],
  ["/administration", "Administration"],
] as const;

/**
 * The settings tabs as the layout draws them (beside the content on wider screens, above it on
 * phones), the one being opened selected. Both orientations, picked with CSS rather than a media
 * query hook, so it matches before the page has measured the screen.
 */
function SettingsTabs() {
  const tab = useLocation({
    select: location => /\/settings(\/[^/]+)?/.exec(location.pathname)?.[1] ?? "",
  });
  return (
    <>
      {(["vertical", "horizontal"] as const).map(orientation => (
        <Tabs
          key={orientation}
          orientation={orientation}
          selectedKey={tab}
          className={orientation === "vertical" ? "max-md:hidden" : "md:hidden"}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Workspace settings">
              {SETTINGS_TABS.map(([id, label]) => (
                <Tabs.Tab key={id} id={id}>
                  {label}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      ))}
    </>
  );
}

/** Settings > General: the details, look, emoji, links and tags cards. */
export function SettingsGeneralSkeleton() {
  return (
    <>
      <CardSkeleton description={2} fields={5} footer />
      <CardSkeleton description={2} fields={2} footer />
      <CardSkeleton fields={1} />
    </>
  );
}

/** Settings > Members: inviting, then the members. */
export function MembersSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading members">
      <CardSkeleton
        description={2}
        body={
          <>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-[76px] w-full" />
            </div>
            <Skeleton className="h-9 w-32" />
            <Skeleton className="mt-4 h-3 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-40" />
          </>
        }
      />
      <PeopleCardSkeleton rows={2} />
    </div>
  );
}

/** Settings > Administration: the password, spreadsheet, voice, archive and delete cards. */
export function AdministrationSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <CardSkeleton fields={1} footer />
      {/* The spreadsheet and voice choices: two options side by side. */}
      {rows(2, i => (
        <CardSkeleton
          key={i}
          description={2}
          body={
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-[52px]" />
              <Skeleton className="h-[52px]" />
            </div>
          }
        />
      ))}
    </div>
  );
}

/** A card listing people (e.g. workspace members). */
export function PeopleCardSkeleton({rows: count = 6}: {rows?: number}) {
  return (
    <Card aria-busy="true" aria-label="Loading">
      <Card.Header className="gap-1">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        {rows(count, i => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </Card.Content>
    </Card>
  );
}

/** Leaderboard (the recap): the shareable card, then the tables. */
export function RecapSkeleton() {
  return (
    <PageSkeleton title="Leaderboard" actions={<Skeleton className="h-8 w-40" />}>
      <div className={cn(READING_WIDTH, "flex flex-col gap-4")}>
        <RecapBodySkeleton />
      </div>
    </PageSkeleton>
  );
}

function RecapBodySkeleton() {
  return (
    <>
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-40 w-full" />
    </>
  );
}

// --- Public pages --------------------------------------------------------------------------------

/** The public site's header around the page loading below it (routes/_public). */
export function PublicSkeleton() {
  return (
    <div className="flex h-screen flex-col" aria-busy="true" aria-label="Loading">
      <div className="mx-auto flex h-16 w-full max-w-7xl shrink-0 items-center gap-4 px-6">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-5 w-56" />
        <div className="flex-1" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex min-h-[calc(100dvh-(--spacing(16)))] shrink-0 flex-col gap-4 p-4 md:gap-8 md:p-10">
          <ChildSkeleton from="/_public" />
        </main>
      </div>
    </div>
  );
}

/** A sign-in page's card (log in, sign up, forgot password), centered as AuthLayout does. */
export function AuthSkeleton({
  fields = 2,
  buttons = 2,
  hint = false,
}: {
  fields?: number;
  buttons?: number;
  hint?: boolean;
}) {
  return (
    <div
      className="relative flex w-full flex-1 flex-col items-center justify-center"
      aria-busy="true"
      aria-label="Loading">
      <Card className="w-full max-w-sm">
        <Card.Header className="gap-1">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          {buttons > 0 && (
            <>
              <div className="flex flex-col gap-2">
                {rows(buttons, i => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
              {/* "or with email" */}
              <Skeleton className="mx-auto h-3 w-24" />
            </>
          )}
          {rows(fields, i => (
            <FieldSkeleton key={i} label="w-20" />
          ))}
          {/* "Forgot password?" under the password. */}
          {hint && <Skeleton className="ms-auto -mt-2 h-4 w-28" />}
        </Card.Content>
        <Card.Footer className="mt-4 flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-48" />
        </Card.Footer>
      </Card>
    </div>
  );
}

/**
 * The docs (DocsShell) while a page loads: the sidebar and the page's heading as themselves (they
 * come from the registry), and its text as lines.
 */
export function DocsSkeleton() {
  // /docs/<slug>, or a workspace's /<workspace>/help/<slug>.
  const slug = useLocation({
    select: location =>
      decodeURIComponent(/^\/(?:docs|[^/]+\/help)\/?(.*)$/.exec(location.pathname)?.[1] ?? ""),
  });
  const page = findDoc(slug);
  return (
    <div
      className="mx-auto flex w-full max-w-7xl gap-10 px-4 py-6 md:px-8 md:py-8"
      aria-busy="true"
      aria-label="Loading">
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="flex flex-col gap-5 pb-6">
          <Skeleton className="h-9 w-full" />
          <div className="flex flex-col gap-6">
            {DOC_SECTIONS.map(section => (
              <div key={section} className="flex flex-col gap-1">
                <h2 className="text-foreground px-3 text-xs font-semibold">{section}</h2>
                <div className="flex flex-col">
                  {DOC_PAGES.filter(doc => doc.section === section).map(doc => (
                    <span
                      key={doc.slug || "welcome"}
                      className={cn(
                        "block px-3 py-1.5 text-sm",
                        doc.slug === page?.slug
                          ? "bg-accent/10 text-accent font-medium"
                          : "text-muted"
                      )}>
                      {doc.title}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 gap-10">
        <article className="flex max-w-3xl min-w-0 flex-1 flex-col gap-8">
          <div className="flex gap-2 lg:hidden">
            <Skeleton className="h-9 w-44" />
            <Skeleton className="size-9" />
          </div>
          {page ? (
            <div className="flex flex-col gap-3">
              <span className="text-accent text-xs font-semibold tracking-wider uppercase">
                {page.section}
              </span>
              <Typography type="h1">{page.title}</Typography>
              <p className="text-muted text-lg leading-relaxed">{page.description}</p>
            </div>
          ) : (
            <Skeleton className="h-10 w-72" />
          )}
          <DocTextSkeleton />
        </article>
        <aside className="hidden w-52 shrink-0 xl:block" />
      </div>
    </div>
  );
}

/** A docs page's text while it loads: paragraphs of lines, a screen's worth. */
export function DocTextSkeleton() {
  return (
    <div className="flex min-h-[60vh] flex-col gap-6" aria-busy="true" aria-label="Loading">
      {rows(3, p => (
        <div key={p} className="flex flex-col gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
          {p < 2 && <Skeleton className="h-4 w-2/3" />}
        </div>
      ))}
    </div>
  );
}
