import {posthog} from "posthog-js";
import {useEffect} from "react";

import {authClient} from "@/lib/auth-client";
import {client} from "@/lib/orpc";

/** Verifies the account for the help chat, once the server has PostHog Support's secret. */
async function verifyForSupport() {
  try {
    const identity = await client.me.supportIdentity();
    if (identity) posthog.setIdentity(identity.distinctId, identity.hash);
  } catch {
    // Without it the chat still works, tied to this browser.
  }
}

/**
 * Ties PostHog's visitor to the signed-in account on every page, public ones included, so a
 * sign-up is linked to the visit that brought it (its referrer and UTM tags). Also verifies the
 * account for PostHog Support (the help chat), so their tickets follow them to other devices.
 * And forgets the account on sign-out, so the next person on a shared computer isn't counted as
 * the last one, and can't see their chats.
 */
export function PostHogIdentity() {
  const {data, isPending} = authClient.useSession();
  const user = data?.user;
  useEffect(() => {
    if (isPending) return;
    if (user) {
      // Repeated calls for the same account only update its properties.
      posthog.identify(
        user.id,
        {
          email: user.email,
          emailVerified: user.emailVerified,
          name: user.name,
          updatedAt: user.updatedAt,
        },
        {createdAt: user.createdAt}
      );
      // Null until the identity secret is set on the server; the chat then stays per-browser.
      void verifyForSupport();
    } else if (posthog.get_property("$user_state") === "identified") {
      posthog.clearIdentity();
      posthog.reset();
    }
  }, [user, isPending]);
  return null;
}
