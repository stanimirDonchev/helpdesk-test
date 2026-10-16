-- AlterTable
ALTER TABLE "reply" ADD COLUMN     "emailMessageId" TEXT,
ADD COLUMN     "messageId" TEXT;

-- AlterTable
ALTER TABLE "ticket" ADD COLUMN     "emailMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "reply_messageId_key" ON "reply"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "reply_emailMessageId_key" ON "reply"("emailMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_emailMessageId_key" ON "ticket"("emailMessageId");

