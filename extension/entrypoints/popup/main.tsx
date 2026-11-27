import {createRoot} from "react-dom/client";

import {ExtensionProviders} from "../../lib/providers";
import {Popup} from "./popup";

createRoot(document.getElementById("root")!).render(
  <ExtensionProviders>
    <Popup />
  </ExtensionProviders>
);
