import {useEffect, useState} from "react";

import {Button} from "./ui/button";

export function EggoText({text}: {text: string}) {
  if (text === "!help") {
    return <EggoHelpText />;
  } else if (text === "!stuck") {
    return <EggoStuckText />;
  } else {
    return <span>{text}</span>;
  }
}

function EggoHeader({children}: {children: React.ReactNode}) {
  return (
    <div>
      <p>
        <b>🧇🍳 {children} 🍳🧇</b>
      </p>
      <br />
    </div>
  );
}

function EggoLine({children}: {children: React.ReactNode}) {
  return <p>🥚 {children} </p>;
}

function EggoHelpText() {
  return (
    <div>
      <EggoHeader>Available commands:</EggoHeader>
      <EggoLine>
        <b>!stuck</b> - Get a random hint.
      </EggoLine>
      <EggoLine>
        <b>!help</b> - Get help from your friendly neighborhood Eggö bot.
      </EggoLine>
    </div>
  );
}

// Partially ripped from https://beta.vero.site/try
// and https://www.alexirpan.com/2024/04/30/puzzlehunting-201.html
const hints = [
  "CHECK YOUR WORK!",
  "Ask someone else to look. Don't over-explain!",
  "Re-check and search for other ways to explain clues.",
  "Pretend you know nothing about the subject matter. Can you interpret the data differently?",
  "Mark the uncertain parts and ask for confirmation.",
  "Re-read the puzzle. Did you use everything?",
  "Make sure you've copied everything from the puzzle correctly.",
  "Re-read the puzzle title and flavor text. Are there allusions, hinted encodings, wordplays, literal interpretations, or misdirections?",
  "CHECK YOUR WORK!",
  "Tell the chat ALL of your bad ideas.",
  "Paste random parts of the puzzle into a search engine. Try adding theme keywords from the puzzle. Try quotes for exact matches.",
  "Ask AI. It might hallucinate correctly!",
  "Is there a given order? If not, what's the correct order?",
  "If you were writing a puzzle like this, what would you do? How is it constrained?",
  "Skip a step! What would you do after this step?",
  "Read down the first letters.",
  "Try cleaning up your sheet. Organization can help you see patterns.",
  "Index numbers into words.",
  "Have words but don't have indexes? Enter it into nutrimatic! [first][second][third]...",
  "Look for patterns in lengths of words or numbers.",
  "Use positions of items as indexes.",
  "CHECK YOUR WORK!",
  "Search for an encoding.",
  "Categorize if you can.",
  "Read in row-order, column-order, or diagonally.",
  "Convert letters to numbers (or vice versa).",
  "Count everything, then add everything. Do any numbers match? Are there multiples?",
  "Look for coinciding letters.",
  "Go deeper! Recurse - do what you did, but again.",
  "CHECK YOUR WORK!",
  "~random anagram~ Try anagramming with uncertain letters (https://util.in/solver).",
  "Try drawing out what you have into 2D or 3D. Use creative mappings - maps, graphs, globes, keyboards, etc.",
  "Read out loud everything that you've found so far.",
  "Ask around to see if there's a reference you're missing.",
  "Take a break! Do something else.",
  "CHECK YOUR WORK!",
  "Check the puzzle presentation and formatting.",
];

function EggoStuckText() {
  const [eggoNum, setEggoNum] = useState(0);

  const rollEggoNum = () => {
    if (hints.length <= 1) return;
    let newEggoNum = eggoNum;
    while (newEggoNum === eggoNum) {
      newEggoNum = Math.floor(Math.random() * hints.length);
    }
    setEggoNum(newEggoNum);
  };
  useEffect(() => {
    if (eggoNum != 0) return; // Don't roll multiple times during the first render.
    rollEggoNum();
  });
  return (
    <div>
      <EggoHeader>Try this!</EggoHeader>
      <EggoLine>
        #{eggoNum + 1} - {hints[eggoNum]}
      </EggoLine>
      <br /> <Button onClick={rollEggoNum}>🧇 Roll</Button>
    </div>
  );
}
