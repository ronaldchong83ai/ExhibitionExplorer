import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getData, saveData, generateId } from '@/lib/db';
import { createSessionValue } from '@/lib/auth';
import type { User } from '@/types';

export async function GET(request: NextRequest) {
  // Dynamically resolve redirect URI to support both localhost and remote deployment environment URLs
  const host = request.headers.get('host') || 'exhibition-explorer.duckdns.org';
  const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;
  const redirect_uri = `${baseUrl}/api/auth/linkedin/callback`;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, baseUrl));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=No+code+provided', baseUrl));
  }

  const client_id = process.env.LINKEDIN_CLIENT_ID;
  const client_secret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!client_id || !client_secret) {
    return NextResponse.json({ error: 'OAuth credentials not configured' }, { status: 500 });
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id,
        client_secret,
        redirect_uri
      })
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`, baseUrl));
    }

    const { access_token } = tokenData;
    if (!access_token) {
      return NextResponse.redirect(new URL('/login?error=Failed+to+retrieve+access+token', baseUrl));
    }

    // 2. Fetch user profile info from LinkedIn UserInfo endpoint
    const userinfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    const linkedinUser = await userinfoRes.json();
    if (!linkedinUser.email) {
      return NextResponse.redirect(new URL('/login?error=Failed+to+retrieve+email+from+LinkedIn', baseUrl));
    }

    const email = linkedinUser.email.toLowerCase();
    const name = linkedinUser.name || `${linkedinUser.given_name || ''} ${linkedinUser.family_name || ''}`.trim() || 'LinkedIn User';
    const profilePic = linkedinUser.picture || null;

    // 3. Find or create user in DB
    const data = await getData();
    let user = data.users.find(u => u.email.toLowerCase() === email);

    if (!user) {
      // Create new user
      const newUser: User = {
        id: generateId(),
        name,
        email,
        contact: '',
        passwordHash: 'linkedin_oauth_placeholder',
        role: 'VISITOR',
        provider: 'LINKEDIN',
        profilePic,
        createdAt: new Date().toISOString()
      };
      data.users.push(newUser);
      await saveData(data);
      user = newUser;
    } else {
      // Update provider to LINKEDIN or picture if needed
      let updated = false;
      if (user.provider !== 'LINKEDIN') {
        user.provider = 'LINKEDIN';
        updated = true;
      }
      if (profilePic && user.profilePic !== profilePic) {
        user.profilePic = profilePic;
        updated = true;
      }
      if (updated) {
        await saveData(data);
      }
    }

    // 4. Create and set cookie session
    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    const cookieStore = await cookies();
    cookieStore.set('exhibition_session', createSessionValue(sessionUser), {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    });

    return NextResponse.redirect(new URL('/home', baseUrl));
  } catch (err: any) {
    console.error('LinkedIn OAuth Callback Error:', err);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(err.message || 'OAuth validation error')}`, baseUrl));
  }
}
