import { isIP } from 'node:net';

type RateLimitRequest = {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
};

/**
 * Railway's public edge sanitizes X-Real-IP for public ingress. Express req.ip
 * cannot use that header directly, so opt into it only for Railway public traffic.
 */
export function getRateLimitClientIp(request: RateLimitRequest, trustRailwayRealIp = false): string {
  const railwayIp = request.headers['x-real-ip'];
  if (trustRailwayRealIp && typeof railwayIp === 'string' && isIP(railwayIp)) return railwayIp;
  return request.ip ?? 'unknown';
}
