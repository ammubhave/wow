import {Card} from "@heroui/react";
import {createFileRoute} from "@tanstack/react-router";
import {MailCheckIcon} from "lucide-react";

import {AuthLayout, BackToLogin} from "@/components/auth-layout";

export const Route = createFileRoute("/_public/forgot-password-check-email")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Check your email | WOW"}]}),
});

function RouteComponent() {
  return (
    <AuthLayout>
      <BackToLogin />
      <Card>
        <MailCheckIcon aria-hidden="true" className="text-accent size-6" />
        <Card.Header>
          <Card.Title className="text-lg font-semibold">Check your email</Card.Title>
          <Card.Description>
            If an account exists for that address, we've sent a link to reset your password. It may
            take a minute to arrive; check your spam folder too.
          </Card.Description>
        </Card.Header>
      </Card>
    </AuthLayout>
  );
}
