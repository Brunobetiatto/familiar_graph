-- Store an exact narrative for requested and approved global graph connections.
ALTER TABLE "NODE_REQUEST_CONN" ADD COLUMN "description" TEXT;

ALTER TABLE "GLOBAL_EDGE" ADD COLUMN "description" TEXT;
