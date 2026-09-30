// ─────────────────────────────────────────────────────────────────────────────
// SYNCHRO QUOTIDIENNE DES BIENS EN VENTE — Site ORPI Déclic Immo → Supabase
//
// Lit la page publique des biens en vente d'ORPI Déclic Immo, et met à jour la
// collection "mandats" de Supabase SANS jamais écraser les données commerciales
// saisies par les agents (agent, propriétaire, commission, statut avancé).
//
// Réconciliation par identifiant d'annonce (annonceId) :
//   - Bien du site DÉJÀ présent (statut "mandat") → maj prix / exclusivité / url
//   - Bien du site NOUVEAU                         → création (non attribué)
//   - Bien "orpi-web" DISPARU du site             → marqué retireDuSite = true
//   - Tout mandat NON issu du site (manuel, agent) → jamais touché
//
// Lancé par la GitHub Action (quotidien + manuel). Aucune dépendance externe.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = "https://rqytkkaxoqdygxuiqfuf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY; // fourni par le secret GitHub
const AGENCE_ID = "agence-1";
const BASE = "https://www.orpi.com/declicimmo/acheter/biens-en-vente";
const UA = "Mozilla/5.0 (compatible; ORPI-PILOMAX-sync/1.0)";
const MAX_PAGES = 15; // sécurité

if (!SUPABASE_KEY) {
  console.error("❌ Variable d'environnement SUPABASE_KEY manquante (secret GitHub).");
  process.exit(1);
}

// ─── Extraction du site ──────────────────────────────────────────────────────
function txt(s) {
  return s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&euro;/g, "€")
    .replace(/&#039;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
function mapType(t) {
  const x = (t || "").toLowerCase();
  if (x.includes("appartement")) return "appartement";
  if (x.includes("maison")) return "maison";
  if (x.includes("immeuble")) return "immeuble";
  if (x.includes("stationnement")) return "stationnement";
  if (x.includes("terrain")) return "terrain";
  if (x.includes("local") || x.includes("commerce")) return "local";
  return x || "autre";
}

// Récupère jusqu'à 3 photos distinctes depuis la page d'une annonce.
async function recupererPhotos(annonceUrl) {
  try {
    const html = await (await fetch(annonceUrl, { headers: { "User-Agent": UA } })).text();
    const urls = html.match(/https:\/\/cutjhqvjma\.cloudimg\.io\/[^"'\s)]+/gi) || [];
    const parPhoto = {};
    for (const u of urls) {
      const m = u.match(/--([0-9a-f-]{20,})/i);
      const key = m ? m[1].slice(0, 20) : u;
      // décoder les entités HTML (&amp; -> &) sinon la signature de l'image est cassée
      const clean = u.replace(/&amp;/g, "&").replace(/&#38;/g, "&");
      if (!parPhoto[key]) parPhoto[key] = clean;
    }
    return Object.values(parPhoto).slice(0, 3);
  } catch (e) { return []; }
}
function parsePage(html) {
  const biens = [];
  const cards = html.split('data-oncrawl="estate-card"').slice(1);
  for (const c of cards) {
    const urlM = c.match(/href="\/(annonce-vente-[^"?]+)/);
    if (!urlM) continue;
    const slug = urlM[1].replace(/\/$/, "");
    const uuidM = slug.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{3}-\d{6}-\d{3})$/);
    const annonceId = uuidM ? uuidM[1] : slug;
    const typeM = c.match(/data-oncrawl="estate-type"[^>]*>([^<]+)/);
    const roomsM = c.match(/data-oncrawl="estate-rooms"[^>]*>([^<]+)/);
    const surfM = c.match(/data-oncrawl="estate-surface"[^>]*>([\s\S]*?)<\/span>/);
    const priceM = c.match(/data-oncrawl="estate-price"[^>]*>([\s\S]*?)<\/span>/);
    const locM = c.match(/data-oncrawl="estate-location"[^>]*>([\s\S]*?)<\/span>/);
    biens.push({
      annonceId,
      type: typeM ? txt(typeM[1]) : "",
      pieces: roomsM ? parseInt(txt(roomsM[1])) : null,
      surface: surfM ? parseFloat(txt(surfM[1]).replace(/m2|m²/gi, "").replace(",", ".")) : null,
      prix: priceM ? parseInt(txt(priceM[1]).replace(/[^\d]/g, "")) : null,
      lieu: locM ? txt(locM[1]) : "",
      url: "https://www.orpi.com/" + slug + "/?agency=declicimmo",
      exclusivite: /Exclusivité/i.test(c.slice(0, 600)),
      prixBaisse: /prix en baisse/i.test(c.slice(0, 600)),
      avantPremiere: /Avant-Première/i.test(c.slice(0, 600)),
    });
  }
  return biens;
}
async function scrapeSite() {
  const vus = new Set(), uniq = [];
  for (let p = 1; p <= MAX_PAGES; p++) {
    const url = p === 1 ? BASE : BASE + "?page=" + p;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) { console.log(`  page ${p}: HTTP ${res.status}, arrêt`); break; }
    const biens = parsePage(await res.text());
    // ne garder que les biens jamais vus
    let nouveaux = 0;
    for (const b of biens) { if (b.annonceId && !vus.has(b.annonceId)) { vus.add(b.annonceId); uniq.push(b); nouveaux++; } }
    console.log(`  page ${p}: ${biens.length} biens (${nouveaux} nouveaux)`);
    // Arrêt : page vide, ou page qui n'apporte plus rien de nouveau (fin de pagination)
    if (biens.length === 0 || nouveaux === 0) break;
    await new Promise(r => setTimeout(r, 400));
  }
  return uniq;
}

// ─── Supabase ────────────────────────────────────────────────────────────────
async function loadMandats() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orpi_data?select=data&collection=eq.mandats&agence_id=eq.${AGENCE_ID}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  const rows = await res.json();
  return (rows[0] && rows[0].data) || [];
}
async function saveMandats(data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orpi_data?collection=eq.mandats&agence_id=eq.${AGENCE_ID}`, {
    method: "PATCH",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ data, updated_at: new Date().toISOString() })
  });
  if (!res.ok) throw new Error("Écriture Supabase: HTTP " + res.status);
}

function noteDe(b, today) {
  const parts = [];
  if (b.lieu) parts.push("Secteur : " + b.lieu);
  if (b.prixBaisse) parts.push("Prix en baisse");
  if (b.avantPremiere) parts.push("Avant-Première");
  parts.push("Synchro site ORPI le " + today);
  return parts.join(" · ");
}
function nouveauMandat(b, ref, today) {
  return {
    id: "web-" + b.annonceId, annonceId: b.annonceId, ref: ref,
    prix: b.prix || 0, typeBien: mapType(b.type),
    nbPieces: b.pieces ? String(b.pieces) : "", surface: b.surface ? String(b.surface) : "",
    adresse: b.lieu || "Amiens", statut: "mandat", agentId: "manager-1", agenceId: AGENCE_ID,
    typeMandat: b.exclusivite ? "exclusif" : "simple", source: "orpi-web", url: b.url,
    commission: 0, tauxCommission: 0, dateMandat: today, notes: noteDe(b, today), photos: [],
    dpe: "", etage: "", nbSDB: "", nbChambres: "", chauffage: "", orientation: "",
    anneeConstruction: "", nbApparts: "", chargesAnnuelles: "", loyersMensuel: "", loyersAnnuel: "",
    proprietaireNom: "", proprietairePrenom: "", proprietaireTel: "", proprietaireMail: "",
    dateExpiration: "", dateCompromis: "", dateSignature: "",
    avecCave: false, avecGarage: false, avecJardin: false, avecParking: false, avecPiscine: false,
    avecTerrasse: false, avecAscenseur: false, clausesSuspensivesLevees: false, retireDuSite: false,
  };
}

// ─── Réconciliation ──────────────────────────────────────────────────────────
async function main() {
  const today = new Date().toISOString().slice(0, 10);
  console.log("=== Synchro biens ORPI → Supabase (" + today + ") ===\n");

  console.log("1. Lecture du site ORPI…");
  const biens = await scrapeSite();
  console.log("   → " + biens.length + " biens sur le site\n");
  if (biens.length === 0) { console.error("❌ Aucun bien lu (site indisponible ?). Abandon, base inchangée."); process.exit(1); }

  console.log("2. Lecture des mandats Supabase…");
  const mandats = await loadMandats();
  console.log("   → " + mandats.length + " mandats en base\n");

  // Index des mandats web existants par annonceId
  const webParId = {};
  mandats.forEach(m => { if (m.source === "orpi-web" && m.annonceId) webParId[m.annonceId] = m; });
  const idsDuSite = new Set(biens.map(b => b.annonceId));

  // Prochain numéro de ref WEB
  let maxRef = 0;
  mandats.forEach(m => { const mm = /^WEB-(\d+)$/.exec(m.ref || ""); if (mm) maxRef = Math.max(maxRef, parseInt(mm[1])); });

  let crees = 0, majs = 0, retires = 0, reapparus = 0;
  const resultat = [];

  // a) Parcourir les mandats existants : mettre à jour / marquer retirés / préserver
  mandats.forEach(m => {
    if (m.source !== "orpi-web") { resultat.push(m); return; } // manuel/agent → intact
    const b = biens.find(x => x.annonceId === m.annonceId);
    if (b) {
      // Toujours sur le site : maj des infos publiques, SANS toucher au commercial ni au statut avancé
      const maj = Object.assign({}, m);
      if (m.retireDuSite) { maj.retireDuSite = false; reapparus++; }
      if (m.statut === "mandat") {
        // bien encore actif : on rafraîchit prix / exclusivité / url / secteur
        if (m.prix !== (b.prix || 0)) majs++;
        maj.prix = b.prix || 0;
        maj.typeMandat = b.exclusivite ? "exclusif" : "simple";
        maj.url = b.url;
        maj.adresse = b.lieu || m.adresse;
        maj.surface = b.surface ? String(b.surface) : m.surface;
        maj.nbPieces = b.pieces ? String(b.pieces) : m.nbPieces;
        maj.notes = noteDe(b, today);
      }
      resultat.push(maj);
    } else {
      // Plus sur le site : marquer retiré (vendu/retiré), sans supprimer
      if (!m.retireDuSite) { retires++; resultat.push(Object.assign({}, m, { retireDuSite: true, dateRetraitSite: today })); }
      else resultat.push(m);
    }
  });

  // b) Ajouter les nouveaux biens du site (avec leurs photos)
  const aCreer = biens.filter(b => !webParId[b.annonceId]);
  for (const b of aCreer) {
    maxRef += 1;
    const nm = nouveauMandat(b, "WEB-" + String(maxRef).padStart(3, "0"), today);
    nm.photos = await recupererPhotos(b.url);
    resultat.push(nm);
    crees++;
    await new Promise(r => setTimeout(r, 150));
  }

  // c) Compléter les photos des biens web déjà présents mais sans photo
  let photosAjoutees = 0;
  for (const m of resultat) {
    if (m.source === "orpi-web" && m.url && (!m.photos || m.photos.length === 0) && !m.retireDuSite) {
      const ph = await recupererPhotos(m.url);
      if (ph.length > 0) { m.photos = ph; photosAjoutees++; }
      await new Promise(r => setTimeout(r, 150));
    }
  }

  console.log("3. Réconciliation :");
  console.log("   + " + crees + " nouveau(x)");
  console.log("   ~ " + majs + " prix mis à jour");
  console.log("   \uD83D\uDCF7 " + photosAjoutees + " bien(s) complété(s) en photos");
  console.log("   ⊘ " + retires + " retiré(s) du site (marqués, non supprimés)");
  if (reapparus) console.log("   ↻ " + reapparus + " réapparu(s)");
  console.log("   = " + resultat.length + " mandats au total\n");

  console.log("4. Écriture Supabase…");
  await saveMandats(resultat);
  console.log("   ✅ Terminé.");
}

main().catch(e => { console.error("❌ Erreur:", e.message); process.exit(1); });
