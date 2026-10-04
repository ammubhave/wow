import {Badge, Button, Popover, Switch, Tabs} from "@heroui/react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useNavigate} from "@tanstack/react-router";
import {
  AtSignIcon,
  BellIcon,
  CheckCheckIcon,
  MegaphoneIcon,
  PartyPopperIcon,
  SettingsIcon,
} from "lucide-react";
import {useEffect, useRef, useState} from "react";
// react-use-websocket is CommonJS-only; its named export interops reliably (the default does not).
import {useWebSocket} from "react-use-websocket/dist/lib/use-websocket";
import {toast} from "sonner";
import {cn} from "tailwind-variants";
import {useLocalStorage} from "usehooks-ts";

import {RelativeTime} from "@/components/activity-log";
import {useWorkspace} from "@/hooks/use-workspace";
import {track} from "@/lib/analytics";
import {authClient} from "@/lib/auth-client";
import {celebrate} from "@/lib/confetti";
import {orpc} from "@/lib/orpc";
import {workspaceMutations, workspaceQueryOptions} from "@/lib/workspace-mutations";
import type {
  NotificationClientMessage,
  NotificationMessage,
  ReadState,
  WorkspaceNotification,
} from "@/server/notifications";

const toastDismissBroadcastChannel =
  typeof window !== "undefined" ? new BroadcastChannel("sonner-dismiss") : null;
toastDismissBroadcastChannel?.addEventListener("message", event => toast.dismiss(event.data));

/** Per-person notification settings (this browser). */
type Prefs = {solves: boolean; announcements: boolean; mentions: boolean; desktop: boolean};
const DEFAULT_PREFS: Prefs = {solves: true, announcements: true, mentions: true, desktop: false};
const usePrefs = () => useLocalStorage<Prefs>("notificationPrefs", DEFAULT_PREFS);

const notificationsQueryKey = (workspaceSlug: string) => ["notifications", workspaceSlug] as const;
/** Your read state (per person, kept by the server; see ReadState). */
const readStateQueryKey = (workspaceSlug: string) =>
  ["notificationsReadState", workspaceSlug] as const;
const NONE: WorkspaceNotification[] = [];
const NOTHING_READ: ReadState = {seenAt: 0, readIds: []};

/** The workspace's recent notifications, newest first (pushed by the socket; never fetched). */
function useNotifications(workspaceSlug: string) {
  return (
    useQuery<WorkspaceNotification[]>({
      queryKey: notificationsQueryKey(workspaceSlug),
      queryFn: () => NONE,
      staleTime: Infinity,
      enabled: false,
    }).data ?? NONE
  );
}

/** Mentions are only for whoever was mentioned; everything else is for everyone. */
const isForMe = (notification: WorkspaceNotification, me: string | undefined) =>
  notification.type !== "mention" || (me !== undefined && notification.toUserIds.includes(me));

function describe(notification: WorkspaceNotification) {
  switch (notification.type) {
    case "solved":
      return {
        // A team effort: who marked it solved isn't who solved it, so no "by".
        title: `${notification.isMeta ? "Meta solved" : "Solved"}: ${notification.puzzleName}`,
        body: notification.answer ?? "",
      };
    case "announcement":
      return {title: `Announcement from ${notification.from}`, body: notification.message};
    case "mention":
      return {
        title: `${notification.from.name} mentioned you in ${notification.puzzleName}`,
        body: notification.text,
      };
    default:
      return notification satisfies never;
  }
}

/** Receives the workspace's notifications: keeps them for the bell, and pops up new ones. */
export function NotificationsWebSocket({
  workspaceSlug,
  children,
}: {
  workspaceSlug: string;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const session = authClient.useSession().data;
  const me = session?.user.id;
  // The account-wide switch (in the user menu) silences pop-ups altogether.
  const popupsAllowed = session?.user.notificationsDisabled === false;
  const [prefs] = usePrefs();
  const navigate = useNavigate();
  const {mutate: setContributor} = useMutation(workspaceMutations.puzzles.setContributor());

  /**
   * Whether to ask you, as a puzzle gets solved, if you helped: you're on its page, or you've
   * spent a minute or more on it, and you haven't marked yourself already.
   */
  const mightHaveHelped = (puzzleId: string) => {
    if (!me) return false;
    const wire = queryClient.getQueryData(workspaceQueryOptions(workspaceSlug).queryKey);
    const puzzle = wire?.rounds.flatMap(r => r.puzzles).find(p => p.id === puzzleId);
    if (!puzzle || puzzle.contributorIds.includes(me)) return false;
    if (window.location.pathname.endsWith(`/puzzles/${puzzleId}`)) return true;
    const times = queryClient.getQueryData(orpc.puzzles.myTimes.queryKey({input: {workspaceSlug}}));
    return (times?.find(t => t.puzzleId === puzzleId)?.seconds ?? 0) >= 60;
  };

  const open = (notification: WorkspaceNotification) => {
    if (notification.type === "announcement") return;
    track("notification_clicked", {type: notification.type, from: "popup"});
    void navigate({
      to: "/$workspaceSlug/puzzles/$puzzleId",
      params: {workspaceSlug, puzzleId: notification.puzzleId},
      search: notification.type === "mention" ? {view: "chat"} : {},
    });
  };

  useWebSocket(`/api/notification/${workspaceSlug}`, {
    // Shared with the bell, which sends read updates on it.
    share: true,
    shouldReconnect: () => true,
    filter: () => false,
    onMessage: async event => {
      let message: NotificationMessage;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      const key = notificationsQueryKey(workspaceSlug);
      if (message.type === "history") {
        queryClient.setQueryData(key, message.notifications);
        return;
      }
      if (message.type === "readState") {
        const {seenAt, readIds} = message;
        queryClient.setQueryData<ReadState>(readStateQueryKey(workspaceSlug), {seenAt, readIds});
        return;
      }
      queryClient.setQueryData<WorkspaceNotification[]>(key, current => [
        message,
        ...(current ?? []).filter(n => n.id !== message.id),
      ]);
      if (!popupsAllowed || !isForMe(message, me)) return;
      const wanted =
        message.type === "solved"
          ? prefs.solves
          : message.type === "announcement"
            ? prefs.announcements
            : prefs.mentions;
      if (!wanted) return;
      const {title, body} = describe(message);

      // A desktop notification when the tab isn't in view (if you've turned them on).
      if (prefs.desktop && document.hidden && "Notification" in window) {
        if (Notification.permission === "granted") {
          const desktop = new Notification(title, {body, tag: message.id});
          desktop.addEventListener("click", () => {
            window.focus();
            open(message);
          });
        }
      }
      if (message.type === "solved") {
        // The toast must still show if the (lazily loaded) confetti fails.
        await celebrate().catch(() => {});
        const {puzzleId} = message;
        toast.success(title, {
          description: body || undefined,
          action:
            me && mightHaveHelped(puzzleId)
              ? {
                  label: "I helped",
                  onClick: () =>
                    setContributor({workspaceSlug, puzzleId, userId: me, contributed: true}),
                }
              : undefined,
        });
      } else if (message.type === "announcement") {
        toast.info(title, {
          description: body,
          duration: Infinity,
          onDismiss: t => {
            // oxlint-disable-next-line unicorn/require-post-message-target-origin -- BroadcastChannel.postMessage takes no targetOrigin (same-origin only).
            toastDismissBroadcastChannel?.postMessage(t.id);
          },
        });
      } else {
        toast(title, {
          description: body,
          icon: <AtSignIcon className="size-4" />,
          action: {label: "Open", onClick: () => open(message)},
        });
      }
    },
  });
  return children;
}

const ICONS = {
  solved: <PartyPopperIcon className="text-success size-4" />,
  announcement: <MegaphoneIcon className="text-accent size-4" />,
  mention: <AtSignIcon className="text-warning size-4" />,
};

/** Opens the bell from elsewhere (e.g. the "while you were away" summary). */
export const OPEN_BELL_EVENT = "wow:open-notifications";

/**
 * The header's bell: announcements, solves and your mentions, newest first. It lists what's unread
 * unless you ask for everything; opening one marks it read, and "Mark all as read" clears the lot.
 * Read state is per person (kept by the server), so it follows you across browsers and devices.
 * Also holds your notification settings.
 */
export function NotificationBell({workspaceSlug}: {workspaceSlug: string}) {
  const me = authClient.useSession().data?.user.id;
  const notifications = useNotifications(workspaceSlug).filter(n => isForMe(n, me));
  const queryClient = useQueryClient();
  const {seenAt, readIds} =
    useQuery<ReadState>({
      queryKey: readStateQueryKey(workspaceSlug),
      queryFn: () => NOTHING_READ,
      staleTime: Infinity,
      enabled: false,
    }).data ?? NOTHING_READ;
  // The notifications socket (shared with NotificationsWebSocket), to send read updates.
  const {sendJsonMessage} = useWebSocket(`/api/notification/${workspaceSlug}`, {
    share: true,
    shouldReconnect: () => true,
    filter: () => false,
  });
  const sendRead = (message: NotificationClientMessage) => sendJsonMessage(message);
  /** Updates the read state right away; the server confirms (and syncs your other devices). */
  const setReadState = (next: ReadState) =>
    queryClient.setQueryData<ReadState>(readStateQueryKey(workspaceSlug), next);
  const [showAll, setShowAll] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "mentions">("all");
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = usePrefs();
  const navigate = useNavigate();
  const isUnread = (n: WorkspaceNotification) => n.timestamp > seenAt && !readIds.includes(n.id);
  const unread = notifications.filter(isUnread).length;
  const ofTab =
    tab === "mentions" ? notifications.filter(n => n.type === "mention") : notifications;
  const shown = showAll ? ofTab : ofTab.filter(isUnread);
  const markRead = (id: string) => {
    if (readIds.includes(id)) return;
    setReadState({seenAt, readIds: [...readIds, id]});
    sendRead({type: "read", ids: [id]});
  };
  const markAllRead = () => {
    track("notifications_marked_all_read");
    if (notifications[0]) {
      setReadState({seenAt: Math.max(seenAt, notifications[0].timestamp), readIds: []});
    }
    sendRead({type: "readAll"});
  };

  useEffect(() => {
    const onOpen = () => setIsOpen(true);
    window.addEventListener(OPEN_BELL_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_BELL_EVENT, onOpen);
  }, []);

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
    // Back to the unread list next time.
    if (!open) setShowAll(false);
  };

  const enableDesktop = async (on: boolean) => {
    if (on && "Notification" in window && Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Your browser blocked notifications for this site.");
        return;
      }
    }
    setPrefs(current => ({...current, desktop: on}));
  };

  return (
    <Popover isOpen={isOpen} onOpenChange={onOpenChange}>
      <Badge.Anchor>
        <Button
          size="sm"
          isIconOnly
          variant="ghost"
          aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}>
          <BellIcon />
        </Button>
        {unread > 0 && (
          <Badge color="danger" size="sm" placement="top-right">
            {unread > 99 ? "99+" : unread}
          </Badge>
        )}
      </Badge.Anchor>
      <Popover.Content placement="bottom end" className="w-[min(24rem,calc(100vw-2rem))]">
        <Popover.Dialog aria-label="Notifications" className="flex max-h-[70vh] flex-col p-0">
          <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
            <Tabs
              selectedKey={tab}
              onSelectionChange={key => setTab(key === "mentions" ? "mentions" : "all")}>
              <Tabs.ListContainer>
                <Tabs.List aria-label="Show">
                  <Tabs.Tab id="all" className="h-7 px-3 text-xs">
                    All
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab id="mentions" className="h-7 px-3 text-xs">
                    Mentions
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>
            <Button
              size="sm"
              isIconOnly
              variant={showSettings ? "secondary" : "ghost"}
              aria-label="Notification settings"
              aria-pressed={showSettings}
              onPress={() => setShowSettings(s => !s)}>
              <SettingsIcon />
            </Button>
          </div>
          {showSettings && (
            <div className="border-separator flex flex-col gap-2 border-y px-3 py-3">
              <p className="text-muted text-xs">Pop up when…</p>
              {(
                [
                  ["solves", "A puzzle is solved"],
                  ["announcements", "There's an announcement"],
                  ["mentions", "Someone mentions you"],
                ] as const
              ).map(([key, label]) => (
                <Switch
                  key={key}
                  size="sm"
                  isSelected={prefs[key]}
                  onChange={on => setPrefs(current => ({...current, [key]: on}))}>
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    <span className="text-sm">{label}</span>
                  </Switch.Content>
                </Switch>
              ))}
              <Switch size="sm" isSelected={prefs.desktop} onChange={on => void enableDesktop(on)}>
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <span className="text-sm">Desktop notifications when the tab is hidden</span>
                </Switch.Content>
              </Switch>
            </div>
          )}
          <ul className="min-h-0 flex-1 overflow-y-auto py-1" aria-label="Notifications">
            {shown.length === 0 && (
              <li className="text-muted px-3 py-8 text-center text-sm">
                {!showAll && ofTab.length > 0
                  ? "You're all caught up."
                  : tab === "mentions"
                    ? "No mentions yet. Nobody's @-ed you. Suspiciously quiet."
                    : "All quiet. The puzzles are still winning."}
              </li>
            )}
            {shown.map(notification => {
              const {title, body} = describe(notification);
              const unreadNow = isUnread(notification);
              const target = notification.type === "announcement" ? null : notification.puzzleId;
              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (unreadNow) markRead(notification.id);
                      track("notification_clicked", {type: notification.type, from: "bell"});
                      if (!target) return;
                      onOpenChange(false);
                      void navigate({
                        to: "/$workspaceSlug/puzzles/$puzzleId",
                        params: {workspaceSlug, puzzleId: target},
                        search: notification.type === "mention" ? {view: "chat"} : {},
                      });
                    }}
                    className={cn(
                      "hover:bg-surface-secondary flex w-full cursor-pointer items-start gap-3 px-3 py-2 text-start",
                      !unreadNow && "opacity-60"
                    )}>
                    <span className="mt-0.5 shrink-0">{ICONS[notification.type]}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-medium">{title}</span>
                      {body && (
                        <span className="text-muted line-clamp-2 text-xs wrap-anywhere">
                          {body}
                        </span>
                      )}
                      <span className="text-muted text-xs">
                        <RelativeTime date={notification.timestamp} />
                      </span>
                    </span>
                    {unreadNow && (
                      <span
                        className="bg-accent mt-1.5 size-2 shrink-0 rounded-full"
                        aria-label="Unread"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-separator flex items-center justify-between gap-2 border-t px-2 py-1.5">
            <Button size="sm" variant="ghost" onPress={() => setShowAll(all => !all)}>
              {showAll ? "Show unread only" : "Show all notifications"}
            </Button>
            <Button size="sm" variant="ghost" isDisabled={unread === 0} onPress={markAllRead}>
              <CheckCheckIcon />
              Mark all as read
            </Button>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

const AWAY_KEY = (workspaceSlug: string) => `lastActive:${workspaceSlug}`;
/** Away at least this long before getting a "while you were away" summary. */
const AWAY_MS = 30 * 60 * 1000;

/**
 * "While you were away": back after half an hour or more, a quick summary of what happened (from
 * the bell's notifications and the activity log), with a way into the bell.
 */
export function AwaySummary({workspaceSlug}: {workspaceSlug: string}) {
  const me = authClient.useSession().data?.user.id;
  const notifications = useNotifications(workspaceSlug);
  const workspace = useWorkspace();
  const notificationsRef = useRef(notifications);
  const activityRef = useRef(workspace.activityLogEntries);
  useEffect(() => {
    notificationsRef.current = notifications;
    activityRef.current = workspace.activityLogEntries;
  });

  useEffect(() => {
    const read = () => Number(localStorage.getItem(AWAY_KEY(workspaceSlug)) ?? 0);
    const touch = () => {
      try {
        localStorage.setItem(AWAY_KEY(workspaceSlug), String(Date.now()));
      } catch {
        // Storage unavailable (private mode): no summaries, nothing else breaks.
      }
    };
    const summarize = (since: number) => {
      const recent = notificationsRef.current.filter(n => n.timestamp > since && isForMe(n, me));
      const solves = recent.filter(n => n.type === "solved").length;
      const announcements = recent.filter(n => n.type === "announcement").length;
      const mentions = recent.filter(n => n.type === "mention").length;
      const rounds = activityRef.current.filter(
        entry =>
          entry.round_activity_log_entry?.subType === "create" &&
          new Date(entry.activity_log_entry.createdAt).getTime() > since
      ).length;
      const parts = [
        solves && `${solves} ${solves === 1 ? "solve" : "solves"}`,
        rounds && `${rounds} new ${rounds === 1 ? "round" : "rounds"}`,
        announcements &&
          `${announcements} ${announcements === 1 ? "announcement" : "announcements"}`,
        mentions && `you were mentioned ${mentions === 1 ? "once" : `${mentions} times`}`,
      ].filter(Boolean);
      if (parts.length === 0) return;
      toast("While you were away", {
        description: parts.join(" · "),
        duration: 15_000,
        action: {label: "Show", onClick: () => window.dispatchEvent(new Event(OPEN_BELL_EVENT))},
      });
    };
    const check = () => {
      if (document.hidden) {
        touch();
        return;
      }
      const last = read();
      // Give the socket a moment to deliver the history first.
      if (last > 0 && Date.now() - last > AWAY_MS) setTimeout(() => summarize(last), 2500);
      // Marks you active now, so this summary isn't shown again.
      touch();
    };
    check();
    const timer = setInterval(() => {
      if (!document.hidden) touch();
    }, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [me, workspaceSlug]);

  return null;
}
