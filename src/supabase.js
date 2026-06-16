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
export async function dbSaveMerge(collection, localArray) {
  var sb = getClient();
  if (!sb) return localArray;
  try {
    var remote = await dbLoad(collection, []);
    if (!Array.isArray(remote)) remote = [];
    if (!Array.isArray(localArray)) localArray = [];

    // Index distant par id
    var byId = {};
    remote.forEach(function(item){ if (item && item.id != null) byId[item.id] = item; });

    // Les ids présents localement (pour détecter les suppressions volontaires)
    var localIds = {};
    localArray.forEach(function(item){ if (item && item.id != null) localIds[item.id] = true; });

    // 1) Les éléments locaux écrasent/ajoutent leur version (édition en cours)
    localArray.forEach(function(item){ if (item && item.id != null) byId[item.id] = item; });

    // 2) On conserve les éléments distants absents en local UNIQUEMENT s'ils
    //    sont récents (ajoutés par un autre agent et pas encore synchronisés ici).
    //    -> ici on les garde tous : la suppression passe par une action explicite.
    var merged = Object.keys(byId).map(function(k){ return byId[k]; });

    await sb.from("orpi_data").upsert(
      { agence_id: AGENCE_ID, collection: collection, data: merged, updated_at: new Date().toISOString() },
      { onConflict: "agence_id,collection" }
    );
    return merged;
  } catch(e) {
    console.warn("dbSaveMerge error:", e);
    // En cas d'échec, repli sur la sauvegarde simple
    await dbSave(collection, localArray);
    return localArray;
  }
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
