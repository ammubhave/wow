import {Stepper} from "@heroui-pro/react";
import {Button, Card, Link, Skeleton} from "@heroui/react";
import {useQuery} from "@tanstack/react-query";
import {useHydrated} from "@tanstack/react-router";
import {XIcon} from "lucide-react";

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
    <form method="GET" action="https://discord.com/oauth2/authorize" className="flex gap-2">
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
  isDisabled = false,
}: {
  workspaceSlug: string;
  redirectUrl: string;
  /** Shows the connection without letting you change it (for members who aren't owners). */
  isDisabled?: boolean;
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
          <Stepper
            currentStep={discordInfo.data?.ok ? 1 : 0}
            orientation="vertical"
            // A broken connection shows its step in the danger color.
            className={
              discordInfo.data?.ok === false ? "[--stepper-active-color:var(--color-danger)]" : ""
            }>
            <Stepper.Step>
              {discordInfo.data?.ok === false ? (
                <Stepper.Indicator>
                  <Stepper.Icon>
                    <XIcon />
                  </Stepper.Icon>
                </Stepper.Indicator>
              ) : (
                <Stepper.Indicator />
              )}
              <Stepper.Content className="flex-1">
                <Stepper.Title>Connect with Discord</Stepper.Title>
                <Stepper.Description>
                  {discordInfo.data?.ok === true ? (
                    <>
                      You're successfully connected to Discord. Server Name:{" "}
                      <Link
                        href={`https://discord.com/channels/${discordInfo.data.data?.id}`}
                        target="_blank"
                        rel="noopener noreferrer">
                        {discordInfo.data.data?.name}
                        <Link.Icon />
                      </Link>
                    </>
                  ) : discordInfo.data?.ok === false ? (
                    <span className="text-danger">
                      There is a problem with your Discord connection: {discordInfo.data.error}
                    </span>
                  ) : (
                    "You need to connect your Discord account."
                  )}
                </Stepper.Description>
              </Stepper.Content>
              {discordInfo.data?.ok !== undefined ? (
                <DiscordForm redirectUrl={redirectUrl} workspaceSlug={workspaceSlug}>
                  <Button type="submit" variant="secondary" isDisabled={isDisabled}>
                    Reconnect
                  </Button>
                  <DisconnectDiscordDialog workspaceSlug={workspaceSlug}>
                    <Button variant="danger" isDisabled={isDisabled}>
                      Disconnect
                    </Button>
                  </DisconnectDiscordDialog>
                </DiscordForm>
              ) : (
                <DiscordForm redirectUrl={redirectUrl} workspaceSlug={workspaceSlug}>
                  <Button type="submit" isDisabled={isDisabled}>
                    Connect with Discord
                  </Button>
                </DiscordForm>
              )}
            </Stepper.Step>
          </Stepper>
        ) : (
          <Skeleton className="h-8 w-full" />
        )}
      </Card.Content>
    </>
  );
}
