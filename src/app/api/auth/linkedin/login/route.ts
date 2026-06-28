import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const client_id = process.env.LINKEDIN_CLIENT_ID;
  if (!client_id) {
    return NextResponse.json({ error: 'LINKEDIN_CLIENT_ID not configured in .env' }, { status: 500 });
  }

  // Dynamically resolve redirect URI to support both localhost and remote deployment environment URLs
  const host = request.headers.get('host') || 'exhibition-explorer.duckdns.org';
  const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
  const redirect_uri = `${protocol}://${host}/api/auth/linkedin/callback`;

  const scope = 'openid profile email';
  const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${encodeURIComponent(client_id)}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scope)}&state=linkedin_oauth_state`;

  return NextResponse.redirect(url);
}
