import {Button, buttonVariants, Card, Skeleton} from "@heroui/react";
import {useQuery} from "@tanstack/react-query";
import {useHydrated} from "@tanstack/react-router";
import {CheckIcon, XIcon} from "lucide-react";

import {orpc} from "@/lib/orpc";

import {DisconnectDiscordDialog} from "./disconnect-discord-dialog";

function DiscordForm({
  children,
  redirectUrl,
  workspaceSlug,
}: {
  children: React.ReactNode;
  redirectUrl: string;
  workspaceSlug: string;
}) {
  const hydrated = useHydrated();
  return (
    <form method="GET" action="https://discord.com/oauth2/authorize">
      <input type="hidden" name="client_id" value={import.meta.env.VITE_DISCORD_CLIENT_ID} />
      <input type="hidden" name="permissions" value="1040" />
      <input type="hidden" name="response_type" value="code" />
      <input
        type="hidden"
        name="redirect_uri"
        value={hydrated ? `${window.location.origin}/api/oauth/discord` : ""}
      />
      <input type="hidden" name="integration_type" value="0" />
      <input type="hidden" name="scope" value="bot" />
      <input
        type="hidden"
        name="state"
        value={new URLSearchParams({redirectUrl, workspaceSlug}).toString()}
      />
      {children}
    </form>
  );
}

export function DiscordCardContents({
  workspaceSlug,
  redirectUrl,
}: {
  workspaceSlug: string;
  redirectUrl: string;
}) {
  const discordInfo = useQuery(
    orpc.workspaces.getDiscordInfo.queryOptions({input: {workspaceSlug}})
  );
  return (
    <>
      <Card.Header>
        <Card.Title>Discord</Card.Title>
        <Card.Description>
          You can connect your Discord account to this workspace. This allows the workspace to
          automatically create voice channels whenever you create a new puzzle.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        {!discordInfo.isLoading ? (
          discordInfo.data?.ok !== undefined ? (
            <div>
              <div className="group relative flex items-start">
                <span className="flex h-8 items-center">
                  {discordInfo.data.ok ? (
                    <span className="bg-primary relative z-10 flex size-7 items-center justify-center rounded-full">
                      <CheckIcon aria-hidden="true" className="size-4 text-white" />
                    </span>
                  ) : (
                    <span className="relative z-10 flex size-7 items-center justify-center rounded-full bg-red-600">
                      <XIcon aria-hidden="true" className="size-4 text-white" />
                    </span>
                  )}
                </span>
                <div className="flex flex-1 flex-col justify-between gap-2 pl-4 sm:flex-row">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-xs font-medium">
                      {discordInfo.data.ok
                        ? "You're successfully connected to Discord."
                        : "There is a problem with your Discord connection."}
                    </span>
                    <span className="text-xs text-gray-500">
                      {discordInfo.data.ok ? (
                        <>
                          Server Name:{" "}
                          <a
                            className={buttonVariants({
                              variant: "secondary",
                              className: "h-auto px-2 py-0",
                            })}
                            href={`https://discord.com/channels/${discordInfo.data?.data?.id}`}
                            target="_blank"
                            rel="noopener noreferrer">
                            {discordInfo.data?.data?.name}
                          </a>
                        </>
                      ) : (
                        <span className="text-xs text-red-500">{discordInfo.data.error}</span>
                      )}
                    </span>
                  </span>
                  <DiscordForm redirectUrl={redirectUrl} workspaceSlug={workspaceSlug}>
                    <Button type="submit" variant="secondary">
                      Reconnect
                    </Button>
                    <DisconnectDiscordDialog workspaceSlug={workspaceSlug}>
                      <Button variant="danger">Disconnect</Button>
                    </DisconnectDiscordDialog>
                  </DiscordForm>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="group relative flex items-start">
                <span aria-hidden="true" className="flex h-8 items-center">
                  <span className="border-primary relative z-10 flex size-7 items-center justify-center rounded-full border-2 bg-white">
                    <span className="bg-primary size-2 rounded-full" />
                  </span>
                </span>
                <div className="flex flex-1 flex-col justify-between gap-2 pl-4 sm:flex-row">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-primary text-xs font-medium">Connect with Discord</span>
                    <span className="text-xs text-gray-500">
                      You need to connect your Discord account.
                    </span>
                  </span>
                  <DiscordForm redirectUrl={redirectUrl} workspaceSlug={workspaceSlug}>
                    <Button type="submit" className="gap-2">
                      Connect with Discord
                    </Button>
                  </DiscordForm>
                </div>
              </div>
            </div>
          )
        ) : (
          <Skeleton className="h-8 w-full" />
        )}
      </Card.Content>
    </>
  );
}
