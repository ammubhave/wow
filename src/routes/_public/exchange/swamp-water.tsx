import {createFileRoute} from "@tanstack/react-router";

import {Puzz, PuzzLink, PuzzMain, PuzzHints, PuzzSolution} from "./puzz-components";

export const Route = createFileRoute("/_public/exchange/swamp-water")({component: RouteComponent});

function RouteComponent() {
  return (
    <Puzz title="Swamp Water">
      <PuzzMain answer="RESTAURANT">
        <img
          src="/swamp-water-1.png"
          alt="Swamp Water image 1"
          className="rounded-lg max-w-132 mx-auto"
        />
        <img
          src="/swamp-water-2.png"
          alt="Swamp Water image 2"
          className="rounded-lg max-w-132 mx-auto"
        />
        <br />
        2.64575... (aka a hoop component)
        <br />
        Fog over (aka a telephone thruway)
        <br />
        Former AZ Governor (aka a dramatic confrontation)
        <br />
        Hang clothes (aka attendence)
        <br />
        Hoptimum (aka a trail feature)
        <br />
        Lofi beat (aka reverse a ruling)
        <br />
        Madame Jeanette (aka old enough)
        <br />
        Mauna Loa (aka a secondary attraction)
        <br />
        Olgul jireugi (aka negative aspect)
        <br />
        William Osler (aka loss of power)
        <br />
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
      <PuzzSolution author="Jesse" answer="RESTAURANT">
        <p>
          This puzzle includes ten sodas with ten mixed drinks below (
          <PuzzLink link="https://en.wiktionary.org/wiki/swamp_water">swamp water</PuzzLink>). The
          best place to start is to treat the mixed drinks as clues and start to decode the main
          names and the aliases.
        </p>
        <p>
          After a while you may notice that the drinks can be combined to answer the mixed drink
          clues.
        </p>
        <p>
          <code>AZ governor = Ducey {"->"} (Mountain) Dew + (Hi-) C</code>
        </p>
        <p>
          At the same time, you might be able to decode some of the alias clues. The alias clues are
          all compound words where a part of the word (front or back) goes with the soda in the same
          (front or back) position.
        </p>
        <table>
          <tr>
            <td>clues</td>
            <td>sodas</td>
            <td>aliases</td>
          </tr>
          <tr>
            <td>ROOT 7</td>
            <td>Root Beer + 7 Up</td>
            <td>BACK BOARD</td>
          </tr>
          <tr>
            <td>DUCEY</td>
            <td>Mountain Dew + Hi C</td>
            <td>SHOW DOWN</td>
          </tr>
          <tr>
            <td>MIST UP</td>
            <td>Sierra Mist + 7 Up</td>
            <td>SWITCH BOARD</td>
          </tr>
          <tr>
            <td>SUN DRY</td>
            <td>Sun Drop + Canada Dry</td>
            <td>TURN OUT</td>
          </tr>
          <tr>
            <td>SIERRA BEER</td>
            <td>Sierra Mist + Root Beer</td>
            <td>SWITCH BACK</td>
          </tr>
          <tr>
            <td>MELLO DROP</td>
            <td>Mello Yello + Sun Drop</td>
            <td>OVER TURN</td>
          </tr>
          <tr>
            <td>YELLO PEPPER</td>
            <td>Mello Yello + Dr. Pepper</td>
            <td>OVER AGE</td>
          </tr>
          <tr>
            <td>HAWAIIAN MOUNTAIN</td>
            <td>Hawaiian Punch + Mountain Dew</td>
            <td>SIDE SHOW</td>
          </tr>
          <tr>
            <td>HI PUNCH</td>
            <td>Hi C + Hawaiian Punch</td>
            <td>DOWN SIDE</td>
          </tr>
          <tr>
            <td>CANADA DR</td>
            <td>Canada Dry + Dr Pepper</td>
            <td>OUT AGE</td>
          </tr>
        </table>
        <p>
          Matching the substituted words up to the enumeration of sodas in the given pictures, you
          can take the given indices underneath each pictured soda to get the answer: RESTAURANT.
        </p>
      </PuzzSolution>
    </Puzz>
  );
}
