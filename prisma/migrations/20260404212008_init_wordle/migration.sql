-- CreateTable
CREATE TABLE "WordleResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "loggedAt" DATETIME NOT NULL,
    "gameType" TEXT NOT NULL,
    "puzzleDay" INTEGER NOT NULL,
    "tries" INTEGER,
    "maxTries" INTEGER NOT NULL,
    "attempts" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "WordleResult_userId_gameType_puzzleDay_key" ON "WordleResult"("userId", "gameType", "puzzleDay");
