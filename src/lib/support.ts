import {track} from "./analytics";

/** Where people chip in to keep WOW free (Buy Me a Coffee). */
export const SUPPORT_URL = "https://www.buymeacoffee.com/amolbhave";

/** Which "chip in" link was used, so we can see which place works. */
export type SupportPlace = "account_menu" | "footer" | "recap" | "docs";

export const trackSupportClick = (place: SupportPlace, properties?: Record<string, unknown>) =>
  track("support_clicked", {place, ...properties});
