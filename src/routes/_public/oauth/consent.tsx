import {Button, Card} from "@heroui/react";
import {useQuery} from "@tanstack/react-query";
import {createFileRoute, redirect} from "@tanstack/react-router";
import {useState} from "react";
import {z} from "zod";

import {AuthLayout} from "@/components/auth-layout";
import {authClient} from "@/lib/auth-client";
import {getSession} from "@/lib/session";

/**
 * The OAuth provider's consent page (`consentPage` in src/lib/auth.ts): an app asking to use your
 * WOW account. The Chrome extension, a first-party client, never shows it; it's here for any other
 * client registered later. The provider signs the request into the URL, and `oauthProviderClient`
 * sends it along with the answer.
 */
export const Route = createFileRoute("/_public/oauth/consent")({
  validateSearch: z.object({client_id: z.string(), scope: z.string().optional()}),
  beforeLoad: async ({location}) => {
    if (!(await getSession())) {
      throw redirect({to: "/login", search: {redirectTo: location.href}});
    }
  },
  component: RouteComponent,
  head: () => ({meta: [{title: "Allow access | WOW"}]}),
});

const SCOPE_LABELS: Record<string, string> = {
  openid: "Know who you are",
  profile: "See your name and picture",
  email: "See your email address",
  offline_access: "Stay signed in",
};

function RouteComponent() {
  const {client_id: clientId, scope} = Route.useSearch();
  const {data: client} = useQuery({
    queryKey: ["oauth-public-client", clientId],
    queryFn: async () =>
      (await authClient.oauth2.publicClient({query: {client_id: clientId}})).data ?? null,
  });
  const [answering, setAnswering] = useState<boolean>();
  const answer = async (accept: boolean) => {
    setAnswering(accept);
    const {error} = await authClient.oauth2.consent({accept});
    if (error) setAnswering(undefined);
  };
  const name = client?.client_name ?? "This app";
  const scopes = (scope ?? "").split(" ").filter(s => SCOPE_LABELS[s]);
  return (
    <AuthLayout>
      <Card>
        <Card.Header>
          <Card.Title className="text-lg font-semibold">
            {name} wants to use your WOW account
          </Card.Title>
          <Card.Description>
            It will be able to see and change what you can in WOW.
          </Card.Description>
        </Card.Header>
        {scopes.length > 0 && (
          <Card.Content>
            <ul className="text-muted list-inside list-disc text-sm">
              {scopes.map(s => (
                <li key={s}>{SCOPE_LABELS[s]}</li>
              ))}
            </ul>
          </Card.Content>
        )}
        <Card.Footer className="flex justify-end gap-2">
          <Button
            variant="tertiary"
            isPending={answering === false}
            isDisabled={answering !== undefined}
            onPress={() => void answer(false)}>
            Deny
          </Button>
          <Button
            isPending={answering === true}
            isDisabled={answering !== undefined}
            onPress={() => void answer(true)}>
            Allow
          </Button>
        </Card.Footer>
      </Card>
    </AuthLayout>
  );
}
