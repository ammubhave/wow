import {useQuery} from "@tanstack/react-query";
import {CheckIcon, XIcon} from "lucide-react";

import {Button} from "@/components/ui/button";
import {CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Skeleton} from "@/components/ui/skeleton";
import {orpc} from "@/lib/orpc";

function DiscordForm({
  children,
  redirectUrl,
  workspaceId,
}: {
  children: React.ReactNode;
  redirectUrl: string;
  workspaceId: string;
}) {
  return (
    <form method="GET" action="https://discord.com/oauth2/authorize">
      <input type="hidden" name="client_id" value={import.meta.env.VITE_DISCORD_CLIENT_ID} />
      <input type="hidden" name="permissions" value="1040" />
      <input type="hidden" name="response_type" value="code" />
      <input
        type="hidden"
        name="redirect_uri"
        value={`${typeof window !== "undefined" ? window.location.origin : ""}/api/oauth/discord`}
      />
      <input type="hidden" name="integration_type" value="0" />
      <input type="hidden" name="scope" value="bot" />
      <input
        type="hidden"
        name="state"
        value={new URLSearchParams({redirectUrl, workspaceId}).toString()}
      />
      {children}
    </form>
  );
}

export function DiscordCardContents({
  workspaceId,
  redirectUrl,
}: {
  workspaceId: string;
  redirectUrl: string;
}) {
  const discordInfo = useQuery(orpc.workspaces.getDiscordInfo.queryOptions({input: workspaceId}));
  return (
    <>
      <CardHeader className="px-7">
        <CardTitle>Discord</CardTitle>
        <CardDescription>
          You can connect your Discord account to this workspace. This allows the workspace to
          automatically create voice channels whenever you create a new puzzle.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!discordInfo.isLoading ? (
          discordInfo.data?.ok !== undefined ? (
            <div className="pb-8">
              <div className="group relative flex items-start">
                <span className="flex h-9 items-center">
                  {discordInfo.data.ok ? (
                    <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600">
                      <CheckIcon aria-hidden="true" className="h-5 w-5 text-white" />
                    </span>
                  ) : (
                    <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-red-600">
                      <XIcon aria-hidden="true" className="h-5 w-5 text-white" />
                    </span>
                  )}
                </span>
                <div className="flex pl-4 flex-1 flex-col sm:flex-row gap-2 justify-between">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium">
                      {discordInfo.data.ok
                        ? "You're successfully connected to Discord."
                        : "There is a problem with your Discord connection."}
                    </span>
                    <span className="text-sm text-gray-500">
                      {discordInfo.data.ok ? (
                        <>
                          Server Name:{" "}
                          <Button variant="secondary" className="h-auto px-2 py-0" asChild>
                            <a
                              href={`https://discord.com/channels/${discordInfo.data.data.id}`}
                              target="_blank"
                              rel="noopener noreferrer">
                              {discordInfo.data.data.name}
                            </a>
                          </Button>
                        </>
                      ) : (
                        <span className="text-sm text-red-500">{discordInfo.data.error}</span>
                      )}
                    </span>
                  </span>{" "}
                  <DiscordForm redirectUrl={redirectUrl} workspaceId={workspaceId}>
                    <Button type="submit" variant="secondary" className="gap-2">
                      {/* <DiscordLogoIcon className="size-5" /> */}
                      Reconnect with Discord
                    </Button>
                  </DiscordForm>
                </div>
              </div>
            </div>
          ) : (
            <div className="pb-8">
              <div className="group relative flex items-start">
                <span aria-hidden="true" className="flex h-9 items-center">
                  <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-indigo-600 bg-white">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                  </span>
                </span>
                <div className="pl-4 flex flex-1 flex-col sm:flex-row gap-2 justify-between">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-indigo-600">
                      Connect with Discord
                    </span>
                    <span className="text-sm text-gray-500">
                      You need to connect your Discord account.
                    </span>
                  </span>
                  <DiscordForm redirectUrl={redirectUrl} workspaceId={workspaceId}>
                    <Button type="submit" variant="default" className="gap-2">
                      {/* <DiscordLogoIcon className="size-5" /> */}
                      Connect with Discord
                    </Button>
                  </DiscordForm>
                </div>
              </div>
            </div>
          )
        ) : (
          <Skeleton className="mb-8 h-10 w-full" />
        )}
      </CardContent>
    </>
  );
}
