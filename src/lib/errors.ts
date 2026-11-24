import {ORPCError} from "@orpc/client";

/** oRPC's message when a procedure gives none: the code in words ("Not Found"). */
const defaultMessage = (code: string) =>
  code
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

/**
 * What to tell someone when a call fails: the server's own message when it wrote one for people
 * ("That workspace ID is taken."), otherwise `fallback`, which says what didn't work.
 */
export function errorMessage(error: unknown, fallback: string) {
  if (
    error instanceof ORPCError &&
    error.code !== "INTERNAL_SERVER_ERROR" &&
    error.message !== defaultMessage(error.code) &&
    // Input that failed the procedure's schema: the form's own checks should have caught it.
    error.message !== "Input validation failed"
  ) {
    return error.message;
  }
  return fallback;
}
