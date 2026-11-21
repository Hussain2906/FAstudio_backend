CREATE TABLE "ContactDeliverySettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "smtpHost" TEXT NOT NULL DEFAULT '',
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "smtpUsername" TEXT NOT NULL DEFAULT '',
    "smtpPasswordEncrypted" TEXT,
    "fromEmail" TEXT NOT NULL DEFAULT '',
    "fromName" TEXT NOT NULL DEFAULT 'FA Studio',
    "recipientEmail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactDeliverySettings_pkey" PRIMARY KEY ("id")
);
