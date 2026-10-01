import {Card} from "@heroui/react";
import {createFileRoute, Link} from "@tanstack/react-router";
import {ArrowLeftIcon} from "lucide-react";

export const Route = createFileRoute("/_public/forgot-password-check-email")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Forgot Password | WOW"}]}),
});

function RouteComponent() {
  return (
    <div className="flex w-full flex-1 items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-2">
          <div>
            <Link to="/login" className="button button--outline button--sm gap-2">
              <ArrowLeftIcon aria-hidden="true" /> Back
            </Link>
          </div>
          <Card>
            <Card.Header>
              <Card.Title>Check your email</Card.Title>
              <Card.Description>
                We sent reset instructions to your email. Please check your inbox and follow the
                instructions to reset your password.
              </Card.Description>
            </Card.Header>
          </Card>
        </div>
      </div>
    </div>
  );
}
