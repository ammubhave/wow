import {Button, Modal} from "@heroui/react";

import {ControlledModal} from "@/components/controlled-dialog";
import {IconTooltip} from "@/components/icon-button";
import {HelpLink} from "@/docs/components/help-link";
import {PUZZLE_FORMULA_GROUPS} from "@/lib/formula-docs";

/** The puzzle formulas, shared with the docs' formula reference (see lib/formula-docs.ts). */
const GROUPS = PUZZLE_FORMULA_GROUPS.map(group => ({title: group.title, tools: group.formulas}));

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
          <IconTooltip label="Close">
            <Modal.CloseTrigger />
          </IconTooltip>
          <Modal.Header>
            <Modal.Heading>Puzzle tools</Modal.Heading>
            <p className="text-muted text-sm">
              Formulas made for puzzles. Select a cell, then insert an example and change its text
              to a cell, like A1.
            </p>
            <HelpLink slug="reference/formulas">Every formula, with all its options</HelpLink>
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
