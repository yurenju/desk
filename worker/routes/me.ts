import { withSession } from "../middleware/session";
import { getWhoami } from "../wspc";

interface Env {
  DESK_KV: KVNamespace;
}

export async function handleMe(request: Request, env: Env): Promise<Response> {
  return withSession(request, env, async (accessToken) => {
    const me = await getWhoami(accessToken);
    return new Response(
      JSON.stringify({
        user_id: me.userId,
        email: me.email,
        display_name: me.displayName,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });
}
