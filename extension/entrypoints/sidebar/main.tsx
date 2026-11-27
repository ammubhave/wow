import {createRoot} from "react-dom/client";

import {ExtensionProviders} from "../../lib/providers";
import {Sidebar} from "./sidebar";

// The page the content script shows beside a hunt's puzzle page: sidebar.html?workspace=…&puzzle=…
const params = new URLSearchParams(location.search);

createRoot(document.getElementById("root")!).render(
  <ExtensionProviders>
    <Sidebar workspaceSlug={params.get("workspace") ?? ""} puzzleId={params.get("puzzle") ?? ""} />
  </ExtensionProviders>
);
