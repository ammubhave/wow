import {createFileRoute, Link} from "@tanstack/react-router";

import {CoffeeIcon} from "@/components/coffee-icon";
import {Button} from "@/components/ui/button";

export const Route = createFileRoute("/")({component: App});

function App() {
  return (
    <div
      className="min-h-screen"
      style={{backgroundImage: "url(/bg.jpg)", backgroundSize: "cover"}}>
      <div className="flex min-h-screen flex-col py-10 backdrop-blur-3xl">
        <header>
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-4 px-4 sm:justify-between sm:px-6 lg:flex-nowrap lg:px-8">
            <div className="relative z-20 flex flex-col items-center gap-4 text-lg font-medium text-black sm:flex-row">
              <img src="/wafflehaus.png" className="rounded-full" width={48} height={48} />
              Wafflehäus Organized Workspace
            </div>
            <div className="flex flex-col-reverse flex-wrap items-center gap-4 sm:flex-row">
              <Button variant="ghost" asChild>
                <Link to="/docs">Documentation</Link>
              </Button>
              <Button asChild>
                <Link to="/workspaces">My Workspaces</Link>
              </Button>
            </div>
          </div>
        </header>
        <div className="overflow-auto overflow-y-auto flex flex-1 items-center justify-center">
          <div className="max-w-7xl flex-1 px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl lg:max-w-4xl lg:px-12">
              <h1 className="font-display text-foreground text-5xl font-bold tracking-tighter sm:text-7xl">
                A workspace for puzzle hunters.
              </h1>
              <div className="text-background mt-6 space-y-6 text-2xl tracking-tight">
                <p className="font-display">
                  Wafflehäus Organized Workspace (WOW) is a platform for puzzle hunt teams to
                  organize when solving puzzles. It provides several automations such as creating
                  google spreadsheets, discord channels, and more.
                </p>
                <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Button asChild>
                    <Link to="/workspaces">Get Started</Link>
                  </Button>
                  <Button variant="ghost" className="gap-2" asChild>
                    <Link to="/docs">
                      Learn more <span aria-hidden="true">→</span>
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <div className="flex max-w-7xl flex-1 flex-col flex-wrap items-center justify-between gap-4 px-8 text-sm sm:flex-row">
            <div>
              <p className="text-background flex flex-col items-center gap-4 text-sm font-semibold sm:flex-row">
                <Link className="hover:text-primary" to="/tos">
                  Terms of Service
                </Link>
                <Link className="hover:text-primary" to="/privacy-policy">
                  Privacy Policy
                </Link>
              </p>
            </div>
            <div className="max-w-md text-sm">
              <Button variant="secondary" className="gap-2 font-['Cookie'] text-xl" asChild>
                <a href="https://www.buymeacoffee.com/amolbhave" target="_blank">
                  <CoffeeIcon className="size-4" />
                  Buy me a coffee
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
