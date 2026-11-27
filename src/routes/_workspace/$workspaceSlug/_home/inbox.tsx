import {Avatar, Button, ScrollShadow, SearchField, Skeleton, Tooltip} from "@heroui/react";
import {useInfiniteQuery, useQuery} from "@tanstack/react-query";
import {createFileRoute, Link, useNavigate} from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  CopyIcon,
  DownloadIcon,
  InboxIcon,
  PaperclipIcon,
  TypeIcon,
  XIcon,
} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import {toast} from "sonner";
import {cn} from "tailwind-variants";
import {useFormatter} from "use-intl";
import {z} from "zod";

import {RelativeTime} from "@/components/activity-log";
import {IconButton} from "@/components/icon-button";
import {contactEmail} from "@/lib/contact-email";
import {orpc} from "@/lib/orpc";
import type {RouterOutputs} from "@/server/router";

/**
 * The workspace's Inbox: emails sent to its contact address (src/server/inbound-email.ts), as a
 * list beside the open email (one or the other on phones), after HeroUI Pro's email template.
 */
export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/inbox")({
  // The open email (from a notification, or picked from the list).
  validateSearch: z.object({email: z.string().optional()}),
  loader: ({context: {queryClient}, params: {workspaceSlug}}) =>
    queryClient.ensureInfiniteQueryData(emailsQueryOptions(workspaceSlug)),
  pendingComponent: InboxSkeleton,
  component: RouteComponent,
  head: () => ({meta: [{title: "Inbox | WOW"}]}),
});

type ListedEmail = RouterOutputs["workspaces"]["emails"]["list"]["emails"][number];

/** The workspace's emails, newest first, a page at a time. */
function emailsQueryOptions(workspaceSlug: string) {
  return orpc.workspaces.emails.list.infiniteOptions({
    input: (cursor: {receivedAt: number; id: string} | null) => ({workspaceSlug, cursor}),
    initialPageParam: null,
    getNextPageParam: page => page.nextCursor,
  });
}

const copyAddress = (address: string) =>
  navigator.clipboard.writeText(address).then(
    () => toast.success("Email address copied."),
    () => toast.error("Couldn't copy. Select it and copy it yourself.")
  );

const senderName = (email: {fromName: string | null; fromAddress: string}) =>
  email.fromName ?? email.fromAddress;

const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]!.toUpperCase())
    .join("");

function RouteComponent() {
  const {workspaceSlug} = Route.useParams();
  const {email: openId} = Route.useSearch();
  const emails = useInfiniteQuery(emailsQueryOptions(workspaceSlug));
  const [search, setSearch] = useState("");
  const all = emails.data?.pages.flatMap(page => page.emails) ?? [];
  const query = search.trim().toLowerCase();
  const shown = query
    ? all.filter(email =>
        [email.fromName, email.fromAddress, email.subject, email.preview].some(field =>
          field?.toLowerCase().includes(query)
        )
      )
    : all;
  const index = openId ? shown.findIndex(email => email.id === openId) : -1;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(320px,380px)_1fr]">
      <div
        className={cn(
          "min-h-0 flex-col gap-3 overflow-clip px-2 pt-4 pb-2",
          openId ? "hidden lg:flex" : "flex flex-1"
        )}>
        <div className="flex flex-col gap-1 px-2">
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <AddressLine workspaceSlug={workspaceSlug} />
        </div>
        <SearchField
          aria-label="Search the inbox"
          name="inbox-search"
          value={search}
          onChange={setSearch}
          className="px-1">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <ScrollShadow hideScrollBar className="min-h-0 flex-1 overflow-y-auto">
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <p className="text-sm font-medium">
                {query ? "No matching emails" : "No emails yet"}
              </p>
              <p className="text-muted max-w-[240px] text-xs">
                {query
                  ? "Nothing loaded matches that. Older emails aren't searched until they're shown."
                  : "Emails to the workspace's address will land here."}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {shown.map(email => (
                <EmailListItem
                  key={email.id}
                  workspaceSlug={workspaceSlug}
                  email={email}
                  isActive={email.id === openId}
                />
              ))}
            </ul>
          )}
          {emails.hasNextPage && (
            <div className="flex justify-center py-3">
              <Button
                size="sm"
                variant="secondary"
                isPending={emails.isFetchingNextPage}
                onPress={() => void emails.fetchNextPage()}>
                Show older emails
              </Button>
            </div>
          )}
        </ScrollShadow>
      </div>
      <div
        className={cn(
          "min-h-0 flex-col overflow-hidden",
          openId ? "flex flex-1" : "hidden lg:flex"
        )}>
        {openId ? (
          <EmailDetail
            key={openId}
            workspaceSlug={workspaceSlug}
            id={openId}
            position={index === -1 ? null : {index, count: shown.length}}
            previousId={index > 0 ? shown[index - 1]!.id : undefined}
            nextId={index !== -1 && index < shown.length - 1 ? shown[index + 1]!.id : undefined}
          />
        ) : (
          <NothingOpen workspaceSlug={workspaceSlug} hasEmails={all.length > 0} />
        )}
      </div>
    </div>
  );
}

/** The workspace's address, to give the hunt, and a button to copy it. */
function AddressLine({workspaceSlug}: {workspaceSlug: string}) {
  const address = contactEmail(workspaceSlug);
  return (
    <div className="text-muted flex min-w-0 items-center gap-1 text-xs">
      <span className="truncate select-all">{address}</span>
      <Tooltip delay={300}>
        <Button
          size="sm"
          isIconOnly
          variant="ghost"
          aria-label="Copy the email address"
          className="size-6 min-w-6"
          onPress={() => void copyAddress(address)}>
          <CopyIcon className="size-3.5" />
        </Button>
        <Tooltip.Content>Copy the email address</Tooltip.Content>
      </Tooltip>
    </div>
  );
}

function EmailListItem({
  workspaceSlug,
  email,
  isActive,
}: {
  workspaceSlug: string;
  email: ListedEmail;
  isActive: boolean;
}) {
  const name = senderName(email);
  return (
    <li>
      <Link
        to="/$workspaceSlug/inbox"
        params={{workspaceSlug}}
        search={{email: email.id}}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex items-start gap-3 rounded-2xl p-3 transition-colors",
          isActive ? "bg-surface shadow-surface" : "hover:bg-default/60"
        )}>
        <Avatar className="size-9 shrink-0">
          <Avatar.Fallback>{initials(name)}</Avatar.Fallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm leading-tight font-medium">{name}</span>
            <span className="text-muted flex shrink-0 items-center gap-1.5 text-xs leading-tight whitespace-nowrap">
              {email.hasAttachments && (
                <PaperclipIcon className="size-3.5" aria-label="Has attachments" />
              )}
              <RelativeTime date={email.receivedAt} />
            </span>
          </div>
          <span className="truncate text-xs leading-tight">{email.subject ?? "(no subject)"}</span>
          {email.preview && (
            <span className="text-muted truncate text-xs leading-tight">{email.preview}</span>
          )}
        </div>
      </Link>
    </li>
  );
}

function NothingOpen({workspaceSlug, hasEmails}: {workspaceSlug: string; hasEmails: boolean}) {
  const address = contactEmail(workspaceSlug);
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="bg-surface shadow-surface flex size-12 items-center justify-center rounded-2xl">
        <InboxIcon className="text-muted size-5" />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{hasEmails ? "Nothing open" : "No emails yet"}</h2>
        <p className="text-muted max-w-[360px] text-sm">
          {hasEmails && "Pick an email to read it here. "}
          Emails to <span className="text-foreground font-medium">{address}</span> land in this
          inbox, and everyone in the workspace gets a notification. Give it to the hunt as your
          team's contact email.
        </p>
      </div>
      <Button size="sm" variant="secondary" onPress={() => void copyAddress(address)}>
        <CopyIcon />
        Copy address
      </Button>
    </div>
  );
}

/**
 * Keeps an email's HTML from doing anything but show itself: no scripts (the frame's sandbox),
 * nothing loaded from the web (which would tell the sender it was read), links in a new tab.
 */
const SANDBOX_HEAD =
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src 'self' data:">` +
  `<base target="_blank">` +
  // Images from the web are blocked: hide them rather than show a broken-image icon for each.
  `<style>img:not([src^="data:"]){display:none}</style>`;

/**
 * Whether an email sets its own colours. Those are shown as designed, on white, as their senders
 * meant (a dark page would leave dark text on dark); plain ones follow the app's light or dark
 * theme, like the rest of the page.
 */
const hasOwnColors = (html: string) =>
  /bgcolor\s*=|background(-color)?\s*:|(^|[\s;"'{])color\s*:/i.test(html);

/**
 * The page's @font-face rules for `family` (with their files' full addresses), so a frame can use
 * the app's font: a frame doesn't share the fonts its page has loaded.
 */
function fontFaces(family: string) {
  const name = family
    .split(",")[0]!
    .trim()
    .replace(/^["']|["']$/g, "");
  const rules: string[] = [];
  for (const sheet of document.styleSheets) {
    let cssRules: CSSRuleList;
    try {
      cssRules = sheet.cssRules;
    } catch {
      continue; // Another site's stylesheet: its rules can't be read.
    }
    for (const rule of cssRules) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      if (rule.style.getPropertyValue("font-family").replace(/["']/g, "").trim() !== name) continue;
      const base = sheet.href ?? document.baseURI;
      rules.push(
        rule.cssText.replace(/url\((["']?)([^"')]+)\1\)/g, (_, quote: string, url: string) =>
          url.startsWith("data:")
            ? `url(${quote}${url}${quote})`
            : `url("${new URL(url, base).href}")`
        )
      );
    }
  }
  return rules.join("");
}

/** An email's formatted version, in a sandboxed frame as tall as the email. */
function EmailHtml({html, title}: {html: string; title: string}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(160);
  const designed = hasOwnColors(html);
  // The page's light or dark scheme, text colour, accent and font, for emails that follow the
  // theme: read again whenever the theme (a class on <html>) changes, rebuilding the frame.
  const [colors, setColors] = useState<{
    scheme: "light" | "dark";
    text: string;
    accent: string;
    font: string;
    fontFaces: string;
  } | null>(null);
  useEffect(() => {
    const read = () => {
      const parent = frame.current?.parentElement;
      if (!parent) return;
      setColors({
        // The same class the page's own colours come from, so the frame always matches the page.
        scheme: document.documentElement.classList.contains("dark") ? "dark" : "light",
        text: getComputedStyle(parent).color,
        font: getComputedStyle(parent).fontFamily,
        fontFaces: fontFaces(getComputedStyle(parent).fontFamily),
        accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
      });
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {attributes: true, attributeFilter: ["class"]});
    return () => observer.disconnect();
  }, []);
  const style = designed
    ? "body{margin:16px;background:#fff;color:#18181b;font-family:system-ui,sans-serif;font-size:14px}"
    : `${colors?.fontFaces ?? ""}:root{color-scheme:${colors?.scheme ?? "normal"}}body{margin:0;background:transparent;color:${colors?.text ?? "inherit"};font-family:${colors?.font ?? "system-ui,sans-serif"};font-size:14px;line-height:1.6}a{color:${colors?.accent || "inherit"}}`;

  // As tall as its content, so the email scrolls with the page instead of inside a box. The frame
  // can't run scripts, so measuring it from here is the only way.
  const measure = () => {
    const doc = frame.current?.contentDocument;
    if (doc?.documentElement) setHeight(doc.documentElement.scrollHeight);
  };
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });

  return (
    <iframe
      ref={frame}
      title={title}
      // No allow-scripts, so nothing in it runs; allow-same-origin only lets this page measure it.
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={`${SANDBOX_HEAD}<style>${style}</style>${html}`}
      onLoad={measure}
      style={{height}}
      className={cn("w-full", designed && "rounded-xl")}
    />
  );
}

/** The toolbar's icon buttons: quiet until hovered. */
const TOOL = "text-muted hover:text-foreground";

/** The open email: its toolbar, who sent it, its formatted (or plain) text, and attachments. */
function EmailDetail({
  workspaceSlug,
  id,
  position,
  previousId,
  nextId,
}: {
  workspaceSlug: string;
  id: string;
  /** Where it is in the (filtered) list, when it's in it. */
  position: {index: number; count: number} | null;
  previousId?: string;
  nextId?: string;
}) {
  const format = useFormatter();
  const navigate = useNavigate({from: Route.fullPath});
  const email = useQuery(orpc.workspaces.emails.get.queryOptions({input: {workspaceSlug, id}}));
  // Formatted when it has a formatted version, as mail apps show it; plain text on request.
  const [plain, setPlain] = useState(false);
  const data = email.data;
  const open = (emailId: string | undefined) =>
    void navigate({search: {email: emailId}, replace: emailId !== undefined});

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-clip lg:py-4 lg:pr-4 lg:pl-0.5">
      <div className="lg:bg-surface lg:shadow-surface flex max-h-full flex-1 flex-col gap-6 overflow-clip p-4 lg:rounded-2xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <IconButton
              size="sm"
              variant="ghost"
              label="Back to the inbox"
              onPress={() => open(undefined)}
              className={cn(TOOL, "lg:hidden")}>
              <ChevronLeftIcon className="size-4" />
            </IconButton>
            <IconButton
              size="sm"
              variant="ghost"
              label="Close"
              onPress={() => open(undefined)}
              className={cn(TOOL, "hidden lg:inline-flex")}>
              <XIcon className="size-4" />
            </IconButton>
            {data && (
              <IconButton
                size="sm"
                variant="ghost"
                className={TOOL}
                label="Download the email (.eml), attachments and all"
                onPress={() => {
                  // Sent as an attachment, so the browser saves it and stays on this page.
                  window.location.href = `/api/workspaces/${encodeURIComponent(workspaceSlug)}/emails/${encodeURIComponent(id)}`;
                }}>
                <DownloadIcon className="size-4" />
              </IconButton>
            )}
            {data?.html && (
              <IconButton
                size="sm"
                variant="ghost"
                label={plain ? "Show it formatted" : "Show it as plain text"}
                aria-pressed={plain}
                onPress={() => setPlain(on => !on)}
                className={cn(TOOL, plain && "text-foreground bg-default")}>
                <TypeIcon className="size-4" />
              </IconButton>
            )}
          </div>
          {position && (
            <div className="flex items-center gap-2 px-2">
              <span className="text-muted text-xs tabular-nums">
                {position.index + 1} of {position.count}
              </span>
              <div className="flex items-center">
                <IconButton
                  size="sm"
                  variant="ghost"
                  className={TOOL}
                  label="Newer email"
                  isDisabled={!previousId}
                  onPress={() => open(previousId)}>
                  <ArrowLeftIcon className="size-4" />
                </IconButton>
                <IconButton
                  size="sm"
                  variant="ghost"
                  className={TOOL}
                  label="Older email"
                  isDisabled={!nextId}
                  onPress={() => open(nextId)}>
                  <ArrowRightIcon className="size-4" />
                </IconButton>
              </div>
            </div>
          )}
        </div>

        <ScrollShadow hideScrollBar className="min-h-0 flex-1 overflow-y-auto lg:px-6">
          {email.isPending ? (
            // Shaped like the email (subject, sender, then text) so it lands without moving.
            <div className="flex flex-col gap-6 pb-5" aria-busy aria-label="Loading the email">
              <Skeleton className="h-6 w-2/3 rounded-lg" />
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-40 rounded-md" />
                  <Skeleton className="h-3 w-56 rounded-md" />
                </div>
                <Skeleton className="h-3 w-28 rounded-md" />
              </div>
              <div className="flex flex-col gap-2.5">
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-11/12 rounded-md" />
                <Skeleton className="h-4 w-4/5 rounded-md" />
                <Skeleton className="h-4 w-2/3 rounded-md" />
              </div>
            </div>
          ) : !data ? (
            <p className="text-danger py-10 text-center text-sm">Couldn't load this email.</p>
          ) : (
            <div className="flex flex-col gap-6 pb-5">
              <h2 className="text-base leading-normal font-semibold">
                {data.subject ?? "(no subject)"}
              </h2>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-9 shrink-0">
                    <Avatar.Fallback>{initials(senderName(data))}</Avatar.Fallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm leading-tight font-medium">
                      {senderName(data)}
                    </span>
                    {data.fromName && (
                      <span className="text-muted truncate text-xs leading-tight font-medium">
                        {data.fromAddress}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-muted shrink-0 text-xs whitespace-nowrap">
                  {format.dateTime(data.receivedAt, {dateStyle: "medium", timeStyle: "short"})}
                </span>
              </div>
              {data.html && !plain ? (
                <EmailHtml html={data.html} title={data.subject ?? "Email"} />
              ) : (
                <div className="text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap">
                  {data.text ?? "(no text)"}
                </div>
              )}
              {data.attachments.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {data.attachments.map((attachment, index) => (
                    <span
                      // Attachments have no ids, and an email's never change.
                      // oxlint-disable-next-line react/no-array-index-key
                      key={index}
                      className="bg-default text-muted inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs">
                      <PaperclipIcon className="size-3" />
                      {attachment.filename ?? "Attachment"} · {formatSize(attachment.size)}
                    </span>
                  ))}
                  <span className="text-muted text-xs">
                    Download the email to open its attachments.
                  </span>
                </div>
              )}
            </div>
          )}
        </ScrollShadow>
      </div>
    </div>
  );
}

const formatSize = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** The page's own layout (list column beside the reading pane), so nothing moves when it loads. */
function InboxSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading the inbox"
      className="flex min-h-0 flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(320px,380px)_1fr]">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-clip px-2 pt-4 pb-2">
        <div className="flex flex-col gap-1 px-2">
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <div className="flex h-6 items-center">
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
        <div className="px-1">
          <Skeleton className="h-9 w-full" />
        </div>
        <ul className="flex flex-col gap-0.5">
          {Array.from({length: 6}, (_, index) => (
            // oxlint-disable-next-line react/no-array-index-key -- placeholders, never reordered.
            <li key={index} className="flex items-start gap-3 p-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
                <div className="flex justify-between gap-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-3 w-full" />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="hidden min-h-0 flex-col items-center justify-center gap-3 px-6 py-16 lg:flex">
        <Skeleton className="size-12 rounded-2xl" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-80" />
      </div>
    </div>
  );
}
