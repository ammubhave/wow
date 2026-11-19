import {createFileRoute, Outlet} from "@tanstack/react-router";

/** The public docs (/docs/…): see src/docs. Pages come from the registry, not one route each. */
export const Route = createFileRoute("/_public/docs")({component: Outlet});
