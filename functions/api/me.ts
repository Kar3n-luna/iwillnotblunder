import { Env, json, parseCookies, verifySessionCookie } from '../_utils';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const cookies = parseCookies(ctx.request);
  const session = await verifySessionCookie(cookies['session'] || null, ctx.env.SESSION_SECRET);
  if (!session) return json({ authenticated: false });
  const row = await ctx.env.DB.prepare(
    `SELECT u.id, u.username, u.title, s.id as session_id, s.provider
     FROM auth_sessions s JOIN auth_users u ON s.user_id = u.id WHERE s.id = ?1`
  ).bind(String((session as any).sid)).first<any>();
  if (!row) return json({ authenticated: false });
  return json({ authenticated: true, user: { id: row.id, username: row.username, title: row.title } });
};


