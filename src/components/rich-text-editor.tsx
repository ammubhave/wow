"use client";

import {ContextMenu} from "@heroui-pro/react";
import {RichTextEditor, useRichTextEditor} from "@heroui-pro/react/rich-text-editor";
import {Button, Kbd, Label, Popover} from "@heroui/react";
import type {ChainedCommands, Editor, JSONContent} from "@tiptap/core";
import {Audio} from "@tiptap/extension-audio";
import {Heading} from "@tiptap/extension-heading";
import {Highlight} from "@tiptap/extension-highlight";
import {Image} from "@tiptap/extension-image";
import {TaskItem, TaskList} from "@tiptap/extension-list";
import {Subscript} from "@tiptap/extension-subscript";
import {Superscript} from "@tiptap/extension-superscript";
import {TableKit} from "@tiptap/extension-table";
import {TextAlign} from "@tiptap/extension-text-align";
import {Typography} from "@tiptap/extension-typography";
import {CellSelection} from "@tiptap/pm/tables";
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  HighlighterIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  RedoIcon,
  SquareCodeIcon,
  StrikethroughIcon,
  SubscriptIcon,
  SuperscriptIcon,
  TableIcon,
  UnderlineIcon,
  UndoIcon,
} from "lucide-react";
import {useMemo, useState} from "react";
import {toast} from "sonner";

import {ImageUploadNode} from "@/components/tiptap-node/image-upload-node/image-upload-node-extension";
import {handleImageUpload, MAX_FILE_SIZE} from "@/lib/tiptap-utils";

// HeroUI Pro configures its built-in StarterKit with `heading: {levels: [1, 2, 3]}` and exposes no
// option to change it, so stored h4-h6 nodes would render as h1. `extensions` are appended after
// the defaults and Tiptap uses the last extension of a given name, so this Heading wins.
const AllHeadingLevels = Heading.configure({levels: [1, 2, 3, 4, 5, 6]});

// Extensions appended on top of HeroUI Pro's defaults (StarterKit + Link +
// Underline + CharacterCount + Placeholder). These add the nodes/marks the
// puzzle content uses so existing Tiptap JSON keeps rendering identically.
function extraExtensions(huntPuzzleId: string) {
  return [
    AllHeadingLevels,
    TextAlign.configure({types: ["heading", "paragraph"]}),
    TaskList,
    TaskItem.configure({nested: true}),
    Highlight.configure({multicolor: true}),
    Image,
    Audio.configure({inline: true}),
    Typography,
    Superscript,
    Subscript,
    TableKit.configure({table: {resizable: true}}),
    ImageUploadNode.configure({
      accept: "image/*,audio/*",
      maxSize: MAX_FILE_SIZE,
      limit: 3,
      upload: (file, onProgress, abortSignal) =>
        handleImageUpload(huntPuzzleId, file, onProgress, abortSignal),
      onError: error => {
        console.error("Upload failed:", error);
        toast.error(`Upload failed: ${error.message}`);
      },
    }),
  ];
}

const iconClassName = "size-4";

export function PuzzleRichTextEditor({
  huntPuzzleId,
  defaultValue,
  onChange,
}: {
  huntPuzzleId: string;
  defaultValue?: JSONContent;
  onChange?: (value: JSONContent) => void;
}) {
  const editable = onChange !== undefined;
  // RichTextEditor recreates the Tiptap editor whenever `extensions` changes
  // identity, so the array must be stable across renders.
  const extensions = useMemo(() => extraExtensions(huntPuzzleId), [huntPuzzleId]);

  return (
    <RichTextEditor
      className="flex flex-1 flex-col"
      defaultValue={defaultValue}
      isReadOnly={!editable}
      extensions={extensions}
      onValueChange={editable ? value => onChange?.(value) : undefined}>
      {/* overflow: clip, not the default hidden: hidden makes the shell its own (never-scrolling)
          scroll container, so the toolbar inside it could never stick. */}
      <RichTextEditor.Shell className="overflow-clip">
        {editable && (
          // Pinned to the top of the editor's scroll box, on the editor's own background so the
          // text scrolls underneath it instead of showing through.
          <RichTextEditor.Toolbar
            aria-label="Formatting"
            className="dark:bg-surface bg-surface-secondary border-separator sticky top-0 z-10 flex-wrap border-b">
            <RichTextEditor.ToolbarGroup>
              <RichTextEditor.ActionButton action="undo" tooltip="Undo">
                <UndoIcon className={iconClassName} />
              </RichTextEditor.ActionButton>
              <RichTextEditor.ActionButton action="redo" tooltip="Redo">
                <RedoIcon className={iconClassName} />
              </RichTextEditor.ActionButton>
            </RichTextEditor.ToolbarGroup>

            <RichTextEditor.ToolbarGroup>
              <RichTextEditor.ToggleButton command="heading-1" tooltip="Heading 1">
                <Heading1Icon className={iconClassName} />
              </RichTextEditor.ToggleButton>
              <RichTextEditor.ToggleButton command="heading-2" tooltip="Heading 2">
                <Heading2Icon className={iconClassName} />
              </RichTextEditor.ToggleButton>
              <RichTextEditor.ToggleButton command="heading-3" tooltip="Heading 3">
                <Heading3Icon className={iconClassName} />
              </RichTextEditor.ToggleButton>
            </RichTextEditor.ToolbarGroup>

            <RichTextEditor.ToolbarGroup>
              <RichTextEditor.ToggleButton command="bulletList" tooltip="Bulleted list">
                <ListIcon className={iconClassName} />
              </RichTextEditor.ToggleButton>
              <RichTextEditor.ToggleButton command="orderedList" tooltip="Numbered list">
                <ListOrderedIcon className={iconClassName} />
              </RichTextEditor.ToggleButton>
              <RichTextEditor.ToggleButton command="blockquote" tooltip="Quote">
                <QuoteIcon className={iconClassName} />
              </RichTextEditor.ToggleButton>
              <RichTextEditor.ToggleButton command="codeBlock" tooltip="Code block">
                <SquareCodeIcon className={iconClassName} />
              </RichTextEditor.ToggleButton>
            </RichTextEditor.ToolbarGroup>

            <RichTextEditor.ToolbarGroup>
              <RichTextEditor.ToggleButton command="bold" tooltip="Bold">
                <BoldIcon className={iconClassName} />
              </RichTextEditor.ToggleButton>
              <RichTextEditor.ToggleButton command="italic" tooltip="Italic">
                <ItalicIcon className={iconClassName} />
              </RichTextEditor.ToggleButton>
              <RichTextEditor.ToggleButton command="underline" tooltip="Underline">
                <UnderlineIcon className={iconClassName} />
              </RichTextEditor.ToggleButton>
              <RichTextEditor.ToggleButton command="strike" tooltip="Strikethrough">
                <StrikethroughIcon className={iconClassName} />
              </RichTextEditor.ToggleButton>
              <RichTextEditor.ToggleButton command="code" tooltip="Inline code">
                <CodeIcon className={iconClassName} />
              </RichTextEditor.ToggleButton>
              <RichTextEditor.CommandButton
                aria-label="Highlight"
                tooltip="Highlight"
                isActive={editor => editor.isActive("highlight")}
                onCommand={editor => editor.chain().focus().toggleHighlight().run()}>
                <HighlighterIcon className={iconClassName} />
              </RichTextEditor.CommandButton>
              <RichTextEditor.LinkPopover>
                <RichTextEditor.LinkPopover.Trigger>
                  <LinkIcon className={iconClassName} />
                </RichTextEditor.LinkPopover.Trigger>
                <RichTextEditor.LinkPopover.Content>
                  <RichTextEditor.LinkPopover.Input />
                  <RichTextEditor.LinkPopover.Actions>
                    <RichTextEditor.LinkPopover.UnsetButton />
                    <RichTextEditor.LinkPopover.ApplyButton />
                  </RichTextEditor.LinkPopover.Actions>
                </RichTextEditor.LinkPopover.Content>
              </RichTextEditor.LinkPopover>
            </RichTextEditor.ToolbarGroup>

            <RichTextEditor.ToolbarGroup>
              <RichTextEditor.CommandButton
                aria-label="Superscript"
                tooltip="Superscript"
                isActive={editor => editor.isActive("superscript")}
                onCommand={editor => editor.chain().focus().toggleSuperscript().run()}>
                <SuperscriptIcon className={iconClassName} />
              </RichTextEditor.CommandButton>
              <RichTextEditor.CommandButton
                aria-label="Subscript"
                tooltip="Subscript"
                isActive={editor => editor.isActive("subscript")}
                onCommand={editor => editor.chain().focus().toggleSubscript().run()}>
                <SubscriptIcon className={iconClassName} />
              </RichTextEditor.CommandButton>
            </RichTextEditor.ToolbarGroup>

            <RichTextEditor.ToolbarGroup>
              <RichTextEditor.CommandButton
                aria-label="Align left"
                tooltip="Align left"
                isActive={editor => editor.isActive({textAlign: "left"})}
                onCommand={editor => editor.chain().focus().setTextAlign("left").run()}>
                <AlignLeftIcon className={iconClassName} />
              </RichTextEditor.CommandButton>
              <RichTextEditor.CommandButton
                aria-label="Align center"
                tooltip="Align center"
                isActive={editor => editor.isActive({textAlign: "center"})}
                onCommand={editor => editor.chain().focus().setTextAlign("center").run()}>
                <AlignCenterIcon className={iconClassName} />
              </RichTextEditor.CommandButton>
              <RichTextEditor.CommandButton
                aria-label="Align right"
                tooltip="Align right"
                isActive={editor => editor.isActive({textAlign: "right"})}
                onCommand={editor => editor.chain().focus().setTextAlign("right").run()}>
                <AlignRightIcon className={iconClassName} />
              </RichTextEditor.CommandButton>
              <RichTextEditor.CommandButton
                aria-label="Justify"
                tooltip="Justify"
                isActive={editor => editor.isActive({textAlign: "justify"})}
                onCommand={editor => editor.chain().focus().setTextAlign("justify").run()}>
                <AlignJustifyIcon className={iconClassName} />
              </RichTextEditor.CommandButton>
            </RichTextEditor.ToolbarGroup>

            <RichTextEditor.ToolbarGroup>
              <RichTextEditor.CommandButton
                aria-label="Insert image or audio"
                tooltip="Insert image / audio"
                onCommand={editor => editor.chain().focus().setImageUploadNode().run()}>
                <ImageIcon className={iconClassName} />
              </RichTextEditor.CommandButton>
              <TableGridPicker />
            </RichTextEditor.ToolbarGroup>
          </RichTextEditor.Toolbar>
        )}

        {editable ? (
          <TableContextMenu>
            <RichTextEditor.Content className="min-h-[200px]" />
          </TableContextMenu>
        ) : (
          <RichTextEditor.Content className="min-h-[200px]" />
        )}

        {editable && (
          <RichTextEditor.BubbleMenu>
            <RichTextEditor.ToggleButton command="bold" tooltip="Bold">
              <BoldIcon className={iconClassName} />
            </RichTextEditor.ToggleButton>
            <RichTextEditor.ToggleButton command="italic" tooltip="Italic">
              <ItalicIcon className={iconClassName} />
            </RichTextEditor.ToggleButton>
            <RichTextEditor.ToggleButton command="underline" tooltip="Underline">
              <UnderlineIcon className={iconClassName} />
            </RichTextEditor.ToggleButton>
            <RichTextEditor.ToggleButton command="strike" tooltip="Strikethrough">
              <StrikethroughIcon className={iconClassName} />
            </RichTextEditor.ToggleButton>
          </RichTextEditor.BubbleMenu>
        )}
      </RichTextEditor.Shell>
    </RichTextEditor>
  );
}

// Google Docs' table picker: hover over a grid to choose the size, click to insert. It starts at
// 5 × 5 and grows (up to 20 × 20) as the pointer nears its edge.
const GRID_MIN = 5;
const GRID_MAX = 20;

function TableGridPicker() {
  const {editor} = useRichTextEditor();
  const [isOpen, setIsOpen] = useState(false);
  const [hover, setHover] = useState({rows: 0, cols: 0});
  const rows = Math.min(GRID_MAX, Math.max(GRID_MIN, hover.rows + 1));
  const cols = Math.min(GRID_MAX, Math.max(GRID_MIN, hover.cols + 1));
  const insert = (r: number, c: number) => {
    // Like Docs, a new table has no header row (one can be added from its right-click menu).
    editor?.chain().focus().insertTable({rows: r, cols: c, withHeaderRow: false}).run();
    setIsOpen(false);
  };
  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={open => {
        setIsOpen(open);
        if (!open) setHover({rows: 0, cols: 0});
      }}>
      <Button
        isIconOnly
        size="sm"
        variant="tertiary"
        className="rich-text-editor__toolbar-button"
        aria-label="Insert table">
        <TableIcon className={iconClassName} />
      </Button>
      <Popover.Content placement="bottom start">
        <Popover.Dialog aria-label="Insert table" className="flex flex-col gap-2 p-3">
          <div
            role="grid"
            aria-label="Table size"
            className="grid gap-0.5"
            style={{gridTemplateColumns: `repeat(${cols}, 1rem)`}}
            onPointerLeave={() => setHover({rows: 0, cols: 0})}>
            {Array.from({length: rows * cols}, (_, i) => {
              const r = Math.floor(i / cols) + 1;
              const c = (i % cols) + 1;
              const isOn = r <= hover.rows && c <= hover.cols;
              return (
                <button
                  // oxlint-disable-next-line react/no-array-index-key -- grid squares are positional.
                  key={i}
                  type="button"
                  aria-label={`${r} by ${c} table`}
                  className={
                    isOn
                      ? "border-accent bg-accent-soft size-4 border"
                      : "border-separator size-4 border"
                  }
                  onPointerEnter={() => setHover({rows: r, cols: c})}
                  onFocus={() => setHover({rows: r, cols: c})}
                  onClick={() => insert(r, c)}
                />
              );
            })}
          </div>
          <span className="text-muted text-center text-xs tabular-nums">
            {hover.rows > 0 ? `${hover.cols} x ${hover.rows}` : "Insert table"}
          </span>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

const isMac = typeof navigator !== "undefined" && /Mac|iP(hone|ad)/.test(navigator.platform);

function Shortcut({char}: {char: string}) {
  return (
    <Kbd className="ms-auto" slot="keyboard" variant="light">
      <Kbd.Abbr keyValue={isMac ? "command" : "ctrl"} />
      <Kbd.Content>{char}</Kbd.Content>
    </Kbd>
  );
}

/**
 * Google Docs' table menu: right-click a cell for cut / copy / paste, inserting and deleting rows
 * and columns, deleting the table, and merging or unmerging cells. Outside tables, the browser's
 * own menu shows as usual.
 */
function TableContextMenu({children}: {children: React.ReactNode}) {
  const {editor} = useRichTextEditor();
  const [isOpen, setIsOpen] = useState(false);
  const [can, setCan] = useState({merge: false, unmerge: false, hasHeaderRow: false});

  const onContextMenuCapture = (e: React.MouseEvent) => {
    const cell = e.target instanceof Element ? e.target.closest("td, th") : null;
    if (!editor || !cell) {
      // Not in a table: keep the browser's menu by not letting the event reach the trigger.
      e.stopPropagation();
      return;
    }
    // Like Docs, right-clicking outside the current cell selection moves the cursor there first.
    const {selection} = editor.state;
    const pos = editor.view.posAtCoords({left: e.clientX, top: e.clientY})?.pos;
    const inSelection =
      selection instanceof CellSelection
        ? cell.classList.contains("selectedCell")
        : pos !== undefined && pos >= selection.from && pos <= selection.to;
    if (pos !== undefined && !inSelection) editor.commands.setTextSelection(pos);
    setCan({
      merge: editor.can().mergeCells(),
      unmerge: editor.can().splitCell(),
      hasHeaderRow: tableHasHeaderRow(editor),
    });
  };

  const run = (command: (chain: ChainedCommands) => ChainedCommands) => {
    if (editor) command(editor.chain().focus()).run();
  };
  const onAction = async (key: React.Key) => {
    if (!editor) return;
    switch (key) {
      case "cut":
      case "copy":
        editor.commands.focus();
        document.execCommand(key);
        return;
      case "paste":
        await pasteFromClipboard(editor);
        return;
      case "row-above":
        return run(c => c.addRowBefore());
      case "row-below":
        return run(c => c.addRowAfter());
      case "col-left":
        return run(c => c.addColumnBefore());
      case "col-right":
        return run(c => c.addColumnAfter());
      case "delete-row":
        return run(c => c.deleteRow());
      case "delete-col":
        return run(c => c.deleteColumn());
      case "delete-table":
        return run(c => c.deleteTable());
      case "merge":
        return run(c => c.mergeCells());
      case "unmerge":
        return run(c => c.splitCell());
      case "header-row":
        return run(c => c.toggleHeaderRow());
    }
  };

  return (
    <div onContextMenuCapture={onContextMenuCapture} className="contents">
      <ContextMenu open={isOpen} onOpenChange={setIsOpen}>
        <ContextMenu.Trigger className="block">{children}</ContextMenu.Trigger>
        <ContextMenu.Popover>
          <ContextMenu.Menu aria-label="Table" onAction={key => void onAction(key)}>
            <ContextMenu.Section>
              <ContextMenu.Item id="cut" textValue="Cut">
                <Label>Cut</Label>
                <Shortcut char="X" />
              </ContextMenu.Item>
              <ContextMenu.Item id="copy" textValue="Copy">
                <Label>Copy</Label>
                <Shortcut char="C" />
              </ContextMenu.Item>
              <ContextMenu.Item id="paste" textValue="Paste">
                <Label>Paste</Label>
                <Shortcut char="V" />
              </ContextMenu.Item>
            </ContextMenu.Section>
            <ContextMenu.Separator />
            <ContextMenu.Section>
              <ContextMenu.Item id="row-above" textValue="Insert row above">
                <Label>Insert row above</Label>
              </ContextMenu.Item>
              <ContextMenu.Item id="row-below" textValue="Insert row below">
                <Label>Insert row below</Label>
              </ContextMenu.Item>
              <ContextMenu.Item id="col-left" textValue="Insert column left">
                <Label>Insert column left</Label>
              </ContextMenu.Item>
              <ContextMenu.Item id="col-right" textValue="Insert column right">
                <Label>Insert column right</Label>
              </ContextMenu.Item>
            </ContextMenu.Section>
            <ContextMenu.Separator />
            <ContextMenu.Section>
              <ContextMenu.Item id="delete-row" textValue="Delete row">
                <Label>Delete row</Label>
              </ContextMenu.Item>
              <ContextMenu.Item id="delete-col" textValue="Delete column">
                <Label>Delete column</Label>
              </ContextMenu.Item>
              <ContextMenu.Item id="delete-table" textValue="Delete table">
                <Label>Delete table</Label>
              </ContextMenu.Item>
            </ContextMenu.Section>
            <ContextMenu.Separator />
            <ContextMenu.Section>
              {can.merge && (
                <ContextMenu.Item id="merge" textValue="Merge cells">
                  <Label>Merge cells</Label>
                </ContextMenu.Item>
              )}
              {can.unmerge && (
                <ContextMenu.Item id="unmerge" textValue="Unmerge cells">
                  <Label>Unmerge cells</Label>
                </ContextMenu.Item>
              )}
              <ContextMenu.Item
                id="header-row"
                textValue={can.hasHeaderRow ? "Unpin header row" : "Pin header row"}>
                <Label>{can.hasHeaderRow ? "Unpin header row" : "Pin header row"}</Label>
              </ContextMenu.Item>
            </ContextMenu.Section>
          </ContextMenu.Menu>
        </ContextMenu.Popover>
      </ContextMenu>
    </div>
  );
}

async function pasteFromClipboard(editor: Editor) {
  try {
    const text = await navigator.clipboard.readText();
    editor.chain().focus().insertContent(text).run();
  } catch {
    // Browsers may refuse clipboard reads from a menu; the keyboard shortcut always works.
    toast(`Use ${isMac ? "⌘" : "Ctrl"}+V to paste`);
  }
}

/** Whether the table around the cursor has its first row as header cells. */
function tableHasHeaderRow(editor: Editor) {
  const {$from} = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === "table") {
      return node.firstChild?.firstChild?.type.name === "tableHeader";
    }
  }
  return false;
}
