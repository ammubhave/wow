import {TanStackDevtools} from "@tanstack/react-devtools";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ReactQueryDevtoolsPanel} from "@tanstack/react-query-devtools";
import {createRootRoute, HeadContent, Scripts} from "@tanstack/react-router";
import {TanStackRouterDevtoolsPanel} from "@tanstack/react-router-devtools";
import {PostHogProvider} from "posthog-js/react";
import {Provider as ReactReduxProvider} from "react-redux";

import {ThemeProvider} from "@/components/theme-provider";
import {Toaster} from "@/components/ui/sonner";
import {store} from "@/store";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {charSet: "utf-8"},
      {name: "viewport", content: "width=device-width, initial-scale=1"},
      {title: "WOW"},
    ],
    links: [
      {rel: "stylesheet", href: appCss},
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css?family=Cookie|Inconsolata|Noto+Sans:400,700&amp;subset=cyrillic,cyrillic-ext,devanagari,greek,greek-ext,latin-ext,vietnamese",
      },
    ],
  }),
  shellComponent: RootDocument,
});

const queryClient = new QueryClient();

function RootDocument({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider defaultTheme="system" storageKey="ui-theme">
            <PostHogProvider
              apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string}
              options={{
                api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
                defaults: "2025-05-24",
                capture_exceptions: import.meta.env.MODE !== "development",
                debug: import.meta.env.MODE === "development",
              }}>
              <ReactReduxProvider store={store}>{children}</ReactReduxProvider>
            </PostHogProvider>
          </ThemeProvider>
          <TanStackDevtools
            config={{position: "bottom-right"}}
            plugins={[
              {name: "TanStack Query", render: <ReactQueryDevtoolsPanel />},
              {name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel />},
            ]}
          />
          <Toaster richColors />
          <Scripts />
        </QueryClientProvider>
      </body>
    </html>
  );
}
