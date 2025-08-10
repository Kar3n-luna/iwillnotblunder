import { Env, exchangeCodeForToken, fetchLichessProfile, createSessionCookie, readPkceCookie, json } from '../../_utils';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const code = url.searchParams.get('code');
  if (!code) return new Response('Missing code', { status: 400 });

  const pkce = await readPkceCookie(ctx.request, ctx.env.SESSION_SECRET);
  if (!pkce) return json({ error: 'missing pkce cookie' }, { status: 400 });
  const returnedState = url.searchParams.get('state') || '';
  if (returnedState !== pkce.state) return json({ error: 'state mismatch' }, { status: 400 });

  const token = await exchangeCodeForToken(code, pkce.code_verifier, ctx.env);
  const profile = await fetchLichessProfile(token.access_token);

  const userId = String(profile.id || profile.user?.id || profile.username);
  const username = String(profile.username || profile.name || 'unknown');
  const title = profile.title || null;
  const createdAt = new Date().toISOString();

  await ctx.env.DB.prepare(
    `INSERT INTO auth_users (id, username, title, created_at) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(id) DO UPDATE SET username=excluded.username, title=excluded.title`
  ).bind(userId, username, title, createdAt).run();

  const sessionId = crypto.randomUUID();
  await ctx.env.DB.prepare(
    `INSERT INTO auth_sessions (id, user_id, provider, access_token, refresh_token, scope, expires_at, created_at)
     VALUES (?1, ?2, 'lichess', ?3, ?4, ?5, ?6, ?7)`
  ).bind(
    sessionId,
    userId,
    token.access_token,
    token.refresh_token || null,
    token.scope || 'board:play',
    token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
    createdAt
  ).run();

  const cookiePayload = { sid: sessionId, uid: userId, u: username };
  const cookieVal = await createSessionCookie(cookiePayload, ctx.env.SESSION_SECRET);
  const headers = new Headers({ Location: '/' });
  headers.append('Set-Cookie', `session=${encodeURIComponent(cookieVal)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
  headers.append('Set-Cookie', `pkce=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  return new Response(null, { status: 302, headers });
};


