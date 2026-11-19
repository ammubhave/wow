import {createFileRoute} from "@tanstack/react-router";

import {DocsShell} from "@/docs/components/docs-shell";

export const Route = createFileRoute("/_public/docs/")({
  component: () => <DocsShell base="/docs" slug="" />,
  head: () => ({meta: [{title: "Docs | WOW"}]}),
});
