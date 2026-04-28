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

export function dbSubscribe(collection, callback) {
  var sb = getClient();
  if (!sb) return function(){};
  var channel = sb
    .channel("orpi_"+collection)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "orpi_data",
      filter: "agence_id=eq."+AGENCE_ID+",collection=eq."+collection
    }, function(payload) {
      if (payload.new && payload.new.data) callback(payload.new.data);
    })
    .subscribe();
  return function() { try { sb.removeChannel(channel); } catch(e){} };
}
