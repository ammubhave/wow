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
      // Link previews (Slack, Discord, iMessage…). They read the static app shell, which only has
      // the root route's tags, so these are site-wide. The image is brand/social/og-image.png.
      {property: "og:site_name", content: "WOW"},
      {property: "og:title", content: "WOW · Wafflehaüs Organized Workspaces"},
      {property: "og:description", content: "The live workspace for puzzle hunt teams."},
      {property: "og:type", content: "website"},
      {property: "og:image", content: "https://www.wafflehaus.io/og-image.png"},
      {property: "og:image:width", content: "1200"},
      {property: "og:image:height", content: "630"},
      {property: "og:image:alt", content: "WOW: Solve the hunt, not the logistics."},
      {name: "twitter:card", content: "summary_large_image"},
    ],
    links: [
      {rel: "stylesheet", href: appCss},
      // Icons from brand/icons. /favicon.ico stays as the fallback (the headers also show it as the logo).
      {rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png"},
      {rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png"},
      {rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png"},
      {rel: "manifest", href: "/site.webmanifest"},
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
        {/* Lucide defaults to 24px icons; HeroUI only sizes icons inside some components (e.g. small buttons), so default every icon to 16px. */}
        <LucideProvider size={16}>
          <ThemeProvider defaultTheme="system" storageKey="ui-theme">
            <PostHogProvider
              apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
              options={{
                api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
                defaults: "2025-05-24",
                capture_exceptions: import.meta.env.MODE !== "development",
                // Session replay (on in the PostHog project). Nothing is masked except passwords, which
                // are always masked. Dev sessions aren't recorded.
                session_recording: {maskAllInputs: false},
                disable_session_recording: import.meta.env.MODE === "development",
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
