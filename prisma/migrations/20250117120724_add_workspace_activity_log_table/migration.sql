-- CreateTable
CREATE TABLE "WorkspaceActivityLogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subType" TEXT NOT NULL,
    CONSTRAINT "WorkspaceActivityLogEntry_id_fkey" FOREIGN KEY ("id") REFERENCES "ActivityLogEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
