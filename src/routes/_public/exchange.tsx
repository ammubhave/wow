import {createFileRoute, Outlet} from "@tanstack/react-router";

export const Route = createFileRoute("/_public/exchange")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Wafflehaüs Puzzle Exchange | WOW"}]}),
});

function RouteComponent() {
  return (
    <div className="max-w-[1000px] mx-auto w-full flex-1 flex flex-col">
      <Outlet />
    </div>
  );
}
