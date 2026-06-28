import {createFileRoute, Outlet} from "@tanstack/react-router";

export const Route = createFileRoute("/_public/exchange")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Wafflehaüs Puzzle Exchange | WOW"}]}),
});

function RouteComponent() {
  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col">
      <Outlet />
    </div>
  );
}
