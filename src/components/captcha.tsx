import {Turnstile, type TurnstileInstance} from "@marsidev/react-turnstile";
import type {Ref} from "react";

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
  if (!siteKey) return null;
  return (
    <Turnstile
      ref={ref}
      siteKey={siteKey}
      options={{theme: theme === "system" ? "auto" : theme, size: "flexible"}}
      onSuccess={onToken}
      onExpire={() => onToken("")}
    />
  );
}
