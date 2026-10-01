import {Button, Card, InputGroup, Separator, TextField} from "@heroui/react";
import {ExternalLinkIcon} from "lucide-react";
import React, {useState} from "react";
import {cn} from "tailwind-variants";

import {useAppForm} from "@/components/form";
import {celebrate} from "@/lib/confetti";

type PuzzHint = {label: string; hints: Array<string | React.ReactNode>};
type PuzzAlmostAnswer = {answer: string; message: string};

export function Puzz({children, title}: {children: React.ReactNode; title: string}) {
  return (
    <div>
      <h1 className="mb-4 text-center text-4xl font-bold">{title}</h1>
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
      const checkAnswer = toAnswerFormat(value.value.answer);
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
        <div className="flex w-full flex-col items-center gap-4 text-lg font-semibold">
          <form.AppForm>
            <form.Form className="w-full max-w-lg">
              <TextField aria-label="Answer" variant="secondary">
                <InputGroup>
                  <form.AppField name="answer">
                    {field => (
                      <InputGroup.Input
                        className="uppercase"
                        value={field.state.value}
                        onChange={value => field.handleChange(value.target.value)}
                        onBlur={field.handleBlur}
                      />
                    )}
                  </form.AppField>
                  <InputGroup.Suffix>
                    <Button type="submit">Submit Answer</Button>
                  </InputGroup.Suffix>
                </InputGroup>
              </TextField>
            </form.Form>
          </form.AppForm>
          {checkResponse && <div>{checkResponse}</div>}
        </div>
        <Separator orientation="horizontal" className="my-6" />
        {flavor && <div className="mb-10 italic">{flavor}</div>}
        <div className="flex flex-col items-center text-center">{children}</div>
      </div>
    </PuzzCard>
  );
}

export function PuzzHints({hints}: {hints: Array<PuzzHint>}) {
  type IndexedHint = {index: number; hint: string | React.ReactNode};
  type PuzzIndexedHint = {label: string; hints: Array<IndexedHint>};
  let count = 0;
  const indexedHints: Array<PuzzIndexedHint> = [];
  for (const puzzHint of hints) {
    const indexed: Array<IndexedHint> = [];
    for (const hint of puzzHint.hints) {
      indexed.push({index: count, hint: hint});
      count += 1;
    }
    indexedHints.push({label: puzzHint.label, hints: indexed});
  }

  const [hintsHidden, setHintsHidden] = useState(Array<boolean>(count).fill(true));
  return (
    <PuzzCard>
      <h2 className="text-2xl font-bold">Hints</h2>
      {indexedHints.map(indexedHint => (
        <div key={indexedHint.label}>
          <div className="text-lg">{indexedHint.label}</div>
          {indexedHint.hints.map(({index, hint}) => (
            <div key={index} className="w-full">
              <Button
                onPress={() =>
                  setHintsHidden(prev => prev.map((hidden, i) => (i === index ? !hidden : hidden)))
                }>
                <span className="min-w-10">{hintsHidden[index] ? "Show" : "Hide"}</span>
              </Button>
              <span className="ml-2">{index + 1})</span>
              <PuzzHidden className="mr-30 ml-4 pl-1" hidden={hintsHidden[index]!}>
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
  const [solutionHidden, setSolutionHidden] = useState(true);
  const [answerHidden, setAnswerHidden] = useState(true);
  const [authorHidden, setAuthorHidden] = useState(true);
  return (
    <PuzzCard>
      <h2 className="text-2xl font-bold">Solution</h2>
      <div className="flex flex-col gap-2 text-xl font-bold">
        <div className="flex">
          ANSWER:{"  "}
          <PuzzHidden className="mr-30 ml-5 inline-block w-full pl-1" hidden={answerHidden}>
            {toAnswerFormat(answer)}
          </PuzzHidden>
          <Button className="mr-10" onPress={() => setAnswerHidden(!answerHidden)}>
            <span className="min-w-10">{answerHidden ? "Show" : "Hide"}</span>
          </Button>
        </div>
        <div className="flex">
          AUTHOR:{"  "}
          <PuzzHidden className="mr-30 ml-5 inline-block w-full pl-1" hidden={authorHidden}>
            {author}
          </PuzzHidden>
          <Button className="mr-10" onPress={() => setAuthorHidden(!authorHidden)}>
            <span className="min-w-10">{authorHidden ? "Show" : "Hide"}</span>
          </Button>
        </div>
      </div>
      <Button className="mr-10" onPress={() => setSolutionHidden(!solutionHidden)}>
        <span className="min-w-10">{solutionHidden ? "Show Solution" : "Hide Solution"}</span>
      </Button>
      {!solutionHidden && <div className="prose flex max-w-full flex-col">{children}</div>}
    </PuzzCard>
  );
}

export function PuzzLink({children, link}: {children: string; link: string}) {
  return (
    <a target="_blank" rel="noopener noreferrer" href={link} className="underline">
      {children}
      <ExternalLinkIcon className="inline py-1" />
    </a>
  );
}

function PuzzCard({children}: {children: React.ReactNode}) {
  return <Card>{children}</Card>;
}

function toAnswerFormat(str: string) {
  return str.toUpperCase().replace(/[^A-Z]/g, "");
}
