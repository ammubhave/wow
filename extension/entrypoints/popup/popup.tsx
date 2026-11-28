import {
  Avatar,
  Button,
  buttonVariants,
  Dropdown,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  Switch,
  TextField,
} from "@heroui/react";
import {useMutation, useQuery} from "@tanstack/react-query";
import {CheckIcon, ExternalLinkIcon, LogOutIcon, PanelRightOpenIcon} from "lucide-react";
import {useEffect, useState} from "react";

import {userAvatarSrc, userInitials} from "@/components/user-hover-card";
import {client, orpc} from "@/lib/orpc";

import {ask, type PuzzleMatch, type TabMessage} from "../../lib/messages";
import {signIn, signOut, startPageAuth, useExtensionUser} from "../../lib/page-auth";
import {pageInfoSchema} from "../../lib/page-info";
import {queryClient} from "../../lib/providers";
import {
  getDefaultWorkspace,
  getLastRound,
  getMentionNotifications,
  setDefaultWorkspace,
  setLastRound,
  setMentionNotifications,
  wowPuzzleUrl,
} from "../../lib/settings";

const ORIGIN = import.meta.env.WOW_ORIGIN;

/**
 * The toolbar popup: sign in, pick the workspace the extension works in, and for the page you're
 * on, either show its puzzle's sidebar or add it as a puzzle in one click.
 */
export function Popup() {
  const user = useExtensionUser();
  useEffect(() => void startPageAuth(), []);
  return (
    <div className="bg-background flex w-[360px] flex-col gap-4 p-4">
      <header className="flex items-center gap-2">
        <img src="/icon/32.png" alt="" className="size-6" />
        <h1 className="flex-1 font-semibold">WOW</h1>
        {user && <AccountMenu name={user.name} email={user.email} image={user.image} />}
      </header>
      {user === undefined ? (
        <Spinner className="self-center" />
      ) : user === null ? (
        <SignIn />
      ) : (
        <SignedIn />
      )}
    </div>
  );
}

function SignIn() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted text-sm">
        See and update your team's puzzles right beside the hunt's pages.
      </p>
      {error && <p className="text-danger text-sm">{error}</p>}
      <Button
        isPending={pending}
        onPress={() => {
          setPending(true);
          setError(undefined);
          signIn()
            .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't sign in."))
            .finally(() => setPending(false));
        }}>
        Sign in to WOW
      </Button>
    </div>
  );
}

function AccountMenu({
  name,
  email,
  image,
}: {
  name: string;
  email: string | null;
  image: string | null;
}) {
  return (
    <Dropdown>
      <Button variant="ghost" size="sm" isIconOnly aria-label="Account">
        <Avatar size="sm" className="size-6">
          <Avatar.Image src={userAvatarSrc({email, image})} alt="" />
          <Avatar.Fallback>{userInitials(name)}</Avatar.Fallback>
        </Avatar>
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          onAction={key => {
            if (key === "sign-out") void signOut().then(() => queryClient.clear());
          }}>
          <Dropdown.Section>
            <Dropdown.Item id="who" textValue={name} isDisabled>
              <div className="flex flex-col">
                <span className="text-sm">{name}</span>
                {email && <span className="text-muted text-xs">{email}</span>}
              </div>
            </Dropdown.Item>
          </Dropdown.Section>
          <Dropdown.Item id="sign-out" textValue="Sign out">
            <LogOutIcon />
            <Label>Sign out</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

/**
 * The page the popup is for: the tab it was opened over, or (opened as a window from the page's
 * context menu, when Chrome won't open the popup itself) the one named by `?tabId=`. Its URL and
 * puzzle name come from its content script (Chrome only tells the popup the URL of a tab it was
 * opened over), and are missing on pages it doesn't run on (Chrome's own, the web store).
 */
function usePage() {
  return useQuery({
    queryKey: ["page"],
    queryFn: async () => {
      const tabId = Number(new URLSearchParams(location.search).get("tabId"));
      const tab = tabId
        ? await browser.tabs.get(tabId).catch(() => undefined)
        : (await browser.tabs.query({active: true, currentWindow: true}))[0];
      if (tab?.id === undefined) return null;
      const answer: unknown = await browser.tabs
        .sendMessage(tab.id, {type: "pageInfo"} satisfies TabMessage)
        .catch(() => undefined);
      const info = pageInfoSchema.catch({}).parse(answer);
      const url = info.url ?? tab.url;
      if (!url) return null;
      return {tabId: tab.id, url, title: info.title?.trim() || tab.title || ""};
    },
    staleTime: Infinity,
  });
}

function SignedIn() {
  const workspaces = useQuery(orpc.me.workspaces.queryOptions());
  const saved = useQuery({queryKey: ["default-workspace"], queryFn: getDefaultWorkspace});
  const active = (workspaces.data ?? []).filter(w => !w.archived);
  // Your only workspace is the default without asking.
  useEffect(() => {
    if (saved.data === null && active.length === 1) {
      void setDefaultWorkspace(active[0]!.slug).then(() => saved.refetch());
    }
  }, [saved, active]);
  const workspaceSlug = saved.data && active.some(w => w.slug === saved.data) ? saved.data : null;

  if (workspaces.isPending || saved.isPending) return <Spinner className="self-center" />;
  if (active.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted text-sm">You're not in a WOW workspace yet.</p>
        <a
          className={buttonVariants({variant: "secondary"})}
          href={`${ORIGIN}/workspaces`}
          target="_blank"
          rel="noopener noreferrer">
          Create or join one
          <ExternalLinkIcon />
        </a>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <Select
        aria-label="Workspace"
        placeholder="Choose a workspace"
        value={workspaceSlug}
        onChange={key => {
          void setDefaultWorkspace(typeof key === "string" ? key : null)
            .then(() => ask({type: "puzzlesChanged"}))
            .then(() => saved.refetch())
            .then(() => queryClient.invalidateQueries({queryKey: ["page-match"]}));
        }}>
        <Label>Workspace</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {active.map(w => (
              <ListBox.Item key={w.slug} id={w.slug} textValue={`${w.teamName} · ${w.eventName}`}>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate">{w.teamName}</span>
                  <span className="text-muted truncate text-xs">{w.eventName}</span>
                </div>
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      {workspaceSlug && <ThisPage workspaceSlug={workspaceSlug} />}
      {workspaceSlug && <MentionSwitch />}
    </div>
  );
}

/** Desktop notifications of @mentions in the workspace (the background shows them). */
function MentionSwitch() {
  const on = useQuery({queryKey: ["mention-notifications"], queryFn: getMentionNotifications});
  if (on.isPending) return null;
  return (
    <Switch
      size="sm"
      isSelected={on.data}
      onChange={next => void setMentionNotifications(next).then(() => on.refetch())}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <span className="text-sm">Notify me when I'm @mentioned</span>
      </Switch.Content>
    </Switch>
  );
}

/** The page you're on: its puzzle, or a one-click way to add it as one. */
function ThisPage({workspaceSlug}: {workspaceSlug: string}) {
  const page = usePage();
  const url = page.data?.url;
  const isWebPage = !!url && /^https?:/.test(url) && !url.startsWith(ORIGIN);
  const match = useQuery({
    queryKey: ["page-match", url, workspaceSlug],
    queryFn: () => ask({type: "matchUrl", url: url!}),
    enabled: isWebPage,
  });
  if (page.isPending) return null;
  if (!isWebPage) {
    return (
      <p className="text-muted text-sm">Open a hunt's puzzle page to add it or see it here.</p>
    );
  }
  if (match.isPending) return <Spinner className="self-center" />;
  if (match.data) return <Matched match={match.data} tabId={page.data!.tabId} />;
  return (
    <AddPuzzle
      workspaceSlug={workspaceSlug}
      url={url}
      tabId={page.data!.tabId}
      pageTitle={page.data!.title}
    />
  );
}

const tell = (tabId: number, message: TabMessage) =>
  browser.tabs.sendMessage(tabId, message).catch(() => undefined);

function Matched({match, tabId}: {match: PuzzleMatch; tabId: number}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <CheckIcon className="text-success shrink-0" />
        <p className="min-w-0 truncate text-sm">
          This page is <span className="font-semibold">{match.name}</span>
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          onPress={() => {
            void tell(tabId, {type: "expand"});
            window.close();
          }}>
          <PanelRightOpenIcon />
          Show sidebar
        </Button>
        <a
          className={buttonVariants({variant: "secondary"})}
          href={wowPuzzleUrl(match.workspaceSlug, match.puzzleId)}
          target="_blank"
          rel="noopener noreferrer">
          Open in WOW
          <ExternalLinkIcon />
        </a>
      </div>
    </section>
  );
}

function AddPuzzle({
  workspaceSlug,
  url,
  tabId,
  pageTitle,
}: {
  workspaceSlug: string;
  url: string;
  tabId: number;
  pageTitle: string;
}) {
  const state = useQuery({
    queryKey: ["workspace-state", workspaceSlug],
    queryFn: () => client.workspaces.state({workspaceSlug}),
  });
  const lastRound = useQuery({
    queryKey: ["last-round", workspaceSlug],
    queryFn: () => getLastRound(workspaceSlug),
  });
  const [name, setName] = useState<string>();
  const [roundId, setRoundId] = useState<string | null>(null);
  const rounds = state.data?.rounds ?? [];
  const chosenRound =
    roundId ??
    (rounds.some(r => r.id === lastRound.data) ? lastRound.data : rounds.at(-1)?.id) ??
    null;
  const puzzleName = name ?? pageTitle;

  const add = useMutation({
    mutationFn: async () => {
      if (!chosenRound) throw new Error("Choose a round.");
      const id = crypto.randomUUID();
      await client.puzzles.create({
        type: "puzzle",
        id,
        workspaceSlug,
        roundId: chosenRound,
        name: puzzleName.trim(),
        tags: [],
        link: url,
      });
      await setLastRound(workspaceSlug, chosenRound);
      await ask({type: "puzzlesChanged"});
      await tell(tabId, {type: "expand"});
    },
    onSuccess: () => window.close(),
  });

  if (state.isPending || lastRound.isPending) {
    return <Spinner className="self-center" />;
  }
  if (rounds.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted text-sm">
          Add a round to the workspace first, then add puzzles to it from here.
        </p>
        <a
          className={buttonVariants({variant: "secondary"})}
          href={`${ORIGIN}/${workspaceSlug}`}
          target="_blank"
          rel="noopener noreferrer">
          Open the board
          <ExternalLinkIcon />
        </a>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={e => {
        e.preventDefault();
        add.mutate();
      }}>
      <h2 className="text-sm font-semibold">Add this page as a puzzle</h2>
      <TextField value={puzzleName} onChange={setName} isRequired>
        <Label>Name</Label>
        <Input variant="secondary" />
      </TextField>
      <Select
        aria-label="Round"
        value={chosenRound}
        onChange={key => setRoundId(typeof key === "string" ? key : null)}>
        <Label>Round</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {rounds.map(r => (
              <ListBox.Item key={r.id} id={r.id} textValue={r.name}>
                {r.name}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      {add.error && <p className="text-danger text-sm">{add.error.message}</p>}
      <Button type="submit" isPending={add.isPending} isDisabled={!puzzleName.trim()}>
        Add puzzle
      </Button>
    </form>
  );
}
