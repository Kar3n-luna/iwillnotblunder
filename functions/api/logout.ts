import { Env, parseCookies, verifySessionCookie } from '../_utils';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const cookies = parseCookies(ctx.request);
  const sess = await verifySessionCookie(cookies['session'] || null, ctx.env.SESSION_SECRET);
  if (sess) await ctx.env.DB.prepare(`DELETE FROM auth_sessions WHERE id = ?1`).bind(String((sess as any).sid)).run();
  return new Response(null, { status: 204, headers: { 'Set-Cookie': 'session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax' } });
};


