import {createStart} from "@tanstack/react-start";

// Pure SPA: the app is behind a login, so server rendering has nothing to offer. The server only
// returns the document shell (head and scripts); every route's loader and component runs in the
// browser. Server functions and API routes are unaffected.
export const startInstance = createStart(() => ({defaultSsr: false}));
