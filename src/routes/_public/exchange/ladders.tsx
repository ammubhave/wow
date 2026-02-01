import {createFileRoute} from "@tanstack/react-router";

import {Puzz, PuzzLink, PuzzMain, PuzzHints, PuzzSolution} from "@/components/puzz-components";

export const Route = createFileRoute("/_public/exchange/ladders")({component: RouteComponent});

function RouteComponent() {
  return (
    <Puzz title="Ladders">
      <PuzzMain
        answer="SHAW THEATRE"
        almostAnswers={[{answer: "SHAWTHEATER", message: "Close! Try again."}]}>
        <p>Word ladder rules apply; each word is off by one from the previous.</p>
        <p>
          <span className="text-lg">Region</span>
          <br />
          Rifle attachment
          <br />
          British noble
          <br />
          Simpson kid
          <br />
          Movie mall cop
          <br />
          Explosion
        </p>
        <p>
          <span className="text-lg">Stitches</span>
          <br />
          Unit of resistance
          <br />
          Brooch
          <br />
          Mathematical constant
          <br />
          Density symbol, in physics
          <br />
          Drink delicately
        </p>
        <p>
          <span className="text-lg">Piece of paper</span>
          <br />
          Sudden shock
          <br />
          Printing fluids
          <br />
          Kitchen basin
          <br />
          Short-limbed lizard
          <br />
          Twist in a garden hose
          <br />
          Brass component
        </p>
        <p>
          <span className="text-lg">Give one's word</span>
          <br />
          Opposite of SE
          <br />
          Beast of burden
          <br />
          Striped cat
          <br />
          Stadium level
          <br />
          Place to dock
          <br />
          Trailblazer
        </p>
        <p>
          <span className="text-lg">In that place</span>
          <br />
          Composed a letter
          <br />
          Meander
          <br />
          Above
          <br />
          Candid
          <br />
          Connotation
          <br />
          Namesake of a political window
        </p>
        <p>
          <span className="text-lg">Encircle, as with a lei</span>
          <br />
          Period of human history from 3000 to 1000 BCE
          <br />
          Metaphor for primitivity
          <br />
          Platform
          <br />
          Male deer
          <br />
          Remain
          <br />
          Pack cargo
          <br />
          Pulls, as a vehicle
          <br />
          Villages
        </p>
        <p>
          <span className="text-lg">The answer</span>
          <br />
          Auditory organ necessary for part of this puzzle (3)
          <br />
          Bathing spots (4)
          <br />
          Close by (4)
          <br />
          Constellation component (4)
          <br />
          Formal dance (4)
          <br />
          Low soccer game tie (3 3)
          <br />
          Make, as a salary (4)
          <br />
          Pub (3)
          <br />
          Roman war god (4)
          <br />
          Soil (5)
          <br />
          Solid yellow pool table item (3 4)
          <br />
          Spreads pitch on, as a road (4)
        </p>
      </PuzzMain>
      <PuzzHints
        hints={[
          {
            label: "Getting Started",
            hints: [
              'Find the easy clues to answer first. You can search clues with "crossword clue" appended.',
              'Traditional word ladder rules don\'t work. What else could "off by one" mean?',
            ],
          },
          {
            label: "Finishing Clues",
            hints: [
              "Can you categorize what kinds of transitions there were?",
              "You should end with seven different transitions. Make sure all of your answers fit.",
            ],
          },
          {
            label: "Extraction",
            hints: [
              "Have you figured out any of the header clues? Focus on the ones you're certain about.",
              "Count things! Do you notice any numbers matching?",
              "A header clue answer is WREATHE. The length matches the number of transitions.",
              "Each transition matches to a letter. Arrange the letters in the final set!",
            ],
          },
        ]}
      />
      <PuzzSolution
        author={
          <PuzzLink link="https://penchantpuzzlehunt.com/puzzle/ladders">
            noneuclidean (guest author)
          </PuzzLink>
        }
        answer="SHAW THEATRE">
        This puzzle was copied from Penchant Puzzle Hunt. All credits go to them! See solution at{" "}
        <PuzzLink link="https://penchantpuzzlehunt.com/puzzle/ladders/solution">
          Penchant Puzzle Hunt
        </PuzzLink>
        .
      </PuzzSolution>
    </Puzz>
  );
}
