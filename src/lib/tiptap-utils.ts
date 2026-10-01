import {Selection, TextSelection} from "@tiptap/pm/state";
import type {Editor} from "@tiptap/react";

import {client} from "./orpc";

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Moves the focus to the next node in the editor
 * @param editor - The editor instance
 * @returns boolean indicating if the focus was moved
 */
export function focusNextNode(editor: Editor) {
  const {state, view} = editor;
  const {doc, selection} = state;

  const nextSel = Selection.findFrom(selection.$to, 1, true);
  if (nextSel) {
    view.dispatch(state.tr.setSelection(nextSel).scrollIntoView());
    return true;
  }

  const paragraphType = state.schema.nodes.paragraph;
  if (!paragraphType) {
    console.warn("No paragraph node type found in schema.");
    return false;
  }

  const end = doc.content.size;
  const para = paragraphType.create();
  let tr = state.tr.insert(end, para);

  // Place the selection inside the new paragraph
  const $inside = tr.doc.resolve(end + 1);
  tr = tr.setSelection(TextSelection.near($inside)).scrollIntoView();
  view.dispatch(tr);
  return true;
}

/**
 * Checks if a value is a valid number (not null, undefined, or NaN)
 * @param value - The value to check
 * @returns boolean indicating if the value is a valid number
 */
export function isValidPosition(pos: number | null | undefined): pos is number {
  return typeof pos === "number" && pos >= 0;
}

/**
 * Handles image upload with progress tracking and abort capability
 * @param file The file to upload
 * @param onProgress Optional callback for tracking upload progress
 * @param abortSignal Optional AbortSignal for cancelling the upload
 * @returns Promise resolving to the URL of the uploaded image
 */
export const handleImageUpload = async (
  huntPuzzleId: string,
  file: File,
  onProgress?: (event: {progress: number}) => void,
  abortSignal?: AbortSignal
): Promise<string> => {
  // Validate file
  if (!file) {
    throw new Error("No file provided");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum allowed (${MAX_FILE_SIZE / (1024 * 1024)}MB)`);
  }

  const result = await client.exchange.puzzles.assets.upload(
    {huntPuzzleId, asset: file},
    {signal: abortSignal}
  );
  onProgress?.({progress: 100});
  return result.url;
};
