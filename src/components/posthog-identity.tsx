import {posthog} from "posthog-js";
import {useEffect} from "react";

import {authClient} from "@/lib/auth-client";

/**
 * Ties PostHog's visitor to the signed-in account on every page, public ones included, so a
 * sign-up is linked to the visit that brought it (its referrer and UTM tags). And forgets the
 * account on sign-out, so the next person on a shared computer isn't counted as the last one.
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
    } else if (posthog.get_property("$user_state") === "identified") {
      posthog.reset();
    }
  }, [user, isPending]);
  return null;
}
