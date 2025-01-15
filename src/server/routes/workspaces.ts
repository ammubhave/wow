import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { procedure, router } from "../trpc";

export const workspacesRouter = router({
  list: procedure.query(async ({ ctx }) => {
    const workspaces = await ctx.db.workspace.findMany({
      select: {
        id: true,
        teamName: true,
        eventName: true,
        googleAccessToken: true,
        googleFolderId: true,
        googleTemplateFileId: true,
        comment: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return workspaces.map(
      ({
        googleAccessToken,
        googleFolderId,
        googleTemplateFileId,
        ...workspace
      }) => ({
        ...workspace,
        isOnboarding: googleAccessToken === null || googleFolderId === null,
      }),
    );
  }),

  get: procedure.input(z.string()).query(async ({ ctx, input }) => {
    const { googleFolderId, googleTemplateFileId, ...workspace } =
      await ctx.db.workspace.findFirstOrThrow({
        select: {
          id: true,
          teamName: true,
          eventName: true,
          password: true,
          links: true,
          googleFolderId: true,
          googleTemplateFileId: true,
          comment: true,
        },
        where: {
          id: input,
        },
      });
    let googleAccessToken = null;
    try {
      googleAccessToken = await ctx.getGoogleToken(workspace.id);
    } catch (e) {
      console.error(e);
    }
    return {
      ...workspace,
      isOnboarding: googleAccessToken === null || googleFolderId === null,
    };
  }),

  join: procedure
    .input(
      z.object({
        workspaceId: z.string(),
        password: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await ctx.prisma.workspace.findFirstOrThrow({
        where: {
          id: input.workspaceId,
          password: input.password,
        },
      });
      await ctx.db.workspaceMembership.create({
        data: {
          userId: ctx.user.id,
          workspaceId: workspace.id,
        },
      });

      const googleAccessToken = await ctx.getGoogleToken(workspace.id);
      ctx.waitUntil(
        (async () => {
          const resp = await fetch(
            `https://www.googleapis.com/drive/v3/files/${workspace.googleFolderId}/permissions?sendNotificationEmail=false`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${googleAccessToken}`,
              },
              body: JSON.stringify({
                type: "user",
                emailAddress: ctx.user.email,
                role: "writer",
              }),
            },
          );
          if (!resp.ok) {
            throw new Error(
              `Failed to share folder ${workspace.googleFolderId} for user ${ctx.user.email}: ${resp.status}: ${resp.statusText}: ${await resp.text()}`,
            );
          }
        })(),
      );

      return workspace;
    }),

  create: procedure
    .input(
      z.object({
        teamName: z.string().min(1),
        eventName: z.string().min(1),
        workspaceId: z.string().min(1),
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await ctx.db.workspace.create({
        data: {
          id: input.workspaceId,
          password: input.password,
          teamName: input.teamName,
          eventName: input.eventName,
          memberships: {
            create: {
              userId: ctx.user.id,
            },
          },
        },
      });
      return workspace;
    }),

  update: procedure
    .input(
      z.object({
        id: z.string(),
        teamName: z.string().min(1).optional(),
        eventName: z.string().min(1).optional(),
        password: z.string().min(8).optional(),
        comment: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.workspace.update({
        data: {
          teamName: input.teamName,
          eventName: input.eventName,
          password: input.password,
          comment: input.comment,
        },
        where: {
          id: input.id,
        },
      });
      await ctx.broadcastNotification(input.id, {
        type: "notification",
        paths: [{ path: ["workspaces"] }],
      });
    }),

  updateLinks: procedure
    .input(
      z.object({
        id: z.string(),
        links: z.array(z.object({ name: z.string(), url: z.string().url() })),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(async (tx) => {
        await tx.workspaceLinks.deleteMany({
          where: {
            workspaceId: input.id,
          },
        });
        await Promise.all(
          input.links.map((link) =>
            tx.workspaceLinks.create({
              data: {
                workspaceId: input.id,
                url: link.url,
                name: link.name,
              },
            }),
          ),
        );
      });
      await ctx.broadcastNotification(input.id, {
        type: "notification",
        paths: [{ path: ["workspaces"] }],
      });
    }),

  delete: procedure.input(z.string()).mutation(async ({ ctx, input }) => {
    await ctx.db.workspace.delete({
      where: { id: input },
    });
    await ctx.broadcastNotification(input, {
      type: "notification",
      paths: [{ path: ["workspaces"] }],
    });
  }),

  leave: procedure.input(z.string()).mutation(async ({ ctx, input }) => {
    if (
      (await ctx.prisma.workspaceMembership.count({
        where: { workspaceId: input },
      })) === 1
    ) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Can't leave a workspace with only you in it.",
      });
    }
    await ctx.db.workspaceMembership.delete({
      where: {
        userId_workspaceId: {
          userId: ctx.user.id,
          workspaceId: input,
        },
      },
    });
  }),

  getGoogleTokenState: procedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const workspace = await ctx.db.workspace.findFirstOrThrow({
        where: { id: input },
      });
      const googleAccessToken = await ctx.getGoogleToken(workspace.id);
      if (!googleAccessToken) {
        return { state: 0 } as const;
      }
      let resp = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
        },
      });
      if (resp.status !== 200) {
        return { state: 0 } as const;
      }

      if (!workspace.googleFolderId) {
        return { state: 1 } as const;
      }
      resp = await fetch(
        `https://www.googleapis.com/drive/v3/files/${workspace.googleFolderId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
          },
        },
      );
      if (resp.status !== 200) {
        return { state: 1 } as const;
      }

      const folder = z
        .object({ id: z.string(), name: z.string() })
        .parse(await resp.json());
      const folderName = folder.name;
      const folderLink = `https://drive.google.com/drive/folders/${folder.id}`;
      if (!workspace.googleTemplateFileId) {
        return {
          state: 2,
          folderName,
          folderLink,
        } as const;
      }

      resp = await fetch(
        `https://www.googleapis.com/drive/v3/files/${workspace.googleTemplateFileId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
          },
        },
      );
      if (resp.status !== 200) {
        return { state: 2, folderName, folderLink } as const;
      }
      const file = z
        .object({ id: z.string(), name: z.string() })
        .parse(await resp.json());
      const fileName = file.name;
      const fileLink = `https://docs.google.com/spreadsheets/d/${file.id}/edit?gid=0#gid=0`;
      return { state: 3, folderName, folderLink, fileName, fileLink } as const;
    }),

  setGoogleFolderId: procedure
    .input(
      z.object({
        id: z.string(),
        folderId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.workspace.update({
        where: { id: input.id },
        data: {
          googleFolderId: input.folderId,
        },
      });
      await ctx.broadcastNotification(input.id, {
        type: "notification",
        paths: [{ path: ["workspaces"] }],
      });
    }),

  setGoogleTemplateFileId: procedure
    .input(
      z.object({
        id: z.string(),
        fileId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.workspace.update({
        where: { id: input.id },
        data: {
          googleTemplateFileId: input.fileId,
        },
      });
      await ctx.broadcastNotification(input.id, {
        type: "notification",
        paths: [{ path: ["workspaces"] }],
      });
    }),

  shareGoogleDriveFolder: procedure
    .input(
      z.object({
        workspaceId: z.string(),
        email: z.string().email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await ctx.db.workspace.findFirstOrThrow({
        select: { googleFolderId: true },
        where: { id: input.workspaceId },
      });
      const googleAccessToken = await ctx.getGoogleToken(input.workspaceId);
      if (!workspace.googleFolderId || !googleAccessToken) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Google drive connection is not correctly configured.",
        });
      }
      const { id: permissionId } = z
        .object({ kind: z.literal("drive#permissionId"), id: z.string() })
        .parse(
          await (
            await fetch(
              `https://www.googleapis.com/drive/v2/permissionIds/${input.email}`,
              {
                method: "GET",
                headers: {
                  Authorization: `Bearer ${googleAccessToken}`,
                },
              },
            )
          ).json(),
        );
      await fetch(
        `https://www.googleapis.com/drive/v2/files/${
          workspace.googleFolderId
        }/permissions?${
          new URLSearchParams({
            sendNotificationEmails: "false",
          }).toString
        }`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: permissionId,
            role: "writer",
            type: "user",
          }),
        },
      );
    }),

  getDiscordInfo: procedure.input(z.string()).query(async ({ ctx, input }) => {
    const workspace = await ctx.db.workspace.findFirstOrThrow({
      where: { id: input },
    });
    if (!workspace.discordGuildId) {
      return null;
    }
    const guild = await fetch(
      `https://discord.com/api/v10/guilds/${workspace.discordGuildId}`,
      {
        method: "GET",
        headers: {
          authorization: `Bot ${ctx.env.DISCORD_BOT_TOKEN}`,
        },
      },
    );
    if (guild.status !== 200) {
      const responseText = await guild.text();
      let error: string;
      try {
        const responseJson = JSON.parse(responseText);
        const responseJsonParsed = z
          .object({
            code: z.number(),
            message: z.string(),
          })
          .parse(responseJson);
        error = `${responseJsonParsed.code}: ${responseJsonParsed.message}`;
      } catch (_e) {
        error = responseText;
      }
      return { ok: false, error } as const;
    }
    return {
      ok: true,
      data: z
        .object({
          id: z.string(),
          name: z.string(),
        })
        .parse(await guild.json()),
    } as const;
  }),
});
