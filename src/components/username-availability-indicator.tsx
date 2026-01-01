import {useQuery} from "@tanstack/react-query";
import {useDebounce} from "@uidotdev/usehooks";

import {authClient} from "@/lib/auth-client";

export function UsernameAvailabilityIndicator({
  username,
  children,
}: {
  username: string;
  children: (available?: boolean) => React.ReactNode;
}) {
  const debouncedUsername = useDebounce(username, 300);
  const usernameAvailable = useQuery({
    queryFn: () => authClient.isUsernameAvailable({username: debouncedUsername}),
    queryKey: ["username-availability", debouncedUsername],
    enabled: debouncedUsername.length > 0,
  });
  console.log(usernameAvailable);
  return (
    <>
      {children(
        usernameAvailable.data?.data?.available ??
          (usernameAvailable.data && "error" in usernameAvailable.data ? false : undefined)
      )}
    </>
  );
}
