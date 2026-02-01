import {ExternalLinkIcon} from "lucide-react";
import React, {useState} from "react";
import {cn} from "tailwind-variants";

import {useAppForm} from "@/components/form";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {Separator} from "@/components/ui/separator";
import {celebrate} from "@/lib/confetti";

type PuzzHint = {label: string; hints: Array<string | React.ReactNode>};
type PuzzAlmostAnswer = {answer: string; message: string};

export function Puzz({children, title}: {children: React.ReactNode; title: string}) {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-4 text-center">{title}</h1>
      <div className="flex flex-1 flex-col items-stretch justify-center gap-6">{children}</div>
    </div>
  );
}

export function PuzzMain({
  children,
  flavor,
  answer,
  almostAnswers,
}: {
  children: React.ReactNode;
  flavor?: string;
  answer: string;
  almostAnswers?: Array<PuzzAlmostAnswer>;
}) {
  const [checkResponse, setCheckResponse] = useState("");
  const form = useAppForm({
    defaultValues: {answer: ""},
    onSubmit: async value => {
      var checkAnswer = toAnswerFormat(value.value.answer);
      if (checkAnswer === toAnswerFormat(answer)) {
        await celebrate();
        setCheckResponse(`${checkAnswer} is correct!`);
      } else if (
        almostAnswers &&
        almostAnswers.some(almostAnswer => toAnswerFormat(almostAnswer.answer) === checkAnswer)
      ) {
        const message = almostAnswers.find(
          almostAnswer => toAnswerFormat(almostAnswer.answer) === checkAnswer
        )?.message;
        setCheckResponse(message!);
      } else {
        setCheckResponse(`${checkAnswer} is incorrect.`);
      }
    },
  });
  return (
    <PuzzCard>
      <div className="prose max-w-full">
        <div className="text-lg font-semibold gap-4 w-full flex flex-col items-center">
          <form.AppForm>
            <form.Form className="max-w-lg w-full">
              <InputGroup>
                <form.AppField name="answer">
                  {field => (
                    <InputGroupInput
                      className="uppercase"
                      value={field.state.value}
                      onChange={value => field.handleChange(value.target.value)}
                      onBlur={field.handleBlur}
                    />
                  )}
                </form.AppField>
                <InputGroupAddon align="inline-end">
                  <InputGroupButton type="submit" variant="default">
                    Submit Answer
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </form.Form>
          </form.AppForm>
          {checkResponse && <div>{checkResponse}</div>}
        </div>
        <Separator orientation="horizontal" className="my-6" />
        {flavor && <div className="italic mb-10">{flavor}</div>}
        <div className="flex flex-col items-center text-center">{children}</div>
      </div>
    </PuzzCard>
  );
}

export function PuzzHints({hints}: {hints: Array<PuzzHint>}) {
  type IndexedHint = {index: number; hint: string | React.ReactNode};
  type PuzzIndexedHint = {label: string; hints: Array<IndexedHint>};
  var count = 0;
  var indexedHints: Array<PuzzIndexedHint> = [];
  for (const puzzHint of hints) {
    var indexed: Array<IndexedHint> = [];
    for (const hint of puzzHint.hints) {
      indexed.push({index: count, hint: hint});
      count += 1;
    }
    indexedHints.push({label: puzzHint.label, hints: indexed});
  }

  var [hintsHidden, setHintsHidden] = useState(Array<boolean>(count).fill(true));
  return (
    <PuzzCard>
      <h2 className="text-2xl font-bold">Hints</h2>
      {indexedHints.map(indexedHint => (
        <div>
          <div className="text-lg">{indexedHint.label}</div>
          {indexedHint.hints.map(({index, hint}) => (
            <div className="w-full">
              <Button
                onClick={() => {
                  const newHintsHidden = [...hintsHidden];
                  newHintsHidden[index] = !newHintsHidden[index];
                  setHintsHidden(newHintsHidden);
                }}>
                <span className="min-w-10">{hintsHidden[index] ? "Show" : "Hide"}</span>
              </Button>
              <span className="ml-2">{index + 1})</span>
              <PuzzHidden className="ml-4 pl-1 mr-30" hidden={hintsHidden[index]!}>
                {hint}
              </PuzzHidden>
            </div>
          ))}
        </div>
      ))}
    </PuzzCard>
  );
}

export function PuzzHidden({
  children,
  className,
  hidden,
}: {
  children: React.ReactNode;
  className?: string;
  hidden: boolean;
}) {
  return (
    <span
      className={cn(
        className ?? "",
        hidden ? "bg-black text-black select-none pointer-events-none" : ""
      )}>
      {children}
    </span>
  );
}

export function PuzzSolution({
  children,
  answer,
  author,
}: {
  children: React.ReactNode;
  answer: string;
  author: string | React.ReactNode;
}) {
  var [solutionHidden, setSolutionHidden] = useState(true);
  var [answerHidden, setAnswerHidden] = useState(true);
  var [authorHidden, setAuthorHidden] = useState(true);
  return (
    <PuzzCard>
      <h2 className="text-2xl font-bold">Solution</h2>
      <div className="flex flex-col text-xl font-bold gap-2">
        <div className="flex">
          ANSWER:{"  "}
          <PuzzHidden className="inline-block w-full ml-5 pl-1 mr-30" hidden={answerHidden}>
            {toAnswerFormat(answer)}
          </PuzzHidden>
          <Button className="mr-10" onClick={() => setAnswerHidden(!answerHidden)}>
            <span className="min-w-10">{answerHidden ? "Show" : "Hide"}</span>
          </Button>
        </div>
        <div className="flex">
          AUTHOR:{"  "}
          <PuzzHidden className="inline-block w-full ml-5 pl-1 mr-30" hidden={authorHidden}>
            {author}
          </PuzzHidden>
          <Button className="mr-10" onClick={() => setAuthorHidden(!authorHidden)}>
            <span className="min-w-10">{authorHidden ? "Show" : "Hide"}</span>
          </Button>
        </div>
      </div>
      <Button className="mr-10" onClick={() => setSolutionHidden(!solutionHidden)}>
        <span className="min-w-10">{solutionHidden ? "Show Solution" : "Hide Solution"}</span>
      </Button>
      {!solutionHidden && <div className="flex flex-col prose max-w-full">{children}</div>}
    </PuzzCard>
  );
}

export function PuzzLink({children, link}: {children: string; link: string}) {
  return (
    <a target="_blank" rel="noopener noreferrer" href={link} className="underline">
      {children}
      <ExternalLinkIcon className="py-1 inline" />
    </a>
  );
}

function PuzzCard({children}: {children: React.ReactNode}) {
  return <Card className="p-8">{children}</Card>;
}

function toAnswerFormat(str: string) {
  return str.toUpperCase().replace(/[^A-Z]/g, "");
}
