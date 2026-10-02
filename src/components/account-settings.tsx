import {AlertDialog, Button, Card, Chip, Modal, Separator, Skeleton} from "@heroui/react";
import type {TurnstileInstance} from "@marsidev/react-turnstile";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {useRouter} from "@tanstack/react-router";
import {LaptopIcon, LockKeyholeIcon, SmartphoneIcon} from "lucide-react";
import {Fragment, useRef, useState} from "react";
import {toast} from "sonner";

import {authClient} from "@/lib/auth-client";
import {authErrorMessage} from "@/lib/auth-helpers";

import {FormError, GoogleLogo} from "./auth-layout";
import {Captcha, captchaHeaders} from "./captcha";
import {ControlledAlertDialog, ControlledModal} from "./controlled-dialog";
import {useAppForm} from "./form";

const ACCOUNTS_KEY = ["auth", "accounts"];
const SESSIONS_KEY = ["auth", "sessions"];

/** Which ways this user can sign in: "credential" (a password) and/or "google". */
function useLinkedProviders() {
  return useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: async () => {
      const {data, error} = await authClient.listAccounts();
      if (error) throw new Error(error.message);
      // providerId → accountId (unlinking needs the account's id).
      return new Map(data.map(account => [account.providerId, account.accountId]));
    },
  });
}

function MethodRow({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-muted flex size-8 shrink-0 items-center justify-center [&_svg]:size-4">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-muted text-xs">{description}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

async function connectGoogle() {
  const {error} = await authClient.linkSocial({provider: "google", callbackURL: "/profile"});
  if (error) toast.error(authErrorMessage(error, "Couldn't connect Google."));
}

/** Password and Google sign-in; passkeys have their own card. */
export function SignInMethodsCard({email}: {email: string}) {
  const providers = useLinkedProviders();
  const queryClient = useQueryClient();
  const hasPassword = providers.data?.has("credential") ?? false;
  const hasGoogle = providers.data?.has("google") ?? false;
  const [isChangeOpen, setIsChangeOpen] = useState(false);
  const [isSetOpen, setIsSetOpen] = useState(false);

  const disconnectGoogle = async () => {
    const accountId = providers.data?.get("google");
    if (!accountId) return;
    const {error} = await authClient.unlinkAccount({accountId});
    if (error) {
      toast.error(authErrorMessage(error, "Couldn't disconnect Google."));
      return;
    }
    toast.success("Google disconnected");
    await queryClient.invalidateQueries({queryKey: ACCOUNTS_KEY});
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title>Sign-in methods</Card.Title>
        <Card.Description>The ways you can log in to WOW.</Card.Description>
      </Card.Header>
      <Card.Content>
        {providers.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ) : (
          <>
            <MethodRow
              icon={<LockKeyholeIcon />}
              title="Password"
              description={hasPassword ? "Log in with your email and password" : "Not set"}>
              {hasPassword ? (
                <Button size="sm" variant="secondary" onPress={() => setIsChangeOpen(true)}>
                  Change
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onPress={() => setIsSetOpen(true)}>
                  Set a password
                </Button>
              )}
            </MethodRow>
            <Separator />
            <MethodRow
              icon={<GoogleLogo />}
              title="Google"
              description={hasGoogle ? "Connected" : "Log in with your Google account"}>
              {hasGoogle ? (
                <Button
                  size="sm"
                  variant="tertiary"
                  // Keep at least one way in: better-auth also refuses to unlink the last method.
                  isDisabled={!hasPassword}
                  onPress={() => void disconnectGoogle()}>
                  Disconnect
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onPress={() => void connectGoogle()}>
                  Connect
                </Button>
              )}
            </MethodRow>
          </>
        )}
      </Card.Content>
      <ChangePasswordDialog isOpen={isChangeOpen} onOpenChange={setIsChangeOpen} />
      <SetPasswordDialog email={email} isOpen={isSetOpen} onOpenChange={setIsSetOpen} />
    </Card>
  );
}

function ChangePasswordDialog({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: {currentPassword: "", newPassword: ""},
    onSubmit: async ({value}) => {
      setError(null);
      const result = await authClient.changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
        // A changed password should lock out anyone else who had it.
        revokeOtherSessions: true,
      });
      if (result.error) {
        setError(authErrorMessage(result.error, "Couldn't change your password."));
        return;
      }
      toast.success("Password changed. Other devices have been signed out.");
      form.reset();
      onOpenChange(false);
      await queryClient.invalidateQueries({queryKey: SESSIONS_KEY});
    },
  });
  return (
    <ControlledModal
      isOpen={isOpen}
      onOpenChange={open => {
        if (!open) {
          form.reset();
          setError(null);
        }
        onOpenChange(open);
      }}>
      <Modal.Container size="sm">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Change password</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <form.AppForm>
              <form.Form onChange={() => setError(null)}>
                <form.AppField name="currentPassword">
                  {field => (
                    <field.PasswordField
                      variant="secondary"
                      label="Current password"
                      autoComplete="current-password"
                      autoFocus
                    />
                  )}
                </form.AppField>
                <form.AppField name="newPassword">
                  {field => (
                    <field.PasswordField
                      variant="secondary"
                      label="New password"
                      autoComplete="new-password"
                    />
                  )}
                </form.AppField>
                <FormError error={error} />
              </form.Form>
            </form.AppForm>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="tertiary">
              Cancel
            </Button>
            <form.AppForm>
              <form.SubmitButton>Change password</form.SubmitButton>
            </form.AppForm>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </ControlledModal>
  );
}

/** Accounts made with Google have no password; send a link to set one, like a reset. */
function SetPasswordDialog({
  email,
  isOpen,
  onOpenChange,
}: {
  email: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [isSending, setIsSending] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const send = async () => {
    setError(null);
    setIsSending(true);
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
      fetchOptions: {headers: captchaHeaders(token)},
    });
    setIsSending(false);
    if (result.error) {
      turnstileRef.current?.reset();
      setError(authErrorMessage(result.error, "Couldn't send the email."));
      return;
    }
    toast.success(`Check ${email} for a link to set your password.`);
    onOpenChange(false);
  };
  return (
    <ControlledModal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="sm">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Set a password</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <p className="text-muted text-sm">
              We'll email a link to <span className="text-foreground">{email}</span> to choose a
              password, so you can also log in without Google.
            </p>
            <Captcha ref={turnstileRef} onToken={setToken} />
            <FormError error={error} />
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="tertiary">
              Cancel
            </Button>
            <Button isPending={isSending} onPress={() => void send()}>
              Send link
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </ControlledModal>
  );
}

/** A readable "Chrome on macOS" from a user agent string. */
function describeDevice(userAgent: string | null | undefined) {
  const ua = userAgent ?? "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : null;
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  const isMobile = /iPhone|Android.+Mobile/.test(ua);
  const name = browser && os ? `${browser} on ${os}` : (browser ?? os ?? "Unknown device");
  return {name, isMobile};
}

/** Where this account is signed in, with a way to sign out the others. */
export function SessionsCard({currentToken}: {currentToken: string}) {
  const queryClient = useQueryClient();
  const sessions = useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: async () => {
      const {data, error} = await authClient.listSessions();
      if (error) throw new Error(error.message);
      // This device first, then the most recently active.
      return data.toSorted(
        (a, b) =>
          Number(b.token === currentToken) - Number(a.token === currentToken) ||
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    },
  });
  const refresh = () => queryClient.invalidateQueries({queryKey: SESSIONS_KEY});

  const revoke = async (token: string) => {
    const {error} = await authClient.revokeSession({token});
    if (error) toast.error(authErrorMessage(error, "Couldn't sign out that device."));
    await refresh();
  };
  const revokeOthers = async () => {
    const {error} = await authClient.revokeOtherSessions();
    if (error) toast.error(authErrorMessage(error, "Couldn't sign out the other devices."));
    else toast.success("Signed out of all other devices");
    await refresh();
  };
  const others = (sessions.data ?? []).filter(session => session.token !== currentToken);

  return (
    <Card>
      <Card.Header>
        <Card.Title>Sessions</Card.Title>
        <Card.Description>
          Devices where you're logged in. Sign out any you don't recognise, or that you used at hunt
          HQ.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        {sessions.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ) : (
          (sessions.data ?? []).map((session, i) => {
            const device = describeDevice(session.userAgent);
            const isCurrent = session.token === currentToken;
            return (
              <Fragment key={session.id}>
                {i > 0 && <Separator />}
                <MethodRow
                  icon={device.isMobile ? <SmartphoneIcon /> : <LaptopIcon />}
                  title={device.name}
                  description={
                    <>
                      {isCurrent
                        ? "Active now"
                        : `Last active ${new Date(session.updatedAt).toLocaleString()}`}
                      {session.ipAddress ? ` · ${session.ipAddress}` : ""}
                    </>
                  }>
                  {isCurrent ? (
                    <Chip size="sm" variant="soft" color="success">
                      This device
                    </Chip>
                  ) : (
                    <Button size="sm" variant="tertiary" onPress={() => void revoke(session.token)}>
                      Sign out
                    </Button>
                  )}
                </MethodRow>
              </Fragment>
            );
          })
        )}
      </Card.Content>
      {others.length > 0 && (
        <Card.Footer>
          <Button variant="secondary" onPress={() => void revokeOthers()}>
            Sign out of all other devices
          </Button>
        </Card.Footer>
      )}
    </Card>
  );
}

/** Permanently deleting the account; the person's past activity stays, as "Deleted user". */
export function DangerZoneCard() {
  const router = useRouter();
  const providers = useLinkedProviders();
  const hasPassword = providers.data?.has("credential") ?? false;
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: {password: "", confirm: ""},
    onSubmit: async ({value}) => {
      setError(null);
      if (value.confirm.trim().toLowerCase() !== "delete") {
        setError('Type "delete" to confirm.');
        return;
      }
      const result = await authClient.deleteUser(hasPassword ? {password: value.password} : {});
      if (result.error) {
        const message = result.error.message ?? "";
        setError(
          /fresh|expired|re-?auth/i.test(message)
            ? "For your security, log out and back in, then try again."
            : authErrorMessage(result.error, "Couldn't delete your account.")
        );
        return;
      }
      toast.success("Your account has been deleted.");
      await router.navigate({to: "/"});
    },
  });
  return (
    <Card className="border-danger/40 border">
      <Card.Header>
        <Card.Title>Delete account</Card.Title>
        <Card.Description>
          Permanently delete your account and leave all your workspaces. Your past activity in them
          stays, shown as "Deleted user". This can't be undone.
        </Card.Description>
      </Card.Header>
      <Card.Footer>
        <Button variant="danger-soft" onPress={() => setIsOpen(true)}>
          Delete account…
        </Button>
      </Card.Footer>
      <ControlledAlertDialog
        isOpen={isOpen}
        onOpenChange={open => {
          if (!open) {
            form.reset();
            setError(null);
          }
          setIsOpen(open);
        }}>
        <AlertDialog.Container size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>Delete your account?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <form.AppForm>
                <form.Form onChange={() => setError(null)}>
                  <p className="text-muted text-sm">
                    You'll be signed out and removed from every workspace. This can't be undone.
                  </p>
                  {hasPassword && (
                    <form.AppField name="password">
                      {field => (
                        <field.PasswordField
                          variant="secondary"
                          label="Password"
                          autoComplete="current-password"
                        />
                      )}
                    </form.AppField>
                  )}
                  <form.AppField name="confirm">
                    {field => (
                      <field.TextField
                        variant="secondary"
                        label='Type "delete" to confirm'
                        autoComplete="off"
                      />
                    )}
                  </form.AppField>
                  <FormError error={error} />
                </form.Form>
              </form.AppForm>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Cancel
              </Button>
              <form.AppForm>
                <form.SubmitButton variant="danger">Delete account</form.SubmitButton>
              </form.AppForm>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </ControlledAlertDialog>
    </Card>
  );
}
