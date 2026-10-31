import { createFeedHandler } from "@/lib/imovelweb/http";
import { getFeedProperties } from "@/lib/imovelweb/properties";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  return createFeedHandler({
    env: process.env,
    loadProperties: getFeedProperties,
  })(request);
}

export async function HEAD(request: Request) {
  return GET(request);
}
