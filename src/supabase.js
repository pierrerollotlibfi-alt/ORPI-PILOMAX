// ─── CONFIGURATION SUPABASE ORPI PRO AMIENS ───────────────────────────────────
var SUPABASE_URL = "https://rqytkkaxoqdygxuiqfuf.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxeXRra2F4b3FkeWd4dWlxZnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NjIzOTMsImV4cCI6MjA5MjMzODM5M30.eekVf-ZNLGGc4pNNTTPA9t1-B7JxYYS_PJMhKvVLRFw";

export var supabaseConfigured = true;

var client = null;

export function getClient() {
  if (client) return client;
  if (window.supabase && window.supabase.createClient) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return client;
}

var AGENCE_ID = "agence-1";

export async function dbLoad(collection, fallback) {
  var sb = getClient();
  if (!sb) return fallback;
  try {
    var res = await sb
      .from("orpi_data")
      .select("data")
      .eq("agence_id", AGENCE_ID)
      .eq("collection", collection)
      .single();
    if (res.error || !res.data) return fallback;
    return res.data.data;
  } catch(e) { return fallback; }
}

export async function dbSave(collection, value) {
  var sb = getClient();
  if (!sb) return;
  try {
    await sb.from("orpi_data").upsert(
      { agence_id: AGENCE_ID, collection: collection, data: value, updated_at: new Date().toISOString() },
      { onConflict: "agence_id,collection" }
    );
  } catch(e) { console.warn("dbSave error:", e); }
}

// Sauvegarde "fusionnée" pour les collections en tableau d'objets {id,...}.
// Relit l'état actuel en base et fusionne par id AVANT d'écrire, pour ne JAMAIS
// écraser les enregistrements ajoutés/modifiés entre-temps par un autre agent.
export async function dbSaveMerge(collection, localArray, removedIds) {
  var sb = getClient();
  if (!sb) return localArray;
  try {
    var remote = await dbLoad(collection, []);
    if (!Array.isArray(remote)) remote = [];
    if (!Array.isArray(localArray)) localArray = [];

    // Ensemble des ids supprimés volontairement (tombstones) : ils ne doivent
    // jamais revenir, même s'ils sont encore présents en base.
    var removed = {};
    (removedIds || []).forEach(function(id){ if (id != null) removed[id] = true; });

    // Index distant par id (en excluant les supprimés)
    var byId = {};
    remote.forEach(function(item){
      if (item && item.id != null && !removed[item.id]) byId[item.id] = item;
    });

    // Les éléments locaux écrasent/ajoutent leur version (édition en cours)
    localArray.forEach(function(item){
      if (item && item.id != null && !removed[item.id]) byId[item.id] = item;
    });

    var merged = Object.keys(byId).map(function(k){ return byId[k]; });

    await sb.from("orpi_data").upsert(
      { agence_id: AGENCE_ID, collection: collection, data: merged, updated_at: new Date().toISOString() },
      { onConflict: "agence_id,collection" }
    );
    return merged;
  } catch(e) {
    console.warn("dbSaveMerge error:", e);
    await dbSave(collection, localArray);
    return localArray;
  }
}

// Ajoute un élément à une collection (usage public : formulaire sans login).
// Relit la liste actuelle, ajoute l'élément, et sauvegarde. Merge-safe par nature.
export async function dbAppendPublic(collection, item) {
  var sb = getClient();
  if (!sb) throw new Error("no client");
  var current = await dbLoad(collection, []);
  if (!Array.isArray(current)) current = [];
  current.push(item);
  await sb.from("orpi_data").upsert(
    { agence_id: AGENCE_ID, collection: collection, data: current, updated_at: new Date().toISOString() },
    { onConflict: "agence_id,collection" }
  );
  return item;
}

export function dbSubscribe(collection, callback) {
  var sb = getClient();
  if (!sb) return function(){};
  var channel = sb
    .channel("orpi_"+collection)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "orpi_data",
      filter: "collection=eq."+collection
    }, function(payload) {
      var row = payload.new;
      if (row && row.agence_id === AGENCE_ID && row.data) callback(row.data);
    })
    .subscribe();
  return function() { try { sb.removeChannel(channel); } catch(e){} };
}
