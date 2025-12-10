import type { APIRoute } from 'astro';

// Setea la cookie sb-access-token para que el layout admin pueda leerla
export const POST: APIRoute = async ({ request }) => {
  try {
    const { token } = await request.json();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Falta token' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    // Cookie por 1 día, no HttpOnly para que Astro la lea
    headers.append(
      'Set-Cookie',
      `sb-access-token=${token}; Path=/; Max-Age=86400; SameSite=Lax`
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al setear cookie' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

