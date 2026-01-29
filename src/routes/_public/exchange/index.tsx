import {createFileRoute} from "@tanstack/react-router";

import {Card} from "@/components/ui/card";

export const Route = createFileRoute("/_public/exchange/")({component: RouteComponent});

function RouteComponent() {
  return (
    <div className="flex flex-1 flex-col items-stretch justify-center max-w-5xl">
      <h1 className="text-4xl font-bold mb-4 text-center">Wafflehaüs Puzzle Exchange!</h1>
      <Card className="flex-1 p-8">
        <div className="prose max-w-full">
          <p>
            <h1>WPE! WPE! WPE!</h1>
          </p>
          <p>
            Every month, Wafflehaüs will release a small number of approachable, short, Hunt-length
            puzzles written by team members, as well as spotlighting puzzles from other hunts.
          </p>
          <p>
            <h2>Interested in solving?</h2>
          </p>
          <p>
            Find the puzzles on the left. Feel free to solve by yourself or with friends! Once
            you've solved the puzzle, go react to the corresponding Discord message!
          </p>
          <p>
            There has been a WOW workspace set up for your convenience called{" "}
            <a target="_blank" rel="noopener noreferrer" href="https://www.wafflehaus.io/wpe">
              WPE
            </a>
            . The password is <code>sumhint</code>. Please be courteous! You're sharing this
            workspace with the whole team. See instructions on the workspace itself.
          </p>
          <p>
            <h2>Interested in writing?</h2>
          </p>
          <p>Reach out to Allen on Discord!</p>
        </div>
      </Card>
    </div>
  );
}
