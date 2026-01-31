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
          {answer: "MANICURE", message: "Almost!"},
          {answer: "SCREAMMANICURE", message: "Almost!"},
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
        <p>
          This puzzle has six short audio clips with the puzzle name and flavor text indicating
          these are supposedly poems related to death.
        </p>
        <p>
          The first step is to transcribe the audio, making note of any strange phrases. Some of
          these phrases that don't quite fit in (like "Meowdy, moon partner" and "Fresh cactus
          juice") are from Mooncat nail polish catchphrases. More specifically, the referenced nail
          polishes are all part of the Mooncat Dearly Departed collection. The remaining lines are
          from poems for ice creams in the Ben and Jerry's Flavor Graveyard. The flavor text of the
          puzzle is also a mishmash of the descriptions on each page.
        </p>
        <p>
          We can now identify and associate the Ben and Jerry's flavor for each poem with the
          Mooncat nail polishes, whose catchphrase replaces a single line in the poem. Using the
          line number that's replaced by the Mooncat polish catchphrase, we can index into the ice
          cream name to get a single letter for each polish.
        </p>
        <table>
          <thead>
            <tr>
              <td>poem</td>
              <td>ice cream</td>
              <td>nail polish</td>
              <td>line #</td>
              <td>letter</td>
            </tr>
          </thead>
          <tr>
            <td rowSpan={3}>
              as sweet as saltwater.
              <br />& yet it fouled out:
              <br />
              strawberries & shortbread -<br />a love match devout
              <br />
              but sadly it missed
              <br />
              pour your heart out.
              <br />
              the magnitude of this mattified shade…
              <br />
              put into the serve.
            </td>
            <td rowSpan={3}>COOLBRITANNIA</td>
            <td>THESIRENSREVENGE</td>
            <td>1</td>
            <td>C</td>
          </tr>
          <tr>
            <td>WHISKEYSUNRISE</td>
            <td>6</td>
            <td>R</td>
          </tr>
          <tr>
            <td>TECTONICSHIFT</td>
            <td>7</td>
            <td>I</td>
          </tr>
          <tr>
            <td rowSpan={2}>
              not to be corny, but…
              <br />
              pressure breeds diamonds.
              <br />
              for the stock market crash
              <br />
              on the sixth of november.
            </td>
            <td rowSpan={2}>ECONOMICCRUNCH</td>
            <td>DEMETERSHARVEST</td>
            <td>1</td>
            <td>E</td>
          </tr>
          <tr>
            <td>ANTIFRAGILE</td>
            <td>2</td>
            <td>C</td>
          </tr>
          <tr>
            <td rowSpan={2}>
              meowdy, moon partner.
              <br />
              and green mountain boys,
              <br />
              here history shuts
              <br />
              opal of my eye.
            </td>
            <td rowSpan={2}>ETHANALMOND</td>
            <td>CURIOSITYSPREY</td>
            <td>4</td>
            <td>A</td>
          </tr>
          <tr>
            <td>MIDNIGHTRIDER</td>
            <td>1</td>
            <td>E</td>
          </tr>
          <tr></tr>
          <tr>
            <td rowSpan={2}>
              fresh cactus juice.
              <br />
              evil doesn’t stand a chance.
              <br />
              no one could appreciate it,
              <br />
              so we had to let it die.
            </td>
            <td rowSpan={2}>MIZJELENASSWEETPOTATOPIE</td>
            <td>ANTIVENOM</td>
            <td>2</td>
            <td>I</td>
          </tr>
          <tr>
            <td>PRICKLYPEAR</td>
            <td>1</td>
            <td>M</td>
          </tr>
          <tr>
            <td rowSpan={3}>
              catch some feels.
              <br />
              watermelon, we’re not in nashville anymore…
              <br />
              it proved not to be though,
              <br />a sweet, sugary rush of pixie dust.
            </td>
            <td rowSpan={3}>SUGARPLUM</td>
            <td>APHRODISIAC</td>
            <td>1</td>
            <td>S</td>
          </tr>
          <tr>
            <td>PIXIESTICK</td>
            <td>4</td>
            <td>A</td>
          </tr>
          <tr>
            <td>MOONRISE</td>
            <td>2</td>
            <td>U</td>
          </tr>
          <tr>
            <td rowSpan={3}>
              right, then…is it dead or isn't it?
              <br />
              no it isn't…
              <br />
              hardly a shrinking violet.
              <br />
              the underworld must be missing a lacquer.
              <br />
              rubbish! you're a loony!
              <br />
              unbottle your wrath.
            </td>
            <td rowSpan={3}>VERMONTYPYTHON</td>
            <td>GATESOFHELL</td>
            <td>4</td>
            <td>M</td>
          </tr>
          <tr>
            <td>SUPERVILLAIN</td>
            <td>6</td>
            <td>N</td>
          </tr>
          <tr>
            <td>VENUSFLYTRAP</td>
            <td>3</td>
            <td>R</td>
          </tr>
        </table>
        <p>
          Since the given poem ordering is alphabetically by ice cream flavor, this implies a new
          ordering using the nail polishes, which can be found using the canonical ordering on the
          Mooncat Dearly Departed collection page.
        </p>
        <table>
          <thead>
            <tr>
              <td>nail polish order</td>
              <td>nail polish</td>
              <td>letter</td>
            </tr>
          </thead>
          <tr>
            <td>1</td>
            <td>ANTIVENOM</td>
            <td>I</td>
          </tr>
          <tr>
            <td>2</td>
            <td>APHRODISIAC</td>
            <td>S</td>
          </tr>
          <tr>
            <td>3</td>
            <td>THESIRENSREVENGE</td>
            <td>C</td>
          </tr>
          <tr>
            <td>4</td>
            <td>WHISKEYSUNRISE</td>
            <td>R</td>
          </tr>
          <tr>
            <td>5</td>
            <td>DEMETERSHARVEST</td>
            <td>E</td>
          </tr>
          <tr>
            <td>6</td>
            <td>CURIOSITYSPREY</td>
            <td>A</td>
          </tr>
          <tr>
            <td>7</td>
            <td>GATESOFHELL</td>
            <td>M</td>
          </tr>
          <tr>
            <td>8</td>
            <td>PRICKLYPEAR</td>
            <td>M</td>
          </tr>
          <tr>
            <td>9</td>
            <td>PIXIESTICK</td>
            <td>A</td>
          </tr>
          <tr>
            <td>10</td>
            <td>SUPERVILLAIN</td>
            <td>N</td>
          </tr>
          <tr>
            <td>11</td>
            <td>TECTONICSHIFT</td>
            <td>I</td>
          </tr>
          <tr>
            <td>12</td>
            <td>ANTIFRAGILE</td>
            <td>C</td>
          </tr>
          <tr>
            <td>13</td>
            <td>MOONRISE</td>
            <td>U</td>
          </tr>
          <tr>
            <td>14</td>
            <td>VENUSFLYTRAP</td>
            <td>R</td>
          </tr>
          <tr>
            <td>15</td>
            <td>MIDNIGHTRIDER</td>
            <td>E</td>
          </tr>
        </table>
        <p>
          This gives the phrase "I SCREAM MANICURE", which clues to the final answer "ICE CREAM
          MANICURE", a style of mani with melted ombre nails.{" "}
        </p>
      </PuzzSolution>
    </Puzz>
  );
}
