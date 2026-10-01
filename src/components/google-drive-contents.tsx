import {DrivePicker, DrivePickerDocsView} from "@googleworkspace/drive-picker-react";
import {Button, buttonVariants, Card, Skeleton} from "@heroui/react";
import {useMutation, useQuery} from "@tanstack/react-query";
import {useHydrated} from "@tanstack/react-router";
import {CheckIcon} from "lucide-react";
import {useState} from "react";
import {toast} from "sonner";
import {cn} from "tailwind-variants";

import {orpc} from "@/lib/orpc";

export function GoogleDriveCardContents({
  workspaceSlug,
  redirectUrl,
}: {
  workspaceSlug: string;
  redirectUrl: string;
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
          You can connect your Google Drive account to this workspace. This allows your workspace to
          automatically create new spreadsheets whenever you create a new puzzle.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        {state.data ? (
          // oxlint-disable-next-line jsx-a11y/no-redundant-roles -- Tailwind preflight sets list-style: none, which makes Safari/VoiceOver drop implicit list semantics.
          <ol role="list" className="overflow-hidden">
            <li className="relative pb-8">
              {state.data.state === 1 || state.data.state === 2 || state.data.state === 3 ? (
                <>
                  <div
                    aria-hidden="true"
                    className="bg-primary absolute top-4 left-3.5 mt-0.5 -ml-px h-full w-0.5"
                  />
                  <div className="group relative flex items-start">
                    <span className="flex h-8 items-center">
                      <span className="bg-primary relative z-10 flex size-7 items-center justify-center rounded-full">
                        <CheckIcon aria-hidden="true" className="size-4 text-white" />
                      </span>
                    </span>
                    <div className="flex flex-1 flex-col justify-between gap-2 pl-4 sm:flex-row">
                      <span className="flex min-w-0 flex-col">
                        <span className="text-xs font-medium">Connect with Google</span>
                        <span className="text-xs text-gray-500">
                          You're successfully connected to Google.
                        </span>
                      </span>
                      <ConnectToGoogleForm workspaceSlug={workspaceSlug} redirectUrl={redirectUrl}>
                        <Button variant="secondary" type="submit">
                          Reconnect
                        </Button>
                      </ConnectToGoogleForm>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    aria-hidden="true"
                    className="absolute top-4 left-3.5 mt-0.5 -ml-px h-full w-0.5 bg-gray-300"
                  />
                  <div aria-current="step" className="group relative flex items-start">
                    <span aria-hidden="true" className="flex h-8 items-center">
                      <span className="border-primary relative z-10 flex size-7 items-center justify-center rounded-full border-2 bg-white">
                        <span className="bg-primary size-2 rounded-full" />
                      </span>
                    </span>
                    <div className="flex flex-1 flex-col justify-between gap-2 pl-4 sm:flex-row">
                      <span className="flex min-w-0 flex-col">
                        <span className="text-primary text-xs font-medium">
                          Connect with Google
                        </span>
                        <span className="text-xs text-gray-500">
                          You need to connect your Google account.
                        </span>
                      </span>
                      <ConnectToGoogleForm workspaceSlug={workspaceSlug} redirectUrl={redirectUrl}>
                        <Button type="submit">Connect</Button>
                      </ConnectToGoogleForm>
                    </div>
                  </div>
                </>
              )}
            </li>

            <li className="relative pb-8">
              {state.data.state === 2 || state.data.state === 3 ? (
                <>
                  <div
                    aria-hidden="true"
                    className="bg-primary absolute top-4 left-3.5 mt-0.5 -ml-px h-full w-0.5"
                  />
                  <div className="group relative flex items-start">
                    <span className="flex h-8 items-center">
                      <span className="bg-primary relative z-10 flex size-7 items-center justify-center rounded-full">
                        <CheckIcon aria-hidden="true" className="size-4 text-white" />
                      </span>
                    </span>
                    <div className="flex flex-1 flex-col justify-between gap-2 pl-4 sm:flex-row">
                      <span className="flex min-w-0 flex-col">
                        <span className="text-xs font-medium">Select Google Drive Folder</span>
                        <span className="text-xs text-gray-500">
                          Folder:{" "}
                          <a
                            className={buttonVariants({
                              variant: "secondary",
                              className: "h-auto px-2 py-0",
                            })}
                            href={state.data.folderLink}
                            target="_blank"
                            rel="noopener noreferrer">
                            {state.data.folderName}
                          </a>
                        </span>
                      </span>
                      <div>
                        <Button variant="secondary" onPress={handleOpenFolderPicker}>
                          Reselect Folder
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    aria-hidden="true"
                    className="absolute top-4 left-3.5 mt-0.5 -ml-px h-full w-0.5 bg-gray-300"
                  />
                  <div aria-current="step" className="group relative flex items-start">
                    <span aria-hidden="true" className="flex h-8 items-center">
                      {state.data.state === 1 ? (
                        <span className="border-primary relative z-10 flex size-7 items-center justify-center rounded-full border-2 bg-white">
                          <span className="bg-primary size-2 rounded-full" />
                        </span>
                      ) : (
                        <span className="relative z-10 flex size-7 items-center justify-center rounded-full border-2 border-gray-300 bg-white">
                          <span className="size-2 rounded-full bg-transparent" />
                        </span>
                      )}
                    </span>
                    <div className="flex flex-1 items-center justify-between pl-4">
                      <span className="flex min-w-0 flex-col">
                        <span
                          className={cn(
                            "text-xs font-medium",
                            state.data.state === 1 ? "text-primary" : "text-gray-500"
                          )}>
                          Select Google Drive Folder
                        </span>
                        <span className="text-xs text-gray-500">
                          Choose the folder to put all your puzzles in.
                        </span>
                      </span>
                      <Button
                        isDisabled={state.data.state !== 1}
                        variant={state.data.state === 1 ? "primary" : "secondary"}
                        onPress={handleOpenFolderPicker}>
                        Select Folder
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </li>

            <li className="relative">
              {state.data.state === 3 ? (
                <>
                  <div className="group relative flex items-start">
                    <span className="flex h-8 items-center">
                      <span className="bg-primary relative z-10 flex size-7 items-center justify-center rounded-full">
                        <CheckIcon aria-hidden="true" className="h-5 w-5 text-white" />
                      </span>
                    </span>
                    <div className="flex flex-1 flex-col justify-between gap-2 pl-4 sm:flex-row">
                      <span className="flex min-w-0 flex-col">
                        <span className="text-xs font-medium">Select Template File</span>
                        <span className="text-xs text-gray-500">
                          File:{" "}
                          <a
                            className={buttonVariants({
                              variant: "secondary",
                              className: "h-auto px-2 py-0",
                            })}
                            href={state.data.fileLink}
                            target="_blank"
                            rel="noopener noreferrer">
                            {state.data.fileName}
                          </a>
                        </span>
                      </span>
                      <div>
                        <Button variant="secondary" onPress={handleOpenFilePicker}>
                          Reselect File
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div aria-current="step" className="group relative flex items-start">
                    <span aria-hidden="true" className="flex h-8 items-center">
                      {state.data.state === 2 ? (
                        <span className="border-primary relative z-10 flex size-7 items-center justify-center rounded-full border-2 bg-white">
                          <span className="bg-primary size-2 rounded-full" />
                        </span>
                      ) : (
                        <span className="relative z-10 flex size-7 items-center justify-center rounded-full border-2 border-gray-300 bg-white">
                          <span className="size-2 rounded-full bg-transparent" />
                        </span>
                      )}
                    </span>
                    <div className="flex flex-1 flex-col justify-between gap-2 pl-4 sm:flex-row">
                      <span className="flex min-w-0 flex-col">
                        <span
                          className={cn(
                            "text-xs font-medium",
                            state.data.state === 2 ? "text-primary" : "text-gray-500"
                          )}>
                          Select Template File
                        </span>
                        <span className="text-xs text-gray-500">
                          Select the template file to use for new puzzles.
                        </span>
                      </span>
                      <div>
                        <Button
                          isDisabled={state.data.state !== 2}
                          variant={state.data.state === 2 ? "primary" : "secondary"}
                          onPress={handleOpenFilePicker}>
                          Select File
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </li>
          </ol>
        ) : (
          <Skeleton className="h-[165.5px] w-full" />
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
    <form method="GET" action="https://accounts.google.com/o/oauth2/v2/auth">
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
