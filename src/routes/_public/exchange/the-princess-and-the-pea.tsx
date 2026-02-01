import {createFileRoute} from "@tanstack/react-router";
import {useState} from "react";

import {Button} from "@/components/ui/button";

import {Puzz, PuzzHidden, PuzzMain, PuzzHints, PuzzSolution} from "./puzz-components";

export const Route = createFileRoute("/_public/exchange/the-princess-and-the-pea")({
  component: RouteComponent,
});

function RouteComponent() {
  var [numShown, setNumShown] = useState(5);
  return (
    <Puzz title="The Princess And The Pea">
      <PuzzMain answer="HERBALTEA" flavor="The 👑👑👑es can't seem to fall asleep...">
        This is a fake meta puzzle. Reveal the feeder answers one-by-one below!
        <br />
        <br />
        Puzzle A: CINEMA COMPLEX
        <br />
        Puzzle B: ARIOPSIS
        <br />
        Puzzle C: MULTIPLE
        <br />
        Puzzle D: SNOOKER SPICE
        <br />
        Puzzle E: RAPIDOGRAPH
        <br />
        Puzzle F: <PuzzHidden hidden={numShown < 6}>BELPAIRE</PuzzHidden>
        <br />
        Puzzle G: <PuzzHidden hidden={numShown < 7}>MERSIN CUP</PuzzHidden>
        <br />
        Puzzle H: <PuzzHidden hidden={numShown < 8}>POCKET PASSERS</PuzzHidden>
        <br />
        Puzzle I: <PuzzHidden hidden={numShown < 9}>TIAPRIDE</PuzzHidden>
        <br />
        <br />
        <Button
          className="mr-10"
          onClick={() => setNumShown(numShown + 1)}
          disabled={numShown >= 9}>
          <span className="min-w-10">{numShown < 9 ? "Reveal another" : "No more to show"}</span>
        </Button>
      </PuzzMain>
      <PuzzHints
        hints={[
          {
            label: "Getting Started",
            hints: [
              "Try to gauge the obscurity and specificity of the answers. Do they read like clues to something else? Do they seem relevant because of their meaning or because of their letter content?",
              "Is there anything odd in the flavor text that is a hint?",
            ],
          },
          {
            label: "Making Connections",
            hints: [
              "Look at the beginning of the answers. Do they remind you of anything thematic?",
              "The emojis in the flavortext represent 3 key letters per answer to make a connection with.",
              "The first three letters of each answer come from the name of a Disney princess.",
            ],
          },
          {
            label: "Extraction",
            hints: [
              "What's in common across all of the answers that appears thematic in the title?",
              'Every answer contains a "P" after the first few letters of the answer.',
              "Count letters! Do you notice correspondences?",
              "Each princess name has the same number of letters as the remaining letters of the answer.",
              "Take the letter from the princess name that matches the position of the P in the remaining answer string and order by the year the princess debuted!",
            ],
          },
        ]}
      />
      <PuzzSolution author="Jesse" answer="HERBALTEA">
        <p>
          The first 3 letters of each answer are shared with those of an official Disney princess.
          Filling in the missing letters of the name show the remaining answer string is the same
          length as the princess name. The letter "P" appears in each remaining answer string
          exactly once. Reading the corresponding letter from the Disney princess name and placing
          in film release order gives the answer HERBAL TEA.
        </p>
        <table>
          <tr>
            <td>princess</td>
            <td>answer</td>
            <td>answer-3</td>
            <td>"P" position</td>
            <td>index into answer-3</td>
          </tr>
          <tr>
            <td>SNOWWHITE</td>
            <td>SNOOKERSPICE</td>
            <td>OKERSPICE</td>
            <td>6</td>
            <td>H</td>
          </tr>
          <tr>
            <td>CINDERELLA</td>
            <td>CINEMACOMPLEX</td>
            <td>EMACOMPLEX</td>
            <td>7</td>
            <td>E</td>
          </tr>
          <tr>
            <td>ARIEL</td>
            <td>ARIOPSIS</td>
            <td>OPSIS</td>
            <td>2</td>
            <td>R</td>
          </tr>
          <tr>
            <td>BELLE</td>
            <td>BELPAIRE</td>
            <td>PAIRE</td>
            <td>1</td>
            <td>B</td>
          </tr>
          <tr>
            <td>POCAHONTAS</td>
            <td>POCKETPASSERS</td>
            <td>KETPASSERS</td>
            <td>4</td>
            <td>A</td>
          </tr>
          <tr>
            <td>MULAN</td>
            <td>MULTIPLE</td>
            <td>TIPLE</td>
            <td>3</td>
            <td>L</td>
          </tr>
          <tr>
            <td>TIANA</td>
            <td>TIAPRIDE</td>
            <td>PRIDE</td>
            <td>1</td>
            <td>T</td>
          </tr>
          <tr>
            <td>RAPUNZEL</td>
            <td>RAPIDOGRAPH</td>
            <td>IDOGRAPH</td>
            <td>7</td>
            <td>E</td>
          </tr>
          <tr>
            <td>MERIDA</td>
            <td>MERSINCUP</td>
            <td>SINCUP</td>
            <td>6</td>
            <td>A</td>
          </tr>
        </table>
      </PuzzSolution>
    </Puzz>
  );
}
