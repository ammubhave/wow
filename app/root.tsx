import { KindeProvider } from "@kinde-oss/kinde-auth-react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useNavigate,
  useRouteError,
} from "@remix-run/react";
import { useEffect } from "react";
import { Provider } from "react-redux";

import { Spinner } from "./components/spinner";
import { store } from "./store";

import "./tailwind.css";

import { captureRemixErrorBoundaryError, withSentry } from "@sentry/remix";
import { toast } from "sonner";

import { Toaster } from "./components/ui/sonner";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="shortcut icon" href="/img/wafflehaus.ico" />
        <link rel="apple-touch-icon" href="/img/wafflehaus.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css?family=Cookie|Inconsolata|Noto+Sans:400,700&amp;subset=cyrillic,cyrillic-ext,devanagari,greek,greek-ext,latin-ext,vietnamese"
          rel="stylesheet"
        />
        <title>WOW</title>
        <Meta />
        <Links />
      </head>
      <body className="bg-background min-h-screen">
        {children}

        <ScrollRestoration />
        <Scripts />
        <Toaster richColors />
      </body>
    </html>
  );
}

function App() {
  // If an error message was passed in the URL, show it to the user.
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const errorMessage = params.get("error_message");
    if (errorMessage) {
      toast.error(errorMessage);
      params.delete("error_message");
      navigate(
        {
          pathname: location.pathname,
          search: params.toString(),
        },
        { replace: true },
      );
    }
  }, [location, navigate]);

  return (
    <KindeProvider
      clientId="5c195b6c931b452b998005019d64cbf2"
      domain="https://auth.wafflehaus.io"
      redirectUri={`${typeof window !== "undefined" ? window.location.origin : ""}/wow`}
      logoutUri={typeof window !== "undefined" ? window.location.origin : ""}
      onRedirectCallback={(_user, app_state?: { redirectTo?: string }) => {
        if (app_state?.redirectTo) {
          navigate(app_state.redirectTo);
        }
      }}
    >
      <Provider store={store}>
        <Outlet />
      </Provider>
    </KindeProvider>
  );
}

export default withSentry(App, {
  wrapWithErrorBoundary: true,
});

export function HydrateFallback() {
  return (
    <div className="relative flex min-h-screen w-full flex-col">
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    </div>
  );
}

export const ErrorBoundary = () => {
  const error = useRouteError();

  captureRemixErrorBoundaryError(error);

  if (isRouteErrorResponse(error)) {
    return (
      <div>
        <h1>
          {error.status} {error.statusText}
        </h1>
        <p>{error.data}</p>
      </div>
    );
  } else if (error instanceof Error) {
    return (
      <div>
        <h1>Error</h1>
        <p>{error.message}</p>
        <p>The stack trace is:</p>
        <pre>{error.stack}</pre>
      </div>
    );
  } else {
    return <h1>Unknown Error</h1>;
  }
};
