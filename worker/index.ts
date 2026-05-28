export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return new Response("Not implemented", { status: 501 });
    }
    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler;
