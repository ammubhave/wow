"use client";

import {RichTextEditor} from "@heroui-pro/react/rich-text-editor";
import type {JSONContent} from "@tiptap/core";
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
import {useMemo} from "react";
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
      <RichTextEditor.Shell>
        {editable && (
          <RichTextEditor.Toolbar aria-label="Formatting" className="sticky top-20 z-10 flex-wrap">
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
              <RichTextEditor.CommandButton
                aria-label="Insert table"
                tooltip="Insert table"
                onCommand={editor =>
                  editor.chain().focus().insertTable({rows: 3, cols: 3, withHeaderRow: true}).run()
                }>
                <TableIcon className={iconClassName} />
              </RichTextEditor.CommandButton>
            </RichTextEditor.ToolbarGroup>
          </RichTextEditor.Toolbar>
        )}

        <RichTextEditor.Content className="min-h-[200px]" />

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
