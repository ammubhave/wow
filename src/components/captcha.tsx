import {Turnstile, type TurnstileInstance} from "@marsidev/react-turnstile";
import {type Ref, useState} from "react";

import {useTheme} from "@/components/theme-provider";

/**
 * Turnstile is optional: when `VITE_PUBLIC_TURNSTILE_SITE_KEY` is unset (e.g. local dev) the widget
 * isn't rendered and no captcha header is sent. The server only enables its captcha plugin when
 * `TURNSTILE_SECRET_KEY` is set, so leave both unset to disable captcha entirely.
 */
const siteKey: string | undefined = import.meta.env.VITE_PUBLIC_TURNSTILE_SITE_KEY || undefined;

export function captchaHeaders(token: string): Record<string, string> | undefined {
  return siteKey && token ? {"x-captcha-response": token} : undefined;
}

export function Captcha({
  ref,
  onToken,
}: {
  ref?: Ref<TurnstileInstance | null>;
  onToken: (token: string) => void;
}) {
  const {theme} = useTheme();
  // Invisible until Cloudflare asks for a click; until then, collapse it so the form's gap
  // doesn't leave an empty row where it sits.
  const [isInteractive, setIsInteractive] = useState(false);
  if (!siteKey) return null;
  return (
    <Turnstile
      className={isInteractive ? undefined : "-mt-4 h-0 overflow-hidden"}
      onBeforeInteractive={() => setIsInteractive(true)}
      onAfterInteractive={() => setIsInteractive(false)}
      ref={ref}
      siteKey={siteKey}
      // "interaction-only": the check runs invisibly and the widget only appears on the rare
      // occasion Cloudflare needs the visitor to click it.
      options={{
        theme: theme === "system" ? "auto" : theme,
        size: "flexible",
        appearance: "interaction-only",
      }}
      onSuccess={onToken}
      onExpire={() => onToken("")}
    />
  );
}
