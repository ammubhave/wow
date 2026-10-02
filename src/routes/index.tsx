import {buttonVariants, Card, Chip} from "@heroui/react";
import {createFileRoute, Link} from "@tanstack/react-router";
import {ArrowRightIcon} from "lucide-react";

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
          "One live board for every round and puzzle, with a spreadsheet and Discord voice channel for each puzzle, chat, and who's working on what.",
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
            channel and chat as soon as you add it.
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
