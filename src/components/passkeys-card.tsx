import {Button, Card, Skeleton} from "@heroui/react";
import {KeyRoundIcon, PlusIcon, TrashIcon} from "lucide-react";
import {useState} from "react";
import {toast} from "sonner";

import {authClient} from "@/lib/auth-client";

async function removePasskey(id: string) {
  const {error} = await authClient.passkey.deletePasskey({id});
  if (error) toast.error(error.message || "Couldn't remove the passkey.");
  else toast.success("Passkey removed");
}

/** The signed-in user's passkeys: add one for this device, or remove old ones. */
export function PasskeysCard() {
  const {data: passkeys, isPending} = authClient.useListPasskeys();
  const [isAdding, setIsAdding] = useState(false);

  const addPasskey = async () => {
    setIsAdding(true);
    const result = await authClient.passkey.addPasskey();
    setIsAdding(false);
    if (result?.error) {
      // Dismissing the browser prompt isn't an error worth shouting about.
      if (!("code" in result.error) || result.error.code !== "REGISTRATION_CANCELLED") {
        toast.error(result.error.message || "Couldn't add the passkey.");
      }
      return;
    }
    toast.success("Passkey added. Next time, log in with one tap.");
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title>Passkeys</Card.Title>
        <Card.Description>
          Log in with your fingerprint, face or device PIN instead of a password.
        </Card.Description>
      </Card.Header>
      <Card.Content className="gap-2">
        {isPending ? (
          <Skeleton className="h-10 w-full rounded-lg" />
        ) : passkeys && passkeys.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {passkeys.map(passkey => (
              <li key={passkey.id} className="flex items-center gap-3 py-1">
                <KeyRoundIcon aria-hidden="true" className="text-muted size-4 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">{passkey.name || "Passkey"}</span>
                  <span className="text-muted text-xs">
                    Added {new Date(passkey.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${passkey.name || "passkey"}`}
                  onPress={() => void removePasskey(passkey.id)}>
                  <TrashIcon />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted text-sm">No passkeys yet.</p>
        )}
      </Card.Content>
      <Card.Footer>
        <Button variant="secondary" isPending={isAdding} onPress={() => void addPasskey()}>
          <PlusIcon />
          Add a passkey
        </Button>
      </Card.Footer>
    </Card>
  );
}
