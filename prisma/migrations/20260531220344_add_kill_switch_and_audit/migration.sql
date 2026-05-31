-- CreateTable
CREATE TABLE "TradingSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "tradingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OrderAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "clientOrderId" TEXT,
    "ticker" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "request" TEXT NOT NULL,
    "alpacaOrderId" TEXT,
    "status" TEXT,
    "filledQty" TEXT,
    "filledPrice" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
