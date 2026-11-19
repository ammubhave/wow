import {createContext, useContext} from "react";

/**
 * Where the docs are being read: the public site (/docs) or a workspace's Help tab
 * (/<workspace>/help). Links between pages resolve against it, so a teammate reading the docs
 * inside their workspace stays there.
 */
export const DocsBaseContext = createContext("/docs");

/** A docs path ("guides/guess-queue", "/docs/guides/guess-queue#statuses") under the current base. */
export function useDocHref() {
  const base = useContext(DocsBaseContext);
  return (path: string) => {
    const rest = path.replace(/^\/?docs\/?/, "").replace(/^\/+/, "");
    return rest ? `${base}/${rest}` : base;
  };
}
