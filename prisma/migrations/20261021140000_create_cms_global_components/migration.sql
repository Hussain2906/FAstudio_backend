CREATE TABLE "CmsGlobalComponent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "draftContent" JSONB NOT NULL,
    "publishedContent" JSONB,
    "publishedAt" TIMESTAMP(3),
    "draftUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CmsGlobalComponent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CmsGlobalComponentRevision" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CmsRevisionStatus" NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CmsGlobalComponentRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CmsGlobalComponent_type_key" ON "CmsGlobalComponent"("type");
CREATE INDEX "CmsGlobalComponent_type_idx" ON "CmsGlobalComponent"("type");
CREATE UNIQUE INDEX "CmsGlobalComponentRevision_componentId_version_key" ON "CmsGlobalComponentRevision"("componentId", "version");
CREATE INDEX "CmsGlobalComponentRevision_componentId_status_idx" ON "CmsGlobalComponentRevision"("componentId", "status");
ALTER TABLE "CmsGlobalComponentRevision" ADD CONSTRAINT "CmsGlobalComponentRevision_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "CmsGlobalComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
