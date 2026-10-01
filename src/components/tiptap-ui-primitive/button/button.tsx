import {cn} from "tailwind-variants";

// oxlint-disable-next-line import/no-unassigned-import -- side-effect stylesheet import.
import "@/components/tiptap-ui-primitive/button/button-colors.scss";
// oxlint-disable-next-line import/no-unassigned-import -- side-effect stylesheet import.
import "@/components/tiptap-ui-primitive/button/button.scss";

/**
 * Plain `<button>` styled like Tiptap's UI primitive. Used inside Tiptap node views (e.g. the image
 * upload node), where native click semantics are needed so `stopPropagation()` keeps the press from
 * reaching the node view's own click handler.
 */
export function Button({className, ...props}: React.ComponentProps<"button">) {
  return <button type="button" className={cn("tiptap-button", className)} {...props} />;
}
