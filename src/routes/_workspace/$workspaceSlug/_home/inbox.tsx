import {
  Avatar,
  Button,
  ScrollShadow,
  SearchField,
  Skeleton,
  Spinner,
  Tabs,
  Tooltip,
} from "@heroui/react";
import {useInfiniteQuery, useQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  CopyIcon,
  DownloadIcon,
  InboxIcon,
  PaperclipIcon,
  XIcon,
} from "lucide-react";
import {useState} from "react";
import {toast} from "sonner";
import {cn} from "tailwind-variants";
import {useFormatter} from "use-intl";
import {z} from "zod";

import {RelativeTime} from "@/components/activity-log";
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
 * Keeps an email's HTML from doing anything but show itself: no scripts, nothing loaded from the
 * web (which would tell the sender it was read), and links open in a new tab.
 */
const SANDBOX_HEAD =
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:">` +
  `<base target="_blank">` +
  `<style>body{font-family:system-ui,sans-serif;font-size:14px;margin:12px;color:#18181b;background:#fff}</style>`;

/** The open email: its toolbar, who sent it, its text or formatted version, and attachments. */
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
  const email = useQuery(orpc.workspaces.emails.get.queryOptions({input: {workspaceSlug, id}}));
  const [view, setView] = useState<"text" | "formatted">("text");
  const data = email.data;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-clip lg:py-4 lg:pr-4 lg:pl-0.5">
      <div className="lg:bg-surface lg:shadow-surface flex max-h-full flex-1 flex-col gap-6 overflow-clip p-4 lg:rounded-2xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link
              to="/$workspaceSlug/inbox"
              params={{workspaceSlug}}
              search={{}}
              aria-label="Back to the inbox"
              className="text-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-full border transition-colors lg:hidden">
              <ChevronLeftIcon className="size-4" />
            </Link>
            <Link
              to="/$workspaceSlug/inbox"
              params={{workspaceSlug}}
              search={{}}
              aria-label="Close"
              className="bg-default text-muted hover:bg-default-hover hidden size-6 shrink-0 items-center justify-center rounded-xl transition-colors lg:inline-flex">
              <XIcon className="size-4" />
            </Link>
            {data && (
              <Tooltip delay={300}>
                <a
                  href={`/api/workspaces/${encodeURIComponent(workspaceSlug)}/emails/${encodeURIComponent(id)}`}
                  aria-label="Download the email"
                  className="text-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-full transition-colors">
                  <DownloadIcon className="size-4" />
                </a>
                <Tooltip.Content>
                  Download the email as received (.eml), attachments and all
                </Tooltip.Content>
              </Tooltip>
            )}
          </div>
          {position && (
            <div className="flex items-center gap-3 px-2">
              <span className="text-muted text-xs tabular-nums">
                {position.index + 1} of {position.count}
              </span>
              <div className="flex items-center">
                <StepLink workspaceSlug={workspaceSlug} id={previousId} label="Newer email">
                  <ArrowLeftIcon className="size-4" />
                </StepLink>
                <StepLink workspaceSlug={workspaceSlug} id={nextId} label="Older email">
                  <ArrowRightIcon className="size-4" />
                </StepLink>
              </div>
            </div>
          )}
        </div>

        <ScrollShadow hideScrollBar className="min-h-0 flex-1 overflow-y-auto lg:px-6">
          {email.isPending ? (
            <div className="flex justify-center py-10">
              <Spinner size="sm" aria-label="Loading the email" />
            </div>
          ) : !data ? (
            <p className="text-danger py-10 text-center text-sm">Couldn't load this email.</p>
          ) : (
            <div className="flex flex-col gap-6 pb-5">
              <h2 className="text-base leading-normal font-semibold">
                {data.subject ?? "(no subject)"}
              </h2>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
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
                    <span className="text-muted text-xs leading-tight font-medium">
                      to {contactEmail(workspaceSlug)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-muted text-xs whitespace-nowrap">
                    {format.dateTime(data.receivedAt, {dateStyle: "medium", timeStyle: "short"})}
                  </span>
                  {data.html && (
                    <Tabs
                      selectedKey={view}
                      onSelectionChange={key =>
                        setView(key === "formatted" ? "formatted" : "text")
                      }>
                      <Tabs.ListContainer>
                        <Tabs.List aria-label="How to show the email">
                          <Tabs.Tab id="text" className="h-6 px-2 text-xs">
                            Text
                            <Tabs.Indicator />
                          </Tabs.Tab>
                          <Tabs.Tab id="formatted" className="h-6 px-2 text-xs">
                            Formatted
                            <Tabs.Indicator />
                          </Tabs.Tab>
                        </Tabs.List>
                      </Tabs.ListContainer>
                    </Tabs>
                  )}
                </div>
              </div>
              {view === "formatted" && data.html ? (
                <div className="flex flex-col gap-1">
                  <iframe
                    title={data.subject ?? "Email"}
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    srcDoc={SANDBOX_HEAD + data.html}
                    className="h-[32rem] w-full resize-y rounded-xl border bg-white"
                  />
                  <p className="text-muted text-xs">Images from the web aren't loaded.</p>
                </div>
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

/** Previous/next in the list (disabled at either end). */
function StepLink({
  workspaceSlug,
  id,
  label,
  children,
}: {
  workspaceSlug: string;
  id: string | undefined;
  label: string;
  children: React.ReactNode;
}) {
  const className =
    "text-muted inline-flex size-8 items-center justify-center rounded-full transition-colors";
  if (!id) {
    return (
      <span aria-label={label} aria-disabled className={cn(className, "opacity-40")}>
        {children}
      </span>
    );
  }
  return (
    <Link
      to="/$workspaceSlug/inbox"
      params={{workspaceSlug}}
      search={{email: id}}
      replace
      aria-label={label}
      className={cn(className, "hover:text-foreground")}>
      {children}
    </Link>
  );
}

const formatSize = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function InboxSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-4 py-4 lg:w-[380px]">
      <Skeleton className="h-8 w-32 rounded-lg" />
      {Array.from({length: 5}, (_, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- placeholders, never reordered.
        <Skeleton key={index} className="h-16 rounded-2xl" />
      ))}
    </div>
  );
}
