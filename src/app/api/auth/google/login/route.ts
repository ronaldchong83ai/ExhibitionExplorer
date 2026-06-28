import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const client_id = process.env.GOOGLE_CLIENT_ID;
  if (!client_id) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID not configured in .env' }, { status: 500 });
  }

  // Dynamically resolve redirect URI to support both localhost and remote deployment environment URLs
  const host = request.headers.get('host') || 'exhibition-explorer.duckdns.org';
  const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
  const redirect_uri = `${protocol}://${host}/api/auth/google/callback`;

  const scope = 'openid profile email';
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(client_id)}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=google_oauth_state`;

  return NextResponse.redirect(url);
}
