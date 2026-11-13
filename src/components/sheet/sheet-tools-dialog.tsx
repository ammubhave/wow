import {Button, Modal} from "@heroui/react";

import {ControlledModal} from "@/components/controlled-dialog";

type Tool = {name: string; what: string; example: string; gives: string};

/**
 * WOW's puzzle formulas. Each example is self-contained (no cell references), so it works
 * wherever it's inserted; people then swap the text for a cell.
 */
const GROUPS: {title: string; tools: Tool[]}[] = [
  {
    title: "Words",
    tools: [
      {
        name: "MATCHES",
        what: "Words and phrases fitting a pattern, best first. ? is any letter, * any run, @ a vowel, # a consonant. An optional second argument sets how many (50 by default).",
        example: '=MATCHES("C?OSS?ORD")',
        gives: "CROSSWORD",
      },
      {
        name: "ANAGRAMS",
        what: "Words and phrases using exactly these letters, best first. ? is a blank.",
        example: '=ANAGRAMS("SILENT")',
        gives: "ENLIST, INLETS, LISTEN…",
      },
      {
        name: "ISWORD",
        what: "TRUE if the text is a word or phrase in the word list (spaces are ignored).",
        example: '=ISWORD("ICE CREAM")',
        gives: "TRUE",
      },
    ],
  },
  {
    title: "Ciphers",
    tools: [
      {
        name: "CAESAR",
        what: "Shifts each letter by a number of places.",
        example: '=CAESAR("HAL", 1)',
        gives: "IBM",
      },
      {
        name: "CAESARALL",
        what: "All 25 shifts, one per row, to scan for the one that reads.",
        example: '=CAESARALL("URYYB")',
        gives: "13 → HELLO, among others",
      },
      {
        name: "A1Z26",
        what: "Numbers to letters (1 = A), or letters to numbers.",
        example: '=A1Z26("8 9")',
        gives: "HI",
      },
      {
        name: "MORSE",
        what: "Decodes Morse (. or · for dit, - or _ for dah, / between words), or encodes text.",
        example: '=MORSE("... --- ...")',
        gives: "SOS",
      },
    ],
  },
  {
    title: "Extraction",
    tools: [
      {
        name: "NTH",
        what: "The nth letter, skipping spaces, digits and punctuation; negative counts from the end. Works down a range: =NTH(A1:A10, B1:B10).",
        example: '=NTH("Puzzle hunt", 7)',
        gives: "h",
      },
    ],
  },
];

/** The built-in sheet's puzzle formulas and actions, with examples to drop into a cell. */
export function SheetToolsDialog({
  isOpen,
  onOpenChange,
  onInsert,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Puts the formula in the selected cell; false when nothing is selected. */
  onInsert: (formula: string) => boolean;
}) {
  return (
    <ControlledModal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Puzzle tools</Modal.Heading>
            <p className="text-muted text-sm">
              Formulas made for puzzles. Select a cell, then insert an example and change its text
              to a cell, like A1.
            </p>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-5">
            {GROUPS.map(group => (
              <section key={group.title} className="flex flex-col gap-2">
                <h3 className="text-muted text-xs font-medium tracking-wide uppercase">
                  {group.title}
                </h3>
                <ul className="divide-separator flex flex-col divide-y">
                  {group.tools.map(tool => (
                    <li key={tool.name} className="flex items-start gap-3 py-2.5">
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="font-mono text-sm font-semibold">{tool.name}</span>
                        <span className="text-muted text-sm">{tool.what}</span>
                        <span className="text-xs">
                          <code className="bg-default rounded px-1 py-0.5">{tool.example}</code>
                          <span className="text-muted"> → {tool.gives}</span>
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`Insert ${tool.name} example`}
                        onPress={() => {
                          if (onInsert(tool.example)) onOpenChange(false);
                        }}>
                        Insert
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <section className="flex flex-col gap-2">
              <h3 className="text-muted text-xs font-medium tracking-wide uppercase">
                Right-click a selection
              </h3>
              <ul className="text-muted flex list-disc flex-col gap-1.5 ps-5 text-sm">
                <li>
                  <span className="text-foreground font-medium">Make crossword grid</span>: select
                  the grid's cells (e.g. 15 × 15). Type # or . for a black square; clue numbers fill
                  in by themselves.
                </li>
                <li>
                  <span className="text-foreground font-medium">Highlight in my color</span>: tints
                  the cells in your cursor color, so teammates see what you're working on. Also in
                  the toolbar.
                </li>
              </ul>
            </section>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </ControlledModal>
  );
}
