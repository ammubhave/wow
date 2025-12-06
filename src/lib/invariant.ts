import {ORPCError} from "@orpc/client";

export function invariant(condition: any, message?: string): asserts condition {
  if (!condition) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {message});
  }
}
