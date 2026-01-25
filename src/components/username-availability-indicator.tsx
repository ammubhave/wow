import {useQuery} from "@tanstack/react-query";
import {useDebounceValue} from "usehooks-ts";

import {authClient} from "@/lib/auth-client";

export function UsernameAvailabilityIndicator({
  username,
  children,
}: {
  username: string;
  children: (available?: boolean) => React.ReactNode;
}) {
  const [debouncedUsername] = useDebounceValue(username, 300);
  const usernameAvailable = useQuery({
    queryFn: () => authClient.isUsernameAvailable({username: debouncedUsername}),
    queryKey: ["username-availability", debouncedUsername],
    enabled: debouncedUsername.length > 0,
  });
  return (
    <>
      {children(
        usernameAvailable.data?.data?.available ??
          (usernameAvailable.data && "error" in usernameAvailable.data ? false : undefined)
      )}
    </>
  );
}
