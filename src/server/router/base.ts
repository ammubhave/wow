import {ORPCError, os} from "@orpc/server";

import {auth} from "@/lib/auth";

import {ActivityLogService} from "./services/activity-log";
import {DiscordService} from "./services/discord";
import {GoogleService} from "./services/google";
import {NotificationService} from "./services/notification";

export type Context = {headers: Headers};

export type AuthenticatedContext = Omit<Context, "user"> & {
  session: typeof auth.$Infer.Session;
  google: GoogleService;
  activityLog: ActivityLogService;
  discord: DiscordService;
  notification: NotificationService;
};

const base = os.$context<Context>();

export const procedure = base.use(async ({context: ctx, next}) => {
  const session = await auth.api.getSession({headers: ctx.headers});
  if (!session) {
    throw new ORPCError("UNAUTHORIZED");
  }
  const context = {...ctx, session} as unknown as AuthenticatedContext;
  context.google = new GoogleService();
  context.activityLog = new ActivityLogService(context);
  context.discord = new DiscordService();
  context.notification = new NotificationService();

  return next({context});
});

export const preauthorize = base.middleware(
  async ({context, next}, input: {workspaceId: string}) => {
    const workspace = await auth.api.getFullOrganization({
      headers: context.headers,
      query: {organizationSlug: input.workspaceId},
      returnStatus: true,
    });
    if (!workspace.response) throw new ORPCError("NOT_FOUND");
    return next({context: {workspace: workspace.response}});
  }
);
