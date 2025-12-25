import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {CheckIcon} from "lucide-react";
import useDrivePicker from "react-google-drive-picker";
import {toast} from "sonner";

import {Button} from "@/components/ui/button";
import {CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Skeleton} from "@/components/ui/skeleton";
import {orpc} from "@/lib/orpc";
import {cn} from "@/lib/utils";

export function GoogleDriveCardContents({
  workspaceId,
  redirectUrl,
}: {
  workspaceId: string;
  redirectUrl: string;
}) {
  const [openPicker] = useDrivePicker();
  const queryClient = useQueryClient();
  const folderMutation = useMutation(
    orpc.workspaces.setGoogleFolderId.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries();
      },
    })
  );
  const fileMutation = useMutation(
    orpc.workspaces.setGoogleTemplateFileId.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries();
      },
    })
  );
  const handleOpenFolderPicker = () => {
    openPicker({
      clientId: import.meta.env.VITE_GOOGLE_API_CLIENT_ID as string,
      developerKey: import.meta.env.VITE_GOOGLE_API_KEY as string,
      viewId: "FOLDERS",
      appId: "933519172272",
      setIncludeFolders: true,
      setSelectFolderEnabled: true,
      callbackFunction: data => {
        if (data.action === "picked") {
          toast.promise(folderMutation.mutateAsync({id: workspaceId, folderId: data.docs[0]!.id}), {
            loading: "Selecting folder...",
            success: "Success! The folder has been selected.",
            error: "Oops! Something went wrong.",
          });
        }
      },
    });
  };
  const handleOpenFilePicker = () => {
    openPicker({
      clientId: import.meta.env.VITE_GOOGLE_API_CLIENT_ID as string,
      developerKey: import.meta.env.VITE_GOOGLE_API_KEY as string,
      viewId: "SPREADSHEETS",
      appId: "933519172272",
      setIncludeFolders: true,
      callbackFunction: data => {
        if (data.action === "picked") {
          toast.promise(fileMutation.mutateAsync({id: workspaceId, fileId: data.docs[0]!.id}), {
            loading: "Selecting template file...",
            success: "Success! The template file has been selected.",
            error: "Oops! Something went wrong.",
          });
        }
      },
    });
  };

  const state = useQuery(orpc.workspaces.getGoogleTokenState.queryOptions({input: workspaceId}));

  return (
    <>
      <CardHeader className="px-7">
        <CardTitle>Google Drive Connection</CardTitle>
        <CardDescription>
          You can connect your Google Drive account to this workspace. This allows your workspace to
          automatically create new spreadsheets whenever you create a new puzzle.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.data ? (
          <ol role="list" className="overflow-hidden">
            <li className={"relative pb-10"}>
              {state.data.state === 1 || state.data.state === 2 || state.data.state === 3 ? (
                <>
                  <div
                    aria-hidden="true"
                    className="absolute left-4 top-4 -ml-px mt-0.5 h-full w-0.5 bg-indigo-600"
                  />
                  <div className="group relative flex items-start">
                    <span className="flex h-9 items-center">
                      <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600">
                        <CheckIcon aria-hidden="true" className="h-5 w-5 text-white" />
                      </span>
                    </span>
                    <div className="flex pl-4 flex-col sm:flex-row flex-1 gap-2 justify-between">
                      <span className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium">Connect with Google</span>
                        <span className="text-sm text-gray-500">
                          You're successfully connected to Google.
                        </span>
                      </span>
                      <ConnectToGoogleForm workspaceId={workspaceId} redirectUrl={redirectUrl}>
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
                    className="absolute left-4 top-4 -ml-px mt-0.5 h-full w-0.5 bg-gray-300"
                  />
                  <div aria-current="step" className="group relative flex items-start">
                    <span aria-hidden="true" className="flex h-9 items-center">
                      <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-indigo-600 bg-white">
                        <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                      </span>
                    </span>
                    <div className="flex pl-4 flex-1 flex-col sm:flex-row gap-2 justify-between">
                      <span className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium text-indigo-600">
                          Connect with Google
                        </span>
                        <span className="text-sm text-gray-500">
                          You need to connect your Google account.
                        </span>
                      </span>
                      <ConnectToGoogleForm workspaceId={workspaceId} redirectUrl={redirectUrl}>
                        <Button type="submit">Connect</Button>
                      </ConnectToGoogleForm>
                    </div>
                  </div>
                </>
              )}
            </li>

            <li className="relative pb-10">
              {state.data.state === 2 || state.data.state === 3 ? (
                <>
                  <div
                    aria-hidden="true"
                    className="absolute left-4 top-4 -ml-px mt-0.5 h-full w-0.5 bg-indigo-600"
                  />
                  <div className="group relative flex items-start">
                    <span className="flex h-9 items-center">
                      <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600">
                        <CheckIcon aria-hidden="true" className="h-5 w-5 text-white" />
                      </span>
                    </span>
                    <div className="flex pl-4 flex-1 flex-col sm:flex-row gap-2 justify-between">
                      <span className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium">Select Google Drive Folder</span>
                        <span className="text-sm text-gray-500">
                          Folder:{" "}
                          <Button
                            variant="secondary"
                            className="h-auto px-2 py-0"
                            render={
                              <a
                                href={state.data.folderLink}
                                target="_blank"
                                rel="noopener noreferrer">
                                {state.data.folderName}
                              </a>
                            }
                          />
                        </span>
                      </span>
                      <div>
                        <Button variant="secondary" onClick={handleOpenFolderPicker}>
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
                    className="absolute left-4 top-4 -ml-px mt-0.5 h-full w-0.5 bg-gray-300"
                  />
                  <div aria-current="step" className="group relative flex items-start">
                    <span aria-hidden="true" className="flex h-9 items-center">
                      {state.data.state === 1 ? (
                        <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-indigo-600 bg-white">
                          <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                        </span>
                      ) : (
                        <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 bg-white">
                          <span className="h-2.5 w-2.5 rounded-full bg-transparent" />
                        </span>
                      )}
                    </span>
                    <div className="pl-4 flex flex-1 items-center justify-between">
                      <span className="flex min-w-0 flex-col">
                        <span
                          className={cn(
                            "text-sm font-medium",
                            state.data.state === 1 ? "text-indigo-600" : "text-gray-500"
                          )}>
                          Select Google Drive Folder
                        </span>
                        <span className="text-sm text-gray-500">
                          Choose the folder to put all your puzzles in.
                        </span>
                      </span>
                      <Button
                        disabled={state.data.state !== 1}
                        variant={state.data.state === 1 ? "default" : "secondary"}
                        onClick={handleOpenFolderPicker}>
                        Select Folder
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </li>

            <li className="relative pb-10">
              {state.data.state === 3 ? (
                <>
                  <div className="group relative flex items-start">
                    <span className="flex h-9 items-center">
                      <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600">
                        <CheckIcon aria-hidden="true" className="h-5 w-5 text-white" />
                      </span>
                    </span>
                    <div className="pl-4 flex flex-1 flex-col sm:flex-row gap-2 justify-between">
                      <span className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium">Select Template File</span>
                        <span className="text-sm text-gray-500">
                          File:{" "}
                          <Button
                            variant="secondary"
                            className="h-auto px-2 py-0"
                            render={
                              <a
                                href={state.data.fileLink}
                                target="_blank"
                                rel="noopener noreferrer">
                                {state.data.fileName}
                              </a>
                            }
                          />
                        </span>
                      </span>
                      <div>
                        <Button variant="secondary" onClick={handleOpenFilePicker}>
                          Reselect File
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div aria-current="step" className="group relative flex items-start">
                    <span aria-hidden="true" className="flex h-9 items-center">
                      {state.data.state === 2 ? (
                        <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-indigo-600 bg-white">
                          <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                        </span>
                      ) : (
                        <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 bg-white">
                          <span className="h-2.5 w-2.5 rounded-full bg-transparent" />
                        </span>
                      )}
                    </span>
                    <div className="pl-4 flex flex-1 flex-col sm:flex-row gap-2 justify-between">
                      <span className="flex min-w-0 flex-col">
                        <span
                          className={cn(
                            "text-sm font-medium",
                            state.data.state === 2 ? "text-indigo-600" : "text-gray-500"
                          )}>
                          Select Template File
                        </span>
                        <span className="text-sm text-gray-500">
                          Select the template file to use for new puzzles.
                        </span>
                      </span>
                      <div>
                        <Button
                          disabled={state.data.state !== 2}
                          variant={state.data.state === 2 ? "default" : "secondary"}
                          onClick={handleOpenFilePicker}>
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
          <Skeleton className="h-60 w-full" />
        )}
      </CardContent>
    </>
  );
}

function ConnectToGoogleForm({
  workspaceId,
  redirectUrl,
  children,
}: {
  workspaceId: string;
  redirectUrl: string;
  children: React.ReactNode;
}) {
  return (
    <form method="GET" action="https://accounts.google.com/o/oauth2/v2/auth">
      <input type="hidden" name="client_id" value={import.meta.env.VITE_GOOGLE_API_CLIENT_ID} />
      <input
        type="hidden"
        name="redirect_uri"
        value={`${typeof window !== "undefined" ? window.location.origin : ""}/api/oauth/google`}
      />
      <input type="hidden" name="scope" value="https://www.googleapis.com/auth/drive.file" />
      <input type="hidden" name="response_type" value="code" />
      <input type="hidden" name="access_type" value="offline" />
      <input type="hidden" name="prompt" value="consent" />
      <input
        type="hidden"
        name="state"
        value={new URLSearchParams({redirectUrl, workspaceId}).toString()}
      />
      <input type="hidden" name="include_granted_scopes" value="false" />
      {children}
    </form>
  );
}
