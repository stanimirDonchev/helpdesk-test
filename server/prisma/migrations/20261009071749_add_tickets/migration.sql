-- CreateTable
CREATE TABLE "ticket" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "category" TEXT,
    "senderEmail" TEXT NOT NULL,
    "senderName" TEXT,
    "messageId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'postmark',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reply" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_messageId_key" ON "ticket"("messageId");

-- CreateIndex
CREATE INDEX "ticket_status_receivedAt_idx" ON "ticket"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "reply_ticketId_createdAt_idx" ON "reply"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "reply" ADD CONSTRAINT "reply_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
