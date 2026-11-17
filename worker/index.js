// Programme Cloudflare du site.
// - /api/donnees : relais vers le tableau Google (adresse cachée dans la variable APPS_SCRIPT_URL).
// - tout le reste : les pages du dossier "site".
import { onRequestGet, onRequestPost } from "../functions/api/donnees.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/donnees") {
      const context = { request, env, waitUntil: (p) => ctx.waitUntil(p) };
      if (request.method === "GET") return onRequestGet(context);
      if (request.method === "POST") return onRequestPost(context);
      return new Response("Méthode non autorisée", { status: 405 });
    }
    return env.ASSETS.fetch(request);
  }
};
