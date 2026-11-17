// Relais Cloudflare : le site appelle /api/donnees, jamais Google directement.
// L'adresse du programme du tableau est rangée dans Cloudflare, dans la variable APPS_SCRIPT_URL
// (Paramètres > Variables et secrets). Elle n'apparaît jamais dans le code du site.
//
// GET  /api/donnees : renvoie la carte, les horaires, l'ardoise… instantanément (copie gardée en mémoire,
//                     rafraîchie en arrière-plan chaque minute).
// POST /api/donnees : transmet une réservation au tableau.

const FRAICHEUR_MS = 60 * 1000;   // au-delà d'1 minute, on rafraîchit en arrière-plan
let memoire = null;                // copie de secours dans la mémoire du serveur

const entetes = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: entetes });

function adresse(env) {
  const u = String(env.APPS_SCRIPT_URL || "").trim().replace(/^["']|["']$/g, "");
  return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(u) ? u : "";
}

async function telecharger(api) {
  const r = await fetch(api, { redirect: "follow" });
  if (!r.ok) throw new Error("tableau injoignable");
  const texte = await r.text();
  JSON.parse(texte); // vérifie que c'est bien des données
  return { texte, quand: Date.now() };
}

async function lireCache(cle) {
  try {
    const r = await caches.default.match(cle);
    if (r) return { texte: await r.text(), quand: Number(r.headers.get("x-quand") || 0) };
  } catch (_) {}
  return null;
}

async function ecrireCache(cle, copie) {
  memoire = copie;
  try {
    await caches.default.put(cle, new Response(copie.texte, {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=604800", "x-quand": String(copie.quand) },
    }));
  } catch (_) {}
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const api = adresse(env);
  if (!api) return json({ erreur: "configuration manquante" }, 500);
  const cle = new Request(new URL("/api/donnees-copie", request.url).toString());

  let copie = memoire || (await lireCache(cle));
  if (copie) {
    if (Date.now() - copie.quand > FRAICHEUR_MS) {
      context.waitUntil(telecharger(api).then((c) => ecrireCache(cle, c)).catch(() => {}));
    }
    return new Response(copie.texte, { headers: entetes });
  }
  try {
    copie = await telecharger(api);
    await ecrireCache(cle, copie);
    return new Response(copie.texte, { headers: entetes });
  } catch (e) {
    return json({ erreur: "données indisponibles" }, 502);
  }
}

export async function onRequestPost({ request, env }) {
  const api = adresse(env);
  if (!api) return json({ ok: false, erreur: "Réservation indisponible pour le moment." }, 500);
  const corps = await request.text();
  if (corps.length > 5000) return json({ ok: false, erreur: "Demande trop longue." }, 413);
  try {
    const r = await fetch(api, { method: "POST", body: corps, headers: { "content-type": "text/plain;charset=utf-8" }, redirect: "follow" });
    const texte = await r.text();
    JSON.parse(texte);
    return new Response(texte, { headers: entetes });
  } catch (e) {
    return json({ ok: false, erreur: "La réservation n'a pas pu être envoyée. Appelez-nous." }, 502);
  }
}
