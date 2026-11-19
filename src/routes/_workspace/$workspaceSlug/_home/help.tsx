import {createFileRoute, Outlet} from "@tanstack/react-router";

/**
 * The docs inside a workspace (the header's Help tab): the same pages as /docs, so teammates can
 * read them without leaving the hunt. See src/docs.
 */
export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/help")({component: Outlet});
