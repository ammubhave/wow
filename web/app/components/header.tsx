import { ArrowLongLeftIcon } from "@heroicons/react/24/solid";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { ExternalLinkIcon, PersonIcon } from "@radix-ui/react-icons";
import { Link, useLocation } from "@remix-run/react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { usePuzzle } from "@/lib/usePuzzle";

import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

export function Header() {
  const { user, logout } = useKindeAuth();
  const { pathname } = useLocation();
  const pathnames = pathname.split("/");
  const workspaceId = pathnames[1] === "wow" ? pathnames[2] : undefined;

  const workspaceQuery = trpc.workspaces.get.useQuery(workspaceId!, {
    enabled:
      pathnames[1] === "wow" &&
      pathnames[2] !== "create" &&
      pathnames[2] !== undefined,
  });
  const puzzleNameQuery = usePuzzle(
    { workspaceId: workspaceId!, puzzleId: pathnames[4] },
    {
      enabled: pathnames[3] === "puzzles",
    },
  );

  const shareGoogleDriveFolderMutation =
    trpc.workspaces.shareGoogleDriveFolder.useMutation();

  return (
    <header className="bg-background sticky top-0 z-10 flex h-16 items-center gap-4 border-b px-4 md:px-6 justify-between">
      <nav className="flex flex-row items-center gap-1 sm:gap-5 text-lg font-medium md:text-sm lg:gap-6">
        <Button variant="ghost" asChild>
          <Link
            to="/wow"
            className="flex items-center gap-2 text-lg font-semibold md:text-base flex-shrink-0"
          >
            <img src="/favicon.ico" className="size-6 rounded-full" />
          </Link>
        </Button>
        <div className="contents flex-1 text-lg font-semibold">
          {pathnames.length === 3 && pathnames[1] === "wow" ? (
            <span className="font-semi-bold text-lg">Blackboard</span>
          ) : !workspaceId ||
            pathnames.length === 3 ||
            pathnames[2] === "create" ? (
            <span className="font-semi-bold text-lg">WOW</span>
          ) : (
            <Button
              asChild
              variant={"ghost"}
              className="flex items-center justify-center gap-2 text-sm font-semibold leading-6 text-gray-900"
            >
              <Link to={`/wow/${workspaceId}`}>
                <ArrowLongLeftIcon className="size-6" />
                <span className="hidden sm:inline">Back to blackboard</span>
              </Link>
            </Button>
          )}

          {puzzleNameQuery.isLoading ? (
            <Skeleton className="h-6 w-[250px]" />
          ) : (
            puzzleNameQuery.data?.name
          )}
        </div>
      </nav>
      <div className="flex items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <div className="ml-auto flex-1 sm:flex-initial" />
        <div className="hidden sm:block">
          {workspaceQuery.isLoading ? (
            <Skeleton className="h-6 w-[250px]" />
          ) : (
            workspaceQuery.data && (
              <>
                {workspaceQuery.data.links.map((link) => (
                  <Button key={link.id} variant="ghost" asChild>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="gap-2"
                    >
                      {link.name} <ExternalLinkIcon className="size-4" />
                    </a>
                  </Button>
                ))}
                <Button variant="ghost" asChild>
                  <Link
                    to={`/wow/${workspaceQuery.data.id}/settings`}
                    className="gap-1"
                  >
                    {workspaceQuery.data.teamName}{" "}
                    <span className="text-muted-foreground text-sm font-normal">
                      • {workspaceQuery.data.eventName}
                    </span>
                  </Link>
                </Button>
              </>
            )
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" className="rounded-lg">
              <PersonIcon className="mr-2 size-4" />
              {user?.given_name}
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {workspaceQuery.data && (
              <>
                {workspaceQuery.data.links.map((link) => (
                  <DropdownMenuItem key={link.id} asChild>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="gap-2 justify-between"
                    >
                      {link.name} <ExternalLinkIcon className="size-4" />
                    </a>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem asChild>
                  <Link
                    to={`/wow/${workspaceQuery.data.id}/settings`}
                    className="gap-1"
                  >
                    Workspace settings
                  </Link>
                </DropdownMenuItem>
              </>
            )}

            {workspaceId &&
              user?.email &&
              !workspaceQuery.data?.isOnboarding && (
                <DropdownMenuItem
                  onClick={() => {
                    toast.promise(
                      shareGoogleDriveFolderMutation.mutateAsync({
                        workspaceId: workspaceId,
                        email: user.email!,
                      }),
                      {
                        loading: "Sharing Google Drive folder...",
                        success:
                          "Success! Google Drive folder has been shared.",
                        error: "Oops! Something went wrong.",
                      },
                    );
                  }}
                >
                  Share Google Drive Folder
                </DropdownMenuItem>
              )}
            <DropdownMenuItem onClick={() => logout()}>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
