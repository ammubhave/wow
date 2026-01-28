import {useState} from "react";
import {cn} from "tailwind-variants";

import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";

export function Puzz({children}: {children: React.ReactNode}) {
  return <div className="flex flex-1 flex-col items-stretch justify-center gap-20">{children}</div>;
}

export function PuzzMain({
  children,
  title,
  flavor,
}: {
  children: React.ReactNode;
  title: string;
  flavor: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-stretch justify-center">
      <h1 className="text-4xl font-bold mb-6 text-center">{title}</h1>
      <Card className="flex-1 p-8 mb-10">
        <div className="prose max-w-full">
          <div className="italic mb-10">{flavor}</div>
          {children}
        </div>
      </Card>
    </div>
  );
}

export function PuzzFooter({
  children,
  answer,
  author,
}: {
  children: React.ReactNode;
  answer: string;
  author: string;
}) {
  var [answerHidden, setAnswerHidden] = useState(true);
  var [authorHidden, setAuthorHidden] = useState(true);
  return (
    <Card className="p-8">
      <div className="flex flex-col select-none text-2xl font-bold">
        <div className="flex">
          ANSWER:{"  "}
          <span
            className={cn(
              "inline-block w-full ml-5 mr-30",
              answerHidden ? "bg-black text-black" : ""
            )}>
            {answer}
          </span>
          <Button onClick={() => setAnswerHidden(!answerHidden)}>
            <span className="min-w-10">{answerHidden ? "Show" : "Hide"}</span>
          </Button>
        </div>
        <div className="flex">
          AUTHOR:{"  "}
          <span
            className={cn(
              "inline-block w-full ml-5 mr-30",
              authorHidden ? "bg-black text-black" : ""
            )}>
            {author}
          </span>
          <Button onClick={() => setAuthorHidden(!authorHidden)}>
            <span className="min-w-10">{authorHidden ? "Show" : "Hide"}</span>
          </Button>
        </div>
      </div>
      {children}
    </Card>
  );
}
