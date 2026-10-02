import {Kbd} from "@heroui/react";
import {createFileRoute, Link} from "@tanstack/react-router";

export const Route = createFileRoute("/_public/docs/")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Getting started | WOW"}]}),
});

function RouteComponent() {
  return (
    <>
      <h1>Getting started</h1>
      <p>
        WOW is a shared workspace for a puzzle hunt team: one live board for every round and puzzle,
        with a spreadsheet, a Discord voice channel and a chat for each puzzle. This guide takes you
        from nothing to a ready workspace in a few minutes.
      </p>

      <h2>1. Create your account</h2>
      <p>
        <Link to="/signup">Sign up</Link> with Google or with an email and password. Once you're in,
        you can add a passkey from your account page to log in with your fingerprint or face next
        time.
      </p>

      <h2>2. Create a workspace</h2>
      <p>
        From <Link to="/workspaces">My workspaces</Link>, choose{" "}
        <Link to="/workspaces/create">Create a new workspace</Link> and fill in:
      </p>
      <ul>
        <li>
          <strong>Team name</strong> and <strong>Event name</strong>, shown at the bottom of the
          workspace.
        </li>
        <li>
          <strong>Workspace ID</strong>, which becomes its address (for example{" "}
          <code>wafflehaus.io/myteam2026</code>) and is how teammates find it.
        </li>
        <li>
          <strong>Workspace password</strong>, which teammates enter once to join.
        </li>
      </ul>
      <p>
        Next you can connect <Link to="/docs/google-drive">Google Drive</Link> and{" "}
        <Link to="/docs/discord">Discord</Link>. Both are optional and can be done later from the
        workspace settings.
      </p>

      <h2>3. Invite your team</h2>
      <p>
        Share the workspace's address. Teammates open it, log in or sign up, and enter the workspace
        password. They can also join from My workspaces with the workspace ID and password.
      </p>

      <h2>4. Add rounds and puzzles</h2>
      <p>
        On the <Link to="/docs/blackboard">blackboard</Link>, add a round, then add puzzles to it as
        they unlock. Give each puzzle a name and a link to its page on the hunt site, and choose
        whether it needs a spreadsheet or a drawing. Metas collect their feeder puzzles, so you can
        see every feeder answer while you work on the meta.
      </p>

      <h2>5. Solve</h2>
      <p>
        Open a puzzle to get its spreadsheet, its chat and its details side by side. Set its status
        (needs eyes, in progress, stuck…) so the team knows where help is needed, and type the
        answer when you crack it: the puzzle is marked solved for everyone at once.
      </p>

      <h2>Handy shortcuts</h2>
      <ul>
        <li>
          <Kbd>/</Kbd> jumps to the blackboard search.
        </li>
        <li>
          <Kbd>⌘ K</Kbd> (or <Kbd>Ctrl K</Kbd>) opens the command palette, to go to any puzzle or
          page.
        </li>
        <li>Star a puzzle to pin it to your favourites at the top of the board.</li>
      </ul>
    </>
  );
}
