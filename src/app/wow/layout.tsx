import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";

import { CoffeeIcon } from "@/components/coffee-icon";
import { Header } from "@/components/header";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

function LayoutInner({
  getIdToken,
}: {
  getIdToken: () => Promise<string | undefined>;
}) {
  const location = useLocation();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Infinity,
          },
        },
      }),
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          async headers() {
            return {
              authorization: `Bearer ${await getIdToken()}`,
            };
          },
        }),
      ],
    }),
  );
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Header />
        <main className="bg-muted/40 flex min-h-[calc(100vh_-_theme(spacing.16))] flex-1 flex-col gap-4 p-4 md:gap-8 md:p-10">
          <Outlet />
          {!location.pathname.includes("/puzzles/") && (
            <footer className="mt-auto justify-end pt-6">
              <div className="flex flex-col items-center justify-end gap-4 md:h-24 md:flex-row">
                <p className="text-muted-foreground flex flex-col items-end gap-2 text-balance text-center text-sm leading-loose md:text-left">
                  Help support the hosting and development costs for WOW!
                  <Button
                    variant="secondary"
                    className="gap-2 font-['Cookie'] text-xl"
                    asChild
                  >
                    <a
                      href="https://www.buymeacoffee.com/amolbhave"
                      target="_blank"
                    >
                      <CoffeeIcon className="size-4" />
                      Buy me a coffee
                    </a>
                  </Button>
                </p>
              </div>
            </footer>
          )}
        </main>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default function Layout() {
  const { isLoading, isAuthenticated, user, getIdToken } = useKindeAuth();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login", {
        state: `${location.pathname}${location.search}`,
      });
    }
  }, [isAuthenticated, isLoading]);
  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center">
        <Spinner />
      </div>
    );
  }
  return <LayoutInner getIdToken={getIdToken} />;
}
