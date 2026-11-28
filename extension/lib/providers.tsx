import {RouterProvider as AriaRouterProvider} from "@heroui/react";
import {MutationCache, QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {LucideProvider} from "lucide-react";
import type {ReactNode} from "react";
import {Toaster} from "sonner";
import {toast} from "sonner";
import {IntlProvider} from "use-intl";

import {ThemeProvider, useTheme} from "@/components/theme-provider";
import {ARCHIVED_MESSAGE_START} from "@/lib/archived";

// oxlint-disable-next-line import/no-unassigned-import -- the pages' stylesheet.
import "../assets/app.css";

const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** One query cache per page, set up as the website's (src/router.tsx). */
export const queryClient: QueryClient = new QueryClient({
  defaultOptions: {queries: {staleTime: 60 * 1000}},
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _onMutateResult, mutation) => {
      if (mutation.meta?.invalidates !== false) void queryClient.invalidateQueries();
    },
    onError: error => {
      if (error.message.startsWith(ARCHIVED_MESSAGE_START)) {
        toast.error(error.message, {id: "workspace-archived"});
      }
    },
  }),
});

/**
 * What the website's root gives every page (src/routes/__root.tsx), for the extension's pages:
 * the theme (following the system's), 16px icons, the query cache, the store, dates in this time
 * zone, and toasts.
 */
/** Where React Aria links go: WOW, in a new tab (the extension's pages don't navigate). */
const openInNewTab = (href: string) => void window.open(href, "_blank", "noopener");

export function ExtensionProviders({children}: {children: ReactNode}) {
  return (
    <LucideProvider size={16}>
      <ThemeProvider defaultTheme="system" storageKey="ui-theme">
        <QueryClientProvider client={queryClient}>
          <AriaRouterProvider navigate={openInNewTab}>
            <IntlProvider locale="en" timeZone={TIME_ZONE}>
              {children}
            </IntlProvider>
          </AriaRouterProvider>
        </QueryClientProvider>
        <ThemedToaster />
      </ThemeProvider>
    </LucideProvider>
  );
}

function ThemedToaster() {
  const {theme} = useTheme();
  return (
    <Toaster
      theme={theme}
      position="top-center"
      closeButton
      toastOptions={{
        classNames: {
          toast: "!bg-overlay !text-foreground !border-separator !rounded-none !shadow-overlay",
          description: "!text-muted",
          closeButton: "!bg-overlay !border-separator !text-muted",
          success: "[&_[data-icon]]:!text-success",
          error: "[&_[data-icon]]:!text-danger",
        },
      }}
    />
  );
}
