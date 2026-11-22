import {RadioButtonGroup} from "@heroui-pro/react";
import {Card, Description, Label} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {FileSpreadsheetIcon, HeadphonesIcon, SheetIcon} from "lucide-react";
import {toast} from "sonner";

import {HelpLink} from "@/docs/components/help-link";
import {useWorkspace} from "@/hooks/use-workspace";
import {orpc} from "@/lib/orpc";

import {DiscordSetup} from "./discord-card-contents";
import {GoogleDriveSetup} from "./google-drive-contents";

/**
 * The team's tools, each a choice between WOW's own and an outside service: built-in sheets or
 * Google Sheets, WOW calls or Discord. The built-in one is the default; picking the other shows its
 * setup steps. The choice is only a preference: going back to the built-in one disconnects nothing,
 * so puzzles that already have a Google Sheet or a Discord channel keep it.
 */

type Props = {
  workspaceSlug: string;
  /** Where the OAuth flow comes back to. */
  redirectUrl: string;
  /** Shows the choice without letting you change it (for members who aren't owners). */
  isDisabled?: boolean;
};

type Option = {value: string; title: string; description: string; icon: React.ReactNode};

function ToolChoice({
  title,
  help,
  options,
  value,
  onChange,
  isDisabled,
  children,
}: {
  title: string;
  help: React.ReactNode;
  options: [Option, Option];
  value: string;
  onChange: (value: string) => void;
  isDisabled: boolean;
  /** The outside service's setup, shown while it's picked. */
  children: React.ReactNode;
}) {
  return (
    <>
      <Card.Header>
        <Card.Title>{title}</Card.Title>
        <Card.Description>{help}</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-6">
        <RadioButtonGroup
          aria-label={title}
          layout="grid"
          variant="secondary"
          className="grid-cols-1 sm:grid-cols-2"
          value={value}
          onChange={onChange}
          isDisabled={isDisabled}>
          {options.map(option => (
            <RadioButtonGroup.Item key={option.value} value={option.value}>
              <RadioButtonGroup.Indicator />
              <RadioButtonGroup.ItemContent className="flex-row items-start gap-3">
                <RadioButtonGroup.ItemIcon className="text-muted [&_svg]:size-5">
                  {option.icon}
                </RadioButtonGroup.ItemIcon>
                <div className="flex flex-col gap-0.5 pr-6">
                  <Label>{option.title}</Label>
                  <Description>{option.description}</Description>
                </div>
              </RadioButtonGroup.ItemContent>
            </RadioButtonGroup.Item>
          ))}
        </RadioButtonGroup>
        {value !== options[0].value && children}
      </Card.Content>
    </>
  );
}

/** Saves the team's choice of tools (the workspace broadcast brings it back to everyone). */
function useSetTools(workspaceSlug: string) {
  const mutation = useMutation(orpc.workspaces.setTools.mutationOptions());
  return (tools: {sheetsTool?: "builtin" | "google"; voiceTool?: "builtin" | "discord"}) =>
    mutation.mutate(
      {workspaceSlug, ...tools},
      {onError: () => toast.error("Couldn't save that. Please try again.")}
    );
}

/** Built-in sheets or Google Sheets, for new puzzles. */
export function SpreadsheetChoice({workspaceSlug, redirectUrl, isDisabled = false}: Props) {
  const {sheetsTool} = useWorkspace();
  const setTools = useSetTools(workspaceSlug);
  return (
    <ToolChoice
      title="Puzzle spreadsheets"
      help={<HelpLink slug="google-drive">Which should we use?</HelpLink>}
      options={[
        {
          value: "builtin",
          title: "Built-in sheets",
          description: "A spreadsheet in WOW for every puzzle. Nothing to set up.",
          icon: <SheetIcon />,
        },
        {
          value: "google",
          title: "Google Sheets",
          description: "A Google Sheet in your team's Drive for every puzzle.",
          icon: <FileSpreadsheetIcon />,
        },
      ]}
      value={sheetsTool}
      onChange={value => setTools({sheetsTool: value === "google" ? "google" : "builtin"})}
      isDisabled={isDisabled}>
      <GoogleDriveSetup
        workspaceSlug={workspaceSlug}
        redirectUrl={redirectUrl}
        isDisabled={isDisabled}
      />
    </ToolChoice>
  );
}

/** WOW's own voice calls or Discord voice channels. */
export function VoiceChoice({workspaceSlug, redirectUrl, isDisabled = false}: Props) {
  const {voiceTool} = useWorkspace();
  const setTools = useSetTools(workspaceSlug);
  return (
    <ToolChoice
      title="Voice calls"
      help={<HelpLink slug="discord">Which should we use?</HelpLink>}
      options={[
        {
          value: "builtin",
          title: "WOW calls",
          description: "Voice calls on every puzzle page. Nothing to set up.",
          icon: <HeadphonesIcon />,
        },
        {
          value: "discord",
          title: "Discord",
          description: "A voice channel on your Discord server for every puzzle.",
          icon: <DiscordIcon />,
        },
      ]}
      value={voiceTool}
      onChange={value => setTools({voiceTool: value === "discord" ? "discord" : "builtin"})}
      isDisabled={isDisabled}>
      <DiscordSetup
        workspaceSlug={workspaceSlug}
        redirectUrl={redirectUrl}
        isDisabled={isDisabled}
      />
    </ToolChoice>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.45.87-.61 1.25a18.3 18.3 0 0 0-5.49 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04 19.7 19.7 0 0 0-4.89 1.52.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 0 0-.04-.1 13.1 13.1 0 0 1-1.87-.9.08.08 0 0 1-.01-.13l.37-.29a.07.07 0 0 1 .08-.01c3.93 1.79 8.18 1.79 12.07 0a.07.07 0 0 1 .08.01l.37.29a.08.08 0 0 1-.01.13c-.6.35-1.22.65-1.87.9a.08.08 0 0 0-.04.1c.36.7.77 1.37 1.22 2a.08.08 0 0 0 .08.03 19.8 19.8 0 0 0 6-3.03.08.08 0 0 0 .03-.05c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.15-1.09-2.15-2.42s.95-2.42 2.15-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42Z" />
    </svg>
  );
}
