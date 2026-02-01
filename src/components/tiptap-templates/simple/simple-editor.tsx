"use client";

import {Audio} from "@tiptap/extension-audio";
import {Highlight} from "@tiptap/extension-highlight";
import {Image} from "@tiptap/extension-image";
import {TaskItem, TaskList} from "@tiptap/extension-list";
import {Subscript} from "@tiptap/extension-subscript";
import {Superscript} from "@tiptap/extension-superscript";
import {TextAlign} from "@tiptap/extension-text-align";
import {Typography} from "@tiptap/extension-typography";
import {Selection} from "@tiptap/extensions";
import {EditorContent, EditorContext, JSONContent, useEditor} from "@tiptap/react";
// --- Tiptap Core Extensions ---
import {StarterKit} from "@tiptap/starter-kit";
import {useRef} from "react";
// --- Icons ---

import {HorizontalRule} from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension";
// --- Tiptap Node ---
import {ImageUploadNode} from "@/components/tiptap-node/image-upload-node/image-upload-node-extension";
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss";
import "@/components/tiptap-node/code-block-node/code-block-node.scss";
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss";
import "@/components/tiptap-node/list-node/list-node.scss";
import "@/components/tiptap-node/image-node/image-node.scss";
import "@/components/tiptap-node/heading-node/heading-node.scss";
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss";
// --- UI Primitives ---
import {Spacer} from "@/components/tiptap-ui-primitive/spacer";
import {Toolbar, ToolbarGroup, ToolbarSeparator} from "@/components/tiptap-ui-primitive/toolbar";
import {BlockquoteButton} from "@/components/tiptap-ui/blockquote-button";
import {CodeBlockButton} from "@/components/tiptap-ui/code-block-button";
import {ColorHighlightPopover} from "@/components/tiptap-ui/color-highlight-popover";
// --- Tiptap UI ---
import {HeadingDropdownMenu} from "@/components/tiptap-ui/heading-dropdown-menu";
import {ImageUploadButton} from "@/components/tiptap-ui/image-upload-button";
import {LinkPopover} from "@/components/tiptap-ui/link-popover";
import {ListDropdownMenu} from "@/components/tiptap-ui/list-dropdown-menu";
import {MarkButton} from "@/components/tiptap-ui/mark-button";
import {TextAlignButton} from "@/components/tiptap-ui/text-align-button";
import {UndoRedoButton} from "@/components/tiptap-ui/undo-redo-button";
// --- Styles ---
import "@/components/tiptap-templates/simple/simple-editor.scss";
// --- Lib ---
import {handleImageUpload, MAX_FILE_SIZE} from "@/lib/tiptap-utils";

const MainToolbarContent = () => {
  return (
    <>
      <Spacer />

      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HeadingDropdownMenu levels={[1, 2, 3, 4]} />
        <ListDropdownMenu types={["bulletList", "orderedList", "taskList"]} />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="code" />
        <MarkButton type="underline" />
        <ColorHighlightPopover />
        <LinkPopover />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="superscript" />
        <MarkButton type="subscript" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <TextAlignButton align="left" />
        <TextAlignButton align="center" />
        <TextAlignButton align="right" />
        <TextAlignButton align="justify" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ImageUploadButton text="Add" />
      </ToolbarGroup>

      <Spacer />
    </>
  );
};

export function SimpleEditor({
  huntPuzzleId,
  defaultValue,
  onChange,
}: {
  huntPuzzleId: string;
  defaultValue?: JSONContent;
  onChange?: (value: JSONContent) => void;
}) {
  const toolbarRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editable: onChange !== undefined,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "Main content area, start typing to enter text.",
        class: "simple-editor",
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        link: {openOnClick: false, enableClickSelection: true},
      }),
      HorizontalRule,
      TextAlign.configure({types: ["heading", "paragraph"]}),
      TaskList,
      TaskItem.configure({nested: true}),
      Highlight.configure({multicolor: true}),
      Image,
      Audio.configure({inline: true}),
      Typography,
      Superscript,
      Subscript,
      Selection,
      ImageUploadNode.configure({
        accept: "image/*,audio/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: (file, onProgress, abortSignal) =>
          handleImageUpload(huntPuzzleId, file, onProgress, abortSignal),
        onError: error => console.error("Upload failed:", error),
      }),
    ],
    content: defaultValue,
    onUpdate: ({editor}) => {
      onChange?.(editor.getJSON());
    },
  });

  return (
    <EditorContext.Provider value={{editor}}>
      {onChange && (
        <Toolbar variant="fixed" ref={toolbarRef} className="sticky top-20">
          <MainToolbarContent />
        </Toolbar>
      )}
      <EditorContent
        editor={editor}
        role="presentation"
        className="min-h-[200px] simple-editor-content"
      />
    </EditorContext.Provider>
  );
}
