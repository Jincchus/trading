-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "purchasePrice" REAL NOT NULL,
    "purchaseDate" DATETIME NOT NULL,
    "alpacaOrderId" TEXT NOT NULL,
    "soldQuantity" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "strategyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lot_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3b82f6'
);

-- CreateTable
CREATE TABLE "StockCategory" (
    "ticker" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    PRIMARY KEY ("ticker", "categoryId"),
    CONSTRAINT "StockCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "StrategyRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threshold" REAL NOT NULL,
    "sellPct" REAL NOT NULL,
    "strategyId" TEXT NOT NULL,
    CONSTRAINT "StrategyRule_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FxRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "krwAmount" REAL NOT NULL,
    "exchangeRate" REAL NOT NULL,
    "usdAmount" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TaxRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "acquireDate" DATETIME NOT NULL,
    "acquirePrice" REAL NOT NULL,
    "acquireRate" REAL NOT NULL,
    "saleDate" DATETIME NOT NULL,
    "salePrice" REAL NOT NULL,
    "saleRate" REAL NOT NULL,
    "quantity" REAL NOT NULL,
    "gainKrw" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxRecord_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "targetPrice" REAL NOT NULL,
    "direction" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AlertHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alertId" TEXT NOT NULL,
    "triggeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price" REAL NOT NULL,
    CONSTRAINT "AlertHistory_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Lot_alpacaOrderId_key" ON "Lot"("alpacaOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
