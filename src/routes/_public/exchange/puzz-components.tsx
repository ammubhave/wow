import React, {useState} from "react";
import {cn} from "tailwind-variants";

import {useAppForm} from "@/components/form";
import {Button} from "@/components/ui/button";
import {ButtonGroup, ButtonGroupText} from "@/components/ui/button-group";
import {Card} from "@/components/ui/card";
import {FieldGroup} from "@/components/ui/field";
import {InputGroup} from "@/components/ui/input-group";
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
  flavor: string;
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
        <div className="text-lg font-semibold">
          <form.AppForm>
            <form.Form className="flex flex-row">
              <FieldGroup>
                <form.AppField name="answer">
                  {field => (
                    <>
                      <ButtonGroup className="w-1/2 min-w-60">
                        <ButtonGroupText className="min-w-16">Check:</ButtonGroupText>
                        <InputGroup>
                          <field.InputGroupInputField className="whitespace-pre uppercase font-mono" />
                        </InputGroup>
                        <form.SubmitButton>Check</form.SubmitButton>
                      </ButtonGroup>
                      <div>{checkResponse}</div>
                    </>
                  )}
                </form.AppField>
              </FieldGroup>
            </form.Form>
          </form.AppForm>
        </div>
        <Separator orientation="horizontal" className="my-6" />
        <div className="italic mb-10">{flavor}</div>
        {children}
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
              <span
                className={cn(
                  "ml-4 pl-1 mr-30",
                  hintsHidden[index] ? "bg-black text-black select-none pointer-events-none" : ""
                )}>
                {hint}
              </span>
            </div>
          ))}
        </div>
      ))}
    </PuzzCard>
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
          <span
            className={cn(
              "inline-block w-full ml-5 pl-1 mr-30",
              answerHidden ? "bg-black text-black select-none pointer-events-none" : ""
            )}>
            {toAnswerFormat(answer)}
          </span>
          <Button className="mr-10" onClick={() => setAnswerHidden(!answerHidden)}>
            <span className="min-w-10">{answerHidden ? "Show" : "Hide"}</span>
          </Button>
        </div>
        <div className="flex">
          AUTHOR:{"  "}
          <span
            className={cn(
              "inline-block w-full ml-5 pl-1 mr-30",
              authorHidden ? "bg-black text-black" : ""
            )}>
            {author}
          </span>
          <Button className="mr-10" onClick={() => setAuthorHidden(!authorHidden)}>
            <span className="min-w-10">{authorHidden ? "Show" : "Hide"}</span>
          </Button>
        </div>
      </div>
      <Button className="mr-10" onClick={() => setSolutionHidden(!solutionHidden)}>
        <span className="min-w-10">{solutionHidden ? "Show Solution" : "Hide Solution"}</span>
      </Button>
      {!solutionHidden && <div className="flex prose max-w-full">{children}</div>}
    </PuzzCard>
  );
}

function PuzzCard({children}: {children: React.ReactNode}) {
  return <Card className="p-8">{children}</Card>;
}

function toAnswerFormat(str: string) {
  return str.toUpperCase().replace(/[^A-Z]/g, "");
}
