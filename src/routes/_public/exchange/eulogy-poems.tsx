import {createFileRoute} from "@tanstack/react-router";

import {Puzz, PuzzMain, PuzzHints, PuzzSolution} from "./puzz-components";

export const Route = createFileRoute("/_public/exchange/eulogy-poems")({component: RouteComponent});

function RouteComponent() {
  return (
    <Puzz title="Eulogy Poems">
      <PuzzMain
        flavor="Even the best / say farewell to / melt away. / Dearly departed / rest so we can mourn /
          once each shade is gone."
        answer="ICECREAMMANICURE"
        almostAnswers={[
          {answer: "ISCREAMMANICURE", message: "Keep going!"},
          {answer: "MAINMUSICCAREER", message: "I see what you did there. Nope."},
          {answer: "REAMERICANMUSIC", message: "I see what you did there. Nope."},
          {answer: "CINERARIUMS", message: "Amusingly related, but nope."},
        ]}>
        <audio src="/eulogy-poems-1.mp3" controls className="mb-4">
          Your browser does not support the audio element.
        </audio>
        <audio src="/eulogy-poems-2.mp3" controls className="mb-4">
          Your browser does not support the audio element.
        </audio>
        <audio src="/eulogy-poems-3.mp3" controls className="mb-4">
          Your browser does not support the audio element.
        </audio>
        <audio src="/eulogy-poems-4.mp3" controls className="mb-4">
          Your browser does not support the audio element.
        </audio>
        <audio src="/eulogy-poems-5.mp3" controls className="mb-4">
          Your browser does not support the audio element.
        </audio>
      </PuzzMain>
      <PuzzHints
        hints={[
          {label: "Getting Started", hints: ["Hint 1", "Hint 2", "Hint 3"]},
          {label: "Still Stuck?", hints: ["Hint 4", "Hint 5"]},
        ]}
      />
      <PuzzSolution author="Jacqui" answer="ICECREAMMANICURE">
        Test solution blah blah blah
      </PuzzSolution>
    </Puzz>
  );
}
