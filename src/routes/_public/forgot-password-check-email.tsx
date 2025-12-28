import {createFileRoute, Link} from "@tanstack/react-router";
import {ArrowLeftIcon} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Card, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";

export const Route = createFileRoute("/_public/forgot-password-check-email")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex flex-1 w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-2">
          <div>
            <Button
              variant="outline"
              size="sm"
              aria-label="Go Back"
              render={
                <Link to="/login">
                  <ArrowLeftIcon /> Back
                </Link>
              }
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Check your email</CardTitle>
              <CardDescription>
                We sent reset instructions to your email. Please check your inbox and follow the
                instructions to reset your password.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
