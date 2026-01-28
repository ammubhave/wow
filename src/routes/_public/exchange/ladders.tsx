import {createFileRoute} from "@tanstack/react-router";

export const Route = createFileRoute("/_public/exchange/ladders")({component: RouteComponent});

function RouteComponent() {
  return <div>Hello "/_public/exchange/ladders"!</div>;
}
