-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY
);

-- CreateTable
CREATE TABLE "WorkspaceMembership" (
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    CONSTRAINT "WorkspaceMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "teamName" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT 'No comment set.',
    "googleAccessToken" TEXT,
    "googleRefreshToken" TEXT,
    "googleTokenExpiresAt" DATETIME,
    "googleFolderId" TEXT,
    "googleTemplateFileId" TEXT,
    "discordGuildId" TEXT
);

-- CreateTable
CREATE TABLE "WorkspaceLinks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    CONSTRAINT "WorkspaceLinks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Round_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Puzzle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "link" TEXT,
    "googleSpreadsheetId" TEXT,
    "answer" TEXT,
    "status" TEXT,
    "importance" TEXT,
    "comment" TEXT NOT NULL DEFAULT 'No comment set.',
    "roundId" TEXT NOT NULL,
    "isMetaPuzzle" BOOLEAN NOT NULL,
    "parentPuzzleId" TEXT,
    CONSTRAINT "Puzzle_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Puzzle_parentPuzzleId_fkey" FOREIGN KEY ("parentPuzzleId") REFERENCES "Puzzle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMembership_userId_workspaceId_key" ON "WorkspaceMembership"("userId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_password_key" ON "Workspace"("password");
