import {inferOrgAdditionalFields, usernameClient} from "better-auth/client/plugins";
import {organizationClient} from "better-auth/client/plugins";
import {inferAdditionalFields} from "better-auth/client/plugins";
import {createAuthClient} from "better-auth/react";

import type {auth} from "./auth";

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(),
    organizationClient({schema: inferOrgAdditionalFields<typeof auth>()}),
    usernameClient(),
  ],
});
