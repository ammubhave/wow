-- CreateTable
CREATE TABLE "ActivityLogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    CONSTRAINT "ActivityLogEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityLogEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoundActivityLogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT,
    "roundName" TEXT NOT NULL,
    "subType" TEXT NOT NULL,
    CONSTRAINT "RoundActivityLogEntry_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RoundActivityLogEntry_id_fkey" FOREIGN KEY ("id") REFERENCES "ActivityLogEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PuzzleActivityLogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "puzzleId" TEXT,
    "puzzleName" TEXT NOT NULL,
    "subType" TEXT NOT NULL,
    CONSTRAINT "PuzzleActivityLogEntry_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PuzzleActivityLogEntry_id_fkey" FOREIGN KEY ("id") REFERENCES "ActivityLogEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
