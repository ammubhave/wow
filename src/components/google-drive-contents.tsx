import {DrivePicker, DrivePickerDocsView} from "@googleworkspace/drive-picker-react";
import {Stepper} from "@heroui-pro/react";
import {Button, Card, Link, Skeleton} from "@heroui/react";
import {useMutation, useQuery} from "@tanstack/react-query";
import {useHydrated} from "@tanstack/react-router";
import {UsersIcon} from "lucide-react";
import {useState} from "react";
import {toast} from "sonner";

import {startOAuthFlow} from "@/lib/oauth-state";
import {orpc} from "@/lib/orpc";

export function GoogleDriveCardContents({
  workspaceSlug,
  redirectUrl,
  isDisabled = false,
}: {
  workspaceSlug: string;
  redirectUrl: string;
  /** Shows the connection without letting you change it (for members who aren't owners). */
  isDisabled?: boolean;
}) {
  const [openPicker, setOpenPicker] = useState<"folder" | "file" | null>(null);
  // Queries are invalidated after every successful mutation by the global MutationCache (router.tsx).
  const folderMutation = useMutation(orpc.workspaces.setGoogleFolderId.mutationOptions());
  const fileMutation = useMutation(orpc.workspaces.setGoogleTemplateFileId.mutationOptions());
  const handleOpenFolderPicker = () => setOpenPicker("folder");
  const handleOpenFilePicker = () => setOpenPicker("file");

  const state = useQuery(
    orpc.workspaces.getGoogleTokenState.queryOptions({input: {workspaceSlug}})
  );

  return (
    <>
      {openPicker && (
        <DrivePicker
          client-id={import.meta.env.VITE_GOOGLE_API_CLIENT_ID}
          developer-key={import.meta.env.VITE_GOOGLE_API_KEY}
          app-id="933519172272"
          onPicked={event => {
            setOpenPicker(null);
            const id = event.detail.docs[0]?.id;
            if (!id) return;
            toast.promise(
              openPicker === "folder"
                ? folderMutation.mutateAsync({workspaceSlug, folderId: id})
                : fileMutation.mutateAsync({workspaceSlug, fileId: id}),
              openPicker === "folder"
                ? {
                    loading: "Selecting folder...",
                    success: "Success! The folder has been selected.",
                    error: "Oops! Something went wrong.",
                  }
                : {
                    loading: "Selecting template file...",
                    success: "Success! The template file has been selected.",
                    error: "Oops! Something went wrong.",
                  }
            );
          }}
          onCanceled={() => setOpenPicker(null)}
          onOauthError={() => {
            setOpenPicker(null);
            toast.error("Couldn't connect to Google Drive. Please try again.");
          }}>
          {openPicker === "folder" ? (
            <DrivePickerDocsView
              view-id="FOLDERS"
              include-folders="true"
              select-folder-enabled="true"
            />
          ) : (
            <DrivePickerDocsView view-id="SPREADSHEETS" include-folders="true" />
          )}
        </DrivePicker>
      )}
      <Card.Header>
        <Card.Title>Google Drive Connection</Card.Title>
        <Card.Description>
          Optional. Without Google Drive, every puzzle gets a built-in spreadsheet. Connect your
          Google Drive account to use Google Sheets instead: a new sheet is created for each new
          puzzle.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        {state.data ? (
          // The steps are done in order: state 0 = not connected, 1 = connected, 2 = folder chosen,
          // 3 = template chosen (all done).
          <Stepper currentStep={state.data.state} orientation="vertical">
            <Stepper.Step>
              <Stepper.Indicator />
              <Stepper.Content className="flex-1">
                <Stepper.Title>Connect with Google</Stepper.Title>
                <Stepper.Description>
                  {state.data.state >= 1
                    ? "You're successfully connected to Google."
                    : "You need to connect your Google account."}
                </Stepper.Description>
              </Stepper.Content>
              <ConnectToGoogleForm workspaceSlug={workspaceSlug} redirectUrl={redirectUrl}>
                {state.data.state >= 1 ? (
                  <Button variant="secondary" type="submit" isDisabled={isDisabled}>
                    Reconnect
                  </Button>
                ) : (
                  <Button type="submit" isDisabled={isDisabled}>
                    Connect
                  </Button>
                )}
              </ConnectToGoogleForm>
              <Stepper.Separator />
            </Stepper.Step>
            <Stepper.Step>
              <Stepper.Indicator />
              <Stepper.Content className="flex-1">
                <Stepper.Title>Select Google Drive Folder</Stepper.Title>
                <Stepper.Description>
                  {"folderLink" in state.data ? (
                    <>
                      Folder:{" "}
                      <Link href={state.data.folderLink} target="_blank" rel="noopener noreferrer">
                        {state.data.folderName}
                        <Link.Icon />
                      </Link>
                    </>
                  ) : (
                    "Choose the folder to put all your puzzles in."
                  )}
                </Stepper.Description>
              </Stepper.Content>
              <Button
                isDisabled={isDisabled || state.data.state < 1}
                variant={state.data.state === 1 ? "primary" : "secondary"}
                onPress={handleOpenFolderPicker}>
                {state.data.state >= 2 ? "Reselect Folder" : "Select Folder"}
              </Button>
              <Stepper.Separator />
            </Stepper.Step>
            <Stepper.Step>
              <Stepper.Indicator />
              <Stepper.Content className="flex-1">
                <Stepper.Title>Select Template File</Stepper.Title>
                <Stepper.Description>
                  {"fileLink" in state.data ? (
                    <>
                      File:{" "}
                      <Link href={state.data.fileLink} target="_blank" rel="noopener noreferrer">
                        {state.data.fileName}
                        <Link.Icon />
                      </Link>
                    </>
                  ) : (
                    "Select the template file to use for new puzzles."
                  )}
                </Stepper.Description>
              </Stepper.Content>
              <Button
                isDisabled={isDisabled || state.data.state < 2}
                variant={state.data.state === 2 ? "primary" : "secondary"}
                onPress={handleOpenFilePicker}>
                {state.data.state >= 3 ? "Reselect File" : "Select File"}
              </Button>
            </Stepper.Step>
          </Stepper>
        ) : (
          <Skeleton className="h-[165.5px] w-full" />
        )}
        {state.data && state.data.state >= 2 && !isDisabled && (
          <ShareWithMembers workspaceSlug={workspaceSlug} />
        )}
      </Card.Content>
    </>
  );
}

function ConnectToGoogleForm({
  workspaceSlug,
  redirectUrl,
  children,
}: {
  workspaceSlug: string;
  redirectUrl: string;
  children: React.ReactNode;
}) {
  const hydrated = useHydrated();
  return (
    <form
      method="GET"
      action="https://accounts.google.com/o/oauth2/v2/auth"
      // Bind the flow to this browser (see oauth-state.ts): the nonce goes in both the state and a
      // cookie, and the callback only accepts the code when they match.
      onSubmit={event => {
        const state = event.currentTarget.elements.namedItem("state");
        if (!(state instanceof HTMLInputElement)) return;
        state.value = new URLSearchParams({
          redirectUrl,
          workspaceSlug,
          nonce: startOAuthFlow(),
        }).toString();
      }}>
      <input type="hidden" name="client_id" value={import.meta.env.VITE_GOOGLE_API_CLIENT_ID} />
      <input
        type="hidden"
        name="redirect_uri"
        value={hydrated ? `${window.location.origin}/api/oauth/google` : ""}
      />
      <input type="hidden" name="scope" value="https://www.googleapis.com/auth/drive.file" />
      <input type="hidden" name="response_type" value="code" />
      <input type="hidden" name="access_type" value="offline" />
      <input type="hidden" name="prompt" value="consent" />
      <input
        type="hidden"
        name="state"
        value={new URLSearchParams({redirectUrl, workspaceSlug}).toString()}
      />
      <input type="hidden" name="include_granted_scopes" value="false" />
      {children}
    </form>
  );
}

/**
 * Shares the folder with every member again. Members get the folder when they join, but that can
 * fail (a file added to the folder outside WOW, or an expired Google connection), and people who
 * joined before the folder was chosen never got it.
 */
function ShareWithMembers({workspaceSlug}: {workspaceSlug: string}) {
  const share = useMutation(orpc.workspaces.shareGoogleDriveFolderWithMembers.mutationOptions());
  const result = share.data;
  return (
    <div className="border-separator mt-4 flex flex-col gap-2 border-t pt-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted text-sm">
          Everyone gets edit access to the folder when they join. If a teammate can&apos;t open the
          sheets, share the folder with everyone again.
        </p>
        <Button
          variant="secondary"
          className="shrink-0"
          isPending={share.isPending}
          onPress={() =>
            share.mutate(
              {workspaceSlug},
              {onError: error => toast.error(error.message || "Couldn't share the folder.")}
            )
          }>
          <UsersIcon />
          Share with everyone
        </Button>
      </div>
      {result && (
        <output className="block text-sm">
          {result.blocked ? (
            <p className="text-danger">
              {result.blocked.detail}{" "}
              {result.blocked.blockingFileId && (
                <Link
                  href={`https://drive.google.com/open?id=${encodeURIComponent(result.blocked.blockingFileId)}`}
                  target="_blank"
                  rel="noopener noreferrer">
                  Open the file
                  <Link.Icon />
                </Link>
              )}
            </p>
          ) : (
            <p>
              Shared with {result.shared} {result.shared === 1 ? "member" : "members"}.
            </p>
          )}
          {result.failed.length > 0 && (
            <ul className="text-danger mt-1 flex flex-col gap-1">
              {result.failed.map(member => (
                <li key={member.email}>
                  {member.name} ({member.email}): {member.detail}
                </li>
              ))}
            </ul>
          )}
        </output>
      )}
    </div>
  );
}
