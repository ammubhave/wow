import {createFileRoute} from "@tanstack/react-router";

import {Puzz, PuzzLink, PuzzMain, PuzzHints, PuzzSolution} from "./puzz-components";

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
        <audio src="/eulogy-poems-6.mp3" controls className="mb-4">
          Your browser does not support the audio element.
        </audio>
      </PuzzMain>
      <PuzzHints
        hints={[
          {
            label: "Getting Started",
            hints: [
              "Have you transcribed the audio? Are there any unusual lines that catch your eye?",
              "Try entering the unusual lines in a search engine. Try quotes for exact matches.",
            ],
          },
          {
            label: "Identification",
            hints: [
              '"Meowdy, moon partner!" Some of these lines reference Mooncat nail polishes.',
              "What are the other lines that aren't referencing nail polishes?",
              '"For the stock market crash on the sixth of November" identifies Ben & Jerry\'s ice creams.',
            ],
          },
          {
            label: "Data Collection",
            hints: [
              "What do these nail polishes have in common? The ice cream flavors?",
              "Find canonical listings of these things.",
              <>
                <PuzzLink link="https://www.benjerry.com/flavors/flavor-graveyard">
                  The Flavor Graveyard
                </PuzzLink>{" "}
                and{" "}
                <PuzzLink link="https://www.mooncat.com/collections/dearly-departed">
                  Dearly Departed Collection
                </PuzzLink>{" "}
                have text from the flavor text!
              </>,
            ],
          },
          {
            label: "Extraction",
            hints: [
              "What's the given ordering?",
              "Number, count, and add! Do any numbers quickly match up?",
              "The given ordering is alphabetical by ice cream. The intended ordering is by nail polish.",
              "How do we extract a single letter from each nail polish?",
              "Use line number from each poem as an index into the ice cream. Order by nail polish!",
            ],
          },
        ]}
      />
      <PuzzSolution author="Jacqui" answer="ICECREAMMANICURE">
        Test solution blah blah blah
      </PuzzSolution>
    </Puzz>
  );
}
