function parseCSV(t) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

// nettoie une variable : enlève espaces, retours à la ligne et guillemets en trop
const lireVariable = (nom) => (process.env[nom] || "").trim().replace(/^["']|["']$/g, "").trim();

async function lireOnglet(base, gid) {
  if (!gid) return null;
  const r = await fetch(`${base}?gid=${encodeURIComponent(gid)}&single=true&output=csv`);
  if (!r.ok) throw new Error("onglet " + gid);
  return parseCSV(await r.text()).slice(1);
}

export default async () => {
  const pub = lireVariable("SHEET_PUB_URL");
  const base = pub.replace(/\/pub(html)?(\?.*)?$/, "/pub");
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\/d\/e\/[\w-]+\/pub$/.test(base)) {
    return Response.json({ erreur: "configuration manquante" }, { status: 500 });
  }
  try {
    const [carte, infos, menus] = await Promise.all([
      lireOnglet(base, lireVariable("GID_CARTE")),
      lireOnglet(base, lireVariable("GID_INFOS")),
      lireOnglet(base, lireVariable("GID_MENUS")).catch(() => null),
    ]);
    return Response.json({ carte: carte || [], infos: infos || [], menus }, {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Netlify-CDN-Cache-Control": "public, durable, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (e) {
    return Response.json({ erreur: "données indisponibles" }, { status: 502 });
  }
};

export const config = { path: "/api/donnees" };
