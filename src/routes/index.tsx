import {buttonVariants, Card, Chip} from "@heroui/react";
import {createFileRoute, Link} from "@tanstack/react-router";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  HeadphonesIcon,
  LayoutListIcon,
  ListChecksIcon,
  SheetIcon,
  TrophyIcon,
} from "lucide-react";

import {DecryptedText} from "@/components/decrypted-text";
import {BoardDemo} from "@/components/landing/board-demo";
import {LetterGlitch} from "@/components/letter-glitch";
import {PublicFooter, PublicNavbar} from "@/components/public-chrome";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      {title: "WOW · The workspace for puzzle hunt teams"},
      {
        name: "description",
        content:
          "One live board for every round and puzzle, with a shared spreadsheet, voice call and chat for each puzzle, and who's working on what.",
      },
    ],
  }),
});

function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicNavbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <ExchangeTeaser />
      </main>
      <PublicFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <LetterGlitch />
      {/* The glyphs fade out behind the headline and copy, so the text reads cleanly. */}
      <div
        aria-hidden="true"
        className="max-lg:bg-background/60 pointer-events-none absolute inset-0 lg:bg-[linear-gradient(to_right,var(--background)_25%,transparent_65%)]"
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pt-16 pb-20 md:pt-24 lg:grid-cols-[1fr_1.1fr] lg:pb-28">
        <div className="flex flex-col items-start gap-6">
          <Chip variant="soft" color="accent">
            For puzzle hunt teams
          </Chip>
          <h1 className="text-5xl font-bold tracking-tight text-balance md:text-6xl">
            Solve the hunt,
            <br />
            <span className="text-accent">
              <DecryptedText text="not the logistics." speed={45} />
            </span>
          </h1>
          <p className="text-muted max-w-lg text-lg text-pretty">
            A live board for every round and puzzle. Each puzzle gets its own spreadsheet, voice
            call and chat as soon as you add it.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/workspaces/create" className={buttonVariants({size: "lg"})}>
              Start a workspace
            </Link>
            <Link to="/docs" className={buttonVariants({variant: "tertiary", size: "lg"})}>
              Read the docs
            </Link>
          </div>
        </div>
        <BoardDemo />
      </div>
    </section>
  );
}

const FEATURES = [
  {
    Icon: LayoutListIcon,
    title: "A live blackboard",
    text: "Every round, meta and puzzle, with its answer, status and who's on it. Changes show up for everyone at once.",
  },
  {
    Icon: SheetIcon,
    title: "A page per puzzle",
    text: "A shared spreadsheet with puzzle formulas, a whiteboard and a chat, ready the moment the puzzle is added.",
  },
  {
    Icon: HeadphonesIcon,
    title: "Calls built in",
    text: "A lobby call for the team and one on every puzzle. Your call follows you around the workspace.",
  },
  {
    Icon: ListChecksIcon,
    title: "A guess queue",
    text: "Line up answers to call in, record what the hunt said, wait out backoffs, and never repeat a wrong guess.",
  },
  {
    Icon: TrophyIcon,
    title: "A live leaderboard",
    text: "Standings and awards while you hunt, and a recap card to share when it's over.",
  },
  {
    Icon: CalendarDaysIcon,
    title: "Every upcoming hunt",
    text: "Puzzle hunts from the community calendar in one list. Set up a workspace for one in a click.",
  },
];

function Features() {
  return (
    <section aria-labelledby="features" className="mx-auto max-w-7xl px-6 pt-4 pb-8">
      <h2 id="features" className="text-2xl font-bold tracking-tight">
        What's in a workspace
      </h2>
      <ul className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({Icon, title, text}) => (
          <li key={title} className="flex gap-4">
            <span className="bg-default text-foreground flex size-10 shrink-0 items-center justify-center">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold">{title}</h3>
              <p className="text-muted text-sm text-pretty">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExchangeTeaser() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <Card className="flex-col items-start gap-6 p-8 md:flex-row md:items-center md:p-10">
        <div className="flex flex-1 flex-col gap-2">
          <span className="text-accent text-xs font-semibold tracking-wider uppercase">
            Between hunts
          </span>
          <h2 className="text-2xl font-bold tracking-tight">The Wafflehaüs Puzzle Exchange</h2>
          <p className="text-muted max-w-2xl">
            Every month Wafflehaüs releases a few short, approachable, hunt-style puzzles written by
            team members, and spotlights puzzles from other hunts. Solve them alone or with friends.
          </p>
        </div>
        <Link to="/exchange" className={buttonVariants({variant: "secondary"})}>
          Browse puzzles
          <ArrowRightIcon />
        </Link>
      </Card>
    </section>
  );
}
