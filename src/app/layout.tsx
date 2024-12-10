import { KindeProvider } from "@kinde-oss/kinde-auth-react";
import { useEffect } from "react";
import { Provider } from "react-redux";
import { Outlet, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import { Toaster } from "../components/ui/sonner";
import { store } from "../store";

export default function Layout() {
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
    <>
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
      <Toaster richColors />
    </>
  );
}
