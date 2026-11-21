-- Reviewed create-only migration for the empty Prisma schema.
-- Apply only after confirming the target Neon database is ready.
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "CmsRevisionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "CmsPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "draftMeta" JSONB,
    "publishedMeta" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CmsPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CmsSection" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "draftContent" JSONB NOT NULL,
    "publishedContent" JSONB,
    "draftOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedOrder" INTEGER,
    "draftIsVisible" BOOLEAN NOT NULL DEFAULT true,
    "publishedIsVisible" BOOLEAN NOT NULL DEFAULT false,
    "draftUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CmsSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CmsSectionRevision" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CmsRevisionStatus" NOT NULL,
    "content" JSONB NOT NULL,
    "order" INTEGER NOT NULL,
    "isVisible" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CmsSectionRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CmsPage_slug_key" ON "CmsPage"("slug");
CREATE INDEX "CmsPage_publishedAt_idx" ON "CmsPage"("publishedAt");
CREATE INDEX "CmsSection_pageId_draftOrder_idx" ON "CmsSection"("pageId", "draftOrder");
CREATE INDEX "CmsSection_pageId_publishedOrder_publishedIsVisible_idx" ON "CmsSection"("pageId", "publishedOrder", "publishedIsVisible");
CREATE INDEX "CmsSection_type_idx" ON "CmsSection"("type");
CREATE INDEX "CmsSectionRevision_sectionId_status_idx" ON "CmsSectionRevision"("sectionId", "status");
CREATE UNIQUE INDEX "CmsSectionRevision_sectionId_version_key" ON "CmsSectionRevision"("sectionId", "version");

ALTER TABLE "CmsSection" ADD CONSTRAINT "CmsSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "CmsPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CmsSectionRevision" ADD CONSTRAINT "CmsSectionRevision_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CmsSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
