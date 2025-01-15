import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";

import { BrowserRouter, Route, Routes } from "react-router";

import PublicDocsBlackboardPage from "./app/(public)/docs/blackboard/page";
import PublicDocsDiscordPage from "./app/(public)/docs/discord/page";
import PublicDocsGoogleDrivePage from "./app/(public)/docs/google-drive/page";
import PublicDocsLayout from "./app/(public)/docs/layout";
import PublicDocsPage from "./app/(public)/docs/page.tsx";
import PublicLayout from "./app/(public)/layout";
import PublicPrivacyPolicyPage from "./app/(public)/privacy-policy/page";
import PublicTosPage from "./app/(public)/tos/page";
import Layout from "./app/layout";
import LoginPage from "./app/login/page";
import Page from "./app/page";
import WowWorkspaceIdLayout from "./app/wow/[workspaceId]/layout";
import WowWorkspaceIdPage from "./app/wow/[workspaceId]/page";
import WowWorkspaceIdPuzzlesPuzzleIdPage from "./app/wow/[workspaceId]/puzzles/[puzzleId]/page";
import WowWorkspaceIdSettingsAdministrationPage from "./app/wow/[workspaceId]/settings/administration/page";
import WowWorkspaceIdSettingsPage from "./app/wow/[workspaceId]/settings/page";
import WowCreateWorkspaceIdPage from "./app/wow/create/[workspaceId]/page";
import WowCreatePage from "./app/wow/create/page";
import WowJoinWorkspaceIdPage from "./app/wow/join/[workspaceId]/page";
import WowLayout from "./app/wow/layout";
import WowPage from "./app/wow/page";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Page />} />
          <Route path="login">
            <Route index element={<LoginPage />} />
          </Route>
          <Route path="wow" element={<WowLayout />}>
            <Route index element={<WowPage />} />
            <Route path="create">
              <Route index element={<WowCreatePage />} />
              <Route path=":workspaceId">
                <Route index element={<WowCreateWorkspaceIdPage />} />
              </Route>
            </Route>
            <Route path="join">
              <Route path=":workspaceId">
                <Route index element={<WowJoinWorkspaceIdPage />} />
              </Route>
            </Route>
            <Route path=":workspaceId" element={<WowWorkspaceIdLayout />}>
              <Route index element={<WowWorkspaceIdPage />} />
              <Route path="puzzles">
                <Route path=":puzzleId">
                  <Route
                    index
                    element={<WowWorkspaceIdPuzzlesPuzzleIdPage />}
                  />
                </Route>
              </Route>
              <Route path="settings">
                <Route index element={<WowWorkspaceIdSettingsPage />} />
                <Route path="administration">
                  <Route
                    index
                    element={<WowWorkspaceIdSettingsAdministrationPage />}
                  />
                </Route>
              </Route>
            </Route>
          </Route>
          <Route element={<PublicLayout />}>
            <Route path="docs" element={<PublicDocsLayout />}>
              <Route index element={<PublicDocsPage />} />
              <Route path="blackboard">
                <Route index element={<PublicDocsBlackboardPage />} />
              </Route>
              <Route path="discord">
                <Route index element={<PublicDocsDiscordPage />} />
              </Route>
              <Route path="google-drive">
                <Route index element={<PublicDocsGoogleDrivePage />} />
              </Route>
            </Route>
            <Route path="privacy-policy">
              <Route index element={<PublicPrivacyPolicyPage />} />
            </Route>
            <Route path="tos">
              <Route index element={<PublicTosPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
