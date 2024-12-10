import { EnvelopeIcon } from "@heroicons/react/24/solid";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { Link, useLocation } from "react-router";

import { CoffeeIcon } from "@/components/coffee-icon";
import { Button } from "@/components/ui/button";

export default function Page() {
  const location = useLocation();
  const { login } = useKindeAuth();
  return (
    <div className="flex min-h-screen">
      <div className="container relative grid max-w-none flex-1 grid-cols-1 flex-col items-center justify-center px-0 lg:grid-cols-2">
        <div
          style={{
            backgroundImage: "url(/img/authbg.jpg)",
          }}
          className="bg-muted relative h-full flex-col bg-cover p-10 lg:flex dark:border-r"
        >
          <Link
            to="/"
            className="relative z-20 flex items-center gap-4 text-lg font-medium text-black"
          >
            <img
              src="/img/wafflehaus.png"
              className="rounded-full"
              width={48}
              height={48}
            />
            WOW
          </Link>
        </div>
        <div className="lg:p-8">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[450px]">
            <div className="flex flex-col space-y-8 text-center px-8">
              <h1 className="text-2xl font-semibold tracking-tight">
                Wafflehäus Organized Workspace
              </h1>
              <div className="flex min-w-80 flex-col items-stretch gap-4">
                <Button
                  variant="outline"
                  onClick={() =>
                    login({
                      authUrlParams: {
                        connection_id: "conn_0191b0ab74f246df0c995c10e6595bbb",
                      },
                      app_state: {
                        redirectTo: location.state,
                      },
                    })
                  }
                  className="gap-2 border border-gray-300"
                >
                  <EnvelopeIcon className="size-4" />
                  Sign in with email
                </Button>
                {/*
                <Button
                  disabled
                  variant="secondary"
                  onClick={() =>
                    login({
                      authUrlParams: {
                        connection_id: "conn_0191c6135344d371db4eeeff3dc73418",
                      },
                    })
                  }
                  className="gap-2 border border-gray-300"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 321 166"
                    className="w-8 h-8"
                  >
                    <g strokeWidth="35" stroke="#A31F34">
                      <path d="m17.5,0v166m57-166v113m57-113v166m57-166v33m58,20v113" />
                      <path d="m188.5,53v113" stroke="#8A8B8C" />
                      <path d="m229,16.5h92" strokeWidth="33" />
                    </g>
                  </svg>
                  Sign in with MIT Touchstone (coming soon)
                </Button>*/}
                <Button
                  onClick={() =>
                    login({
                      authUrlParams: {
                        connection_id: "conn_0191b14f69c5bc65ea9f91e0fa535cc3",
                      },
                      app_state: {
                        redirectTo: location.state,
                      },
                    })
                  }
                  className="gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="24"
                    viewBox="0 0 24 24"
                    width="24"
                  >
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                    <path d="M1 1h22v22H1z" fill="none" />
                  </svg>
                  Sign in with Google
                </Button>
              </div>
              <p className="text-muted-foreground px-8 text-center text-sm">
                By continuing, you agree to our{" "}
                <Link
                  className="hover:text-primary underline underline-offset-4"
                  to="/tos"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  className="hover:text-primary underline underline-offset-4"
                  to="/privacy-policy"
                >
                  Privacy Policy
                </Link>
                .
              </p>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t"></span>
                </div>
              </div>
              <div className="text-muted-foreground flex flex-col gap-4 text-left text-sm">
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
