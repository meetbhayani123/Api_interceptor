import { NextResponse } from 'next/server';

/**
 * POST /api/import
 *
 * This Vercel route acts as a thin proxy to the Render backend's
 * /api/match/import endpoint.
 *
 * WHY: Vercel serverless functions run on AWS datacenter IPs which are
 * blocked by Cloudflare WAF when calling api.11xplay.pink directly.
 * The Render backend (OddsService) has retry logic, header rotation,
 * and optional ScraperAPI proxy fallback to bypass WAF reliably.
 */

function getBackendUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.BACKEND_URL ||
    'http://localhost:3001'
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const backendUrl = getBackendUrl();

    console.log(`[import/route] Proxying import request to ${backendUrl}/api/match/import`);

    const response = await fetch(`${backendUrl}/api/match/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('[import/route] Proxy error:', error.message);
    return NextResponse.json(
      {
        error: `Failed to proxy import to backend: ${error.message}`,
        hint: 'Make sure NEXT_PUBLIC_API_URL is set to your Render backend URL (e.g. https://antigravity-server.onrender.com)',
      },
      { status: 502 }
    );
  }
}