import {RouterProvider} from "@heroui/react";
import {TanStackDevtools} from "@tanstack/react-devtools";
import type {QueryClient} from "@tanstack/react-query";
import {ReactQueryDevtoolsPanel} from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  type NavigateOptions,
  Scripts,
  type ToOptions,
  useRouter,
} from "@tanstack/react-router";
import {TanStackRouterDevtoolsPanel} from "@tanstack/react-router-devtools";
import {LucideProvider} from "lucide-react";
import {PostHogProvider} from "posthog-js/react";
import {Provider as ReactReduxProvider} from "react-redux";
import {Toaster} from "sonner";
import {IntlProvider} from "use-intl";

import {ThemeProvider, useTheme} from "@/components/theme-provider";
import {store} from "@/store";

import appCss from "../styles.css?url";

declare module "react-aria-components" {
  interface RouterConfig {
    href: string;
    routerOptions: Omit<NavigateOptions, keyof ToOptions>;
  }
}

export const Route = createRootRouteWithContext<{queryClient: QueryClient}>()({
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

function RootDocument({children}: {children: React.ReactNode}) {
  const router = useRouter();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {/* 16px default, as shadcn applied via [&_svg]:size-4 in buttons and menus. */}
        <LucideProvider size={16}>
          <ThemeProvider defaultTheme="system" storageKey="ui-theme">
            <PostHogProvider
              apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
              options={{
                api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
                defaults: "2025-05-24",
                capture_exceptions: import.meta.env.MODE !== "development",
                debug: import.meta.env.MODE === "development",
              }}>
              <ReactReduxProvider store={store}>
                <RouterProvider navigate={(to, options) => router.navigate({...options, to})}>
                  <IntlProvider locale="en">{children}</IntlProvider>
                </RouterProvider>
              </ReactReduxProvider>
            </PostHogProvider>
            <ThemedToaster />
          </ThemeProvider>
          <TanStackDevtools
            config={{position: "bottom-right"}}
            plugins={[
              {name: "TanStack Query", render: <ReactQueryDevtoolsPanel />},
              {name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel />},
            ]}
          />
          <Scripts />
        </LucideProvider>
      </body>
    </html>
  );
}

function ThemedToaster() {
  const {theme} = useTheme();
  return <Toaster theme={theme} richColors expand closeButton swipeDirections={[]} />;
}
