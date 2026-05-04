import { useState, useEffect, useRef, useMemo } from "react";
import { useApp } from "../App";
import { fmt } from "./Shared";

// ─── COORDONNÉES PRÉ-CALCULÉES AMIENS (fallback instantané) ──────────────────
// Évite la dépendance à Nominatim en production
var COORDS_AMIENS = {
  // Rues connues d'Amiens avec coordonnées exactes
  "saint-leu":          [49.8967, 2.2991],
  "bd de belfort":      [49.8912, 2.2887],
  "belfort":            [49.8912, 2.2887],
  "rue de noyon":       [49.8978, 2.3102],
  "noyon":              [49.8978, 2.3102],
  "place gambetta":     [49.8944, 2.3021],
  "gambetta":           [49.8944, 2.3021],
  "rue gresset":        [49.8921, 2.3045],
  "gresset":            [49.8921, 2.3045],
  "allée des acacias":  [49.8756, 2.3156],
  "acacias":            [49.8756, 2.3156],
  "longueau":           [49.8756, 2.3156],
  "rue de paris":       [49.8901, 2.3078],
  "victor hugo":        [49.8934, 2.2998],
  "rue delambre":       [49.8889, 2.3067],
  "delambre":           [49.8889, 2.3067],
  "impasse des lilas":  [49.8823, 2.3234],
  "rivery":             [49.8823, 2.3234],
  "rue des jacobins":   [49.8951, 2.3012],
  "jacobins":           [49.8951, 2.3012],
  "vulfran warmé":      [49.8962, 2.3034],
  "vulfran":            [49.8962, 2.3034],
  "bd du port":         [49.9012, 2.2956],
  "port":               [49.9012, 2.2956],
  "av de la république":[49.8876, 2.2934],
  "faidherbe":          [49.8956, 2.3089],
  "rue du maréchal foch":[49.8923, 2.2978],
  "foch":               [49.8923, 2.2978],
  "maréchal foch":      [49.8923, 2.2978],
  "bd jules verne":     [49.8867, 2.2845],
  "jules verne":        [49.8867, 2.2845],
  "delpech":            [49.8934, 2.3067],
  "leclerc":            [49.8889, 2.2912],
  "av d'alsace":        [49.8912, 2.3001],
  "alsace":             [49.8912, 2.3001],
  "camon":              [49.8712, 2.3289],
  "rue vulfran warmé":  [49.8962, 2.3034],
  "général leclerc":    [49.8889, 2.2912],
};

// Décalage aléatoire léger pour éviter superposition de punaises au même point
function jitter(lat, lng) {
  return [lat + (Math.random()-0.5)*0.002, lng + (Math.random()-0.5)*0.002];
}

function coordsFromAdresse(adresse) {
  if (!adresse) return null;
  var low = adresse.toLowerCase();
  // Chercher une correspondance dans le dictionnaire
  for (var key in COORDS_AMIENS) {
    if (low.includes(key)) {
      var c = COORDS_AMIENS[key];
      return jitter(c[0], c[1]);
    }
  }
  // Fallback : centre d'Amiens avec jitter pour que ce soit visible
  if (low.includes("amiens")) return jitter(49.8941, 2.2955);
  return null;
}

// Géocodage Nominatim en arrière-plan (enrichissement)
var geocodeCache = {};
async function geocodeNominatim(adresse) {
  if (geocodeCache[adresse]) return geocodeCache[adresse];
  try {
    var q = encodeURIComponent(adresse + ", France");
    var r = await fetch(
      "https://nominatim.openstreetmap.org/search?format=json&q=" + q + "&limit=1",
      { headers: { "Accept-Language": "fr", "User-Agent": "ORPI-Declic-Immo/1.0" } }
    );
    if (!r.ok) return null;
    var d = await r.json();
    if (d && d[0]) {
      var coords = [parseFloat(d[0].lat), parseFloat(d[0].lon)];
      geocodeCache[adresse] = coords;
      return coords;
    }
  } catch(e) {}
  return null;
}

// ─── CONFIG FILTRES ───────────────────────────────────────────────────────────
var FILTRES = [
  { id:"mandat",    label:"Mandats",      emoji:"🏠", color:"#1D3557" },
  { id:"compromis", label:"Compromis",    emoji:"🤝", color:"#2196F3" },
  { id:"vendu",     label:"Vendus",       emoji:"✅", color:"#4CAF50" },
  { id:"location",  label:"Locations",    emoji:"🔑", color:"#FF9800" },
  { id:"gestion",   label:"Gestion loc.", emoji:"🏘️", color:"#9C27B0" },
  { id:"offmarket", label:"Off market",   emoji:"🔒", color:"#E63946" },
];

export default function CarteInteractive({ onNavigate }) {
  var ctx      = useApp();
  var agenceId = ctx.currentUser.agenceId;
  var users    = ctx.users || [];
  var mandats  = (ctx.mandats  ||[]).filter(function(m){ return m.agenceId===agenceId; });
  var locations= (ctx.locations||[]).filter(function(l){ return l.agenceId===agenceId; });
  var gestion  = (ctx.gestion  ||[]).filter(function(g){ return g.agenceId===agenceId && g.actif; });
  var offmarket= (ctx.offmarket||[]).filter(function(o){ return o.agenceId===agenceId && o.actif; });

  var [filtresActifs, setFiltresActifs] = useState({mandat:true,compromis:true,vendu:true,location:true,gestion:false,offmarket:true});
  var [points,        setPoints]        = useState([]);
  var [enriching,     setEnriching]     = useState(false);
  var [filtreAgent,   setFiltreAgent]   = useState("");
  var [filtreBien,    setFiltreBien]    = useState("");
  var [searchTexte,   setSearchTexte]   = useState("");
  var [leafletReady,  setLeafletReady]  = useState(false);
  var mapRef    = useRef(null);
  var mapObj    = useRef(null);
  var markersRef= useRef([]);

  var agents = users.filter(function(u){ return (u.role==="agent"||u.role==="manager") && u.agenceId===agenceId && u.actif; });

  // ─── CONSTRUIRE LISTE DE BIENS ────────────────────────────────────────────
  var allBiens = useMemo(function() {
    var list = [];
    mandats.forEach(function(m) {
      list.push({ id:m.id, type:m.statut==="vendu"?"vendu":m.statut==="compromis"?"compromis":"mandat", adresse:m.adresse, prix:m.prix, ref:m.ref, agentId:m.agentId, typeBien:m.typeBien||"", extra:{commission:m.commission, typeMandat:m.typeMandat, statut:m.statut} });
    });
    locations.forEach(function(l) {
      list.push({ id:l.id, type:"location", adresse:l.adresse, prix:l.loyer, ref:l.ref, agentId:l.agentId, typeBien:"", extra:{locataire:l.locataireNom?(l.locatairePrenom+" "+l.locataireNom):"Disponible", loyer:l.loyer} });
    });
    gestion.forEach(function(g) {
      list.push({ id:g.id, type:"gestion", adresse:g.adresse, prix:g.loyer, ref:g.ref, agentId:g.agentId, typeBien:g.typeLogement||"", extra:{proprio:g.proprietairePrenom+" "+g.proprietaireNom, comm:g.commissionMensuelle} });
    });
    offmarket.forEach(function(o) {
      list.push({ id:o.id, type:"offmarket", adresse:o.adresse, prix:o.prix, ref:o.ref, agentId:o.agentId, typeBien:o.typeLogement||"", extra:{contact:o.proprietairePrenom+" "+o.proprietaireNom, tel:o.proprietaireTel, motivation:o.motivation} });
    });
    return list;
  }, [mandats.length, locations.length, gestion.length, offmarket.length]);

  // ─── PHASE 1 : COORDS INSTANTANÉES (dictionnaire) ────────────────────────
  useEffect(function() {
    var pts = [];
    allBiens.forEach(function(b) {
      var c = coordsFromAdresse(b.adresse);
      if (c) pts.push({...b, lat:c[0], lng:c[1], geocoded:false});
    });
    setPoints(pts);
  }, [allBiens.length]);

  // ─── PHASE 2 : ENRICHISSEMENT NOMINATIM en arrière-plan ──────────────────
  useEffect(function() {
    if (allBiens.length === 0) return;
    var cancelled = false;
    async function enrich() {
      setEnriching(true);
      for (var i = 0; i < allBiens.length; i++) {
        if (cancelled) break;
        var b = allBiens[i];
        var c = await geocodeNominatim(b.adresse);
        if (c && !cancelled) {
          setPoints(function(prev) {
            return prev.map(function(p) {
              return p.id === b.id ? {...p, lat:c[0], lng:c[1], geocoded:true} : p;
            });
          });
        }
        await new Promise(function(r){ setTimeout(r, 1200); }); // respect rate limit Nominatim
      }
      if (!cancelled) setEnriching(false);
    }
    enrich();
    return function(){ cancelled = true; };
  }, [allBiens.length]);

  // ─── INITIALISER LEAFLET ─────────────────────────────────────────────────
  useEffect(function() {
    if (!mapRef.current) return;
    if (mapObj.current) { setLeafletReady(true); return; }

    function initMap() {
      if (!window.L || !mapRef.current) return;
      if (mapObj.current) { setLeafletReady(true); return; }
      var L = window.L;
      var map = L.map(mapRef.current, { zoomControl:true }).setView([49.894, 2.296], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:"© OpenStreetMap", maxZoom:19
      }).addTo(map);
      mapObj.current = map;
      // Forcer recalcul dimensions après rendu
      setTimeout(function(){ try{ map.invalidateSize(); }catch(e){} }, 200);
      setLeafletReady(true);
    }

    if (window.L) { initMap(); return; }

    // CSS Leaflet
    if (!document.querySelector('link[href*="leaflet"]')) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // JS Leaflet
    var script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = initMap;
    script.onerror = function(){ console.error("Leaflet CDN inaccessible"); };
    document.head.appendChild(script);
  }, []);

  // ─── INVALIDATE SIZE AU RESIZE ───────────────────────────────────────────
  useEffect(function() {
    if (!mapRef.current) return;
    var ro = new ResizeObserver(function() {
      if (mapObj.current) { try { mapObj.current.invalidateSize(); } catch(e) {} }
    });
    ro.observe(mapRef.current);
    return function(){ ro.disconnect(); };
  }, []);

  // ─── MÀJOUR MARQUEURS ────────────────────────────────────────────────────
  useEffect(function() {
    if (!leafletReady || !mapObj.current || !window.L) return;
    var L = window.L;

    markersRef.current.forEach(function(m){ try{ mapObj.current.removeLayer(m); }catch(e){} });
    markersRef.current = [];

    var visible = points.filter(function(p) {
      if (!filtresActifs[p.type]) return false;
      if (filtreAgent && p.agentId !== filtreAgent) return false;
      if (filtreBien && p.typeBien !== filtreBien) return false;
      if (searchTexte) {
        var q = searchTexte.toLowerCase();
        if (!(p.adresse||"").toLowerCase().includes(q) && !(p.ref||"").toLowerCase().includes(q)) return false;
      }
      return true;
    });

    visible.forEach(function(p) {
      var cfg = FILTRES.find(function(f){ return f.id===p.type; }) || FILTRES[0];
      var icon = L.divIcon({
        className: "",
        html: '<div style="width:32px;height:32px;border-radius:16px;background:'+cfg.color+';border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:15px;cursor:pointer;">'+cfg.emoji+'</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      try {
        var marker = L.marker([p.lat, p.lng], { icon }).addTo(mapObj.current);
        // Tooltip sur hover
        marker.bindTooltip(
          "<b>"+p.ref+"</b><br>"+p.adresse.split(",")[0]+"<br>"+(p.prix?(p.type==="location"||p.type==="gestion"?p.prix+"€/mois":p.prix.toLocaleString("fr-FR")+"€"):""),
          { direction:"top", offset:[0,-16] }
        );
        marker.on("click", function() {
          if (onNavigate) {
            var tabMap = { mandat:"mandats", compromis:"mandats", vendu:"mandats", location:"locations", gestion:"gestion", offmarket:"offmarket" };
            onNavigate(tabMap[p.type]||"mandats", p.id, p.type);
          }
        });
        markersRef.current.push(marker);
      } catch(e) {}
    });
  }, [points, filtresActifs, filtreAgent, filtreBien, searchTexte, leafletReady]);

  function toggleFiltre(id) {
    setFiltresActifs(function(prev){ return {...prev, [id]:!prev[id]}; });
  }

  var nbVisible = useMemo(function() {
    return points.filter(function(p) {
      if (!filtresActifs[p.type]) return false;
      if (filtreAgent && p.agentId!==filtreAgent) return false;
      if (filtreBien && p.typeBien!==filtreBien) return false;
      if (searchTexte) { var q=searchTexte.toLowerCase(); if (!(p.adresse||"").toLowerCase().includes(q) && !(p.ref||"").toLowerCase().includes(q)) return false; }
      return true;
    }).length;
  }, [points, filtresActifs, filtreAgent, filtreBien, searchTexte]);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:0,maxWidth:"100%",overflow:"hidden"}}>
      {/* Filtres */}
      <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:"12px 14px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"🗺️ Carte des biens"}</span>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {enriching && <span style={{fontSize:10,color:"var(--g400)"}}>{"🔄 GPS en cours…"}</span>}
            <span style={{background:"var(--g100)",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700,color:"var(--navy)"}}>{nbVisible+" bien(s)"}</span>
          </div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
          {FILTRES.map(function(f) {
            var actif = filtresActifs[f.id];
            return (
              <button key={f.id} onClick={function(){toggleFiltre(f.id);}} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 11px",borderRadius:20,border:"2px solid "+(actif?f.color:"var(--g200)"),background:actif?f.color+"22":"#fff",cursor:"pointer",fontSize:12,fontWeight:700,color:actif?f.color:"var(--g400)",transition:"all 0.15s"}}>
                <span>{f.emoji}</span><span>{f.label}</span>
              </button>
            );
          })}
        </div>
        <input className="form-input" value={searchTexte} onChange={function(e){setSearchTexte(e.target.value);}} placeholder="🔍 Adresse ou référence…" style={{fontSize:12,marginBottom:6}}/>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <select className="form-select" style={{flex:"1 1 auto",minWidth:0,maxWidth:"100%",fontSize:12}} value={filtreBien} onChange={function(e){setFiltreBien(e.target.value);}}>
            <option value="">{"Tous types"}</option>
            <option value="appartement">{"🏢 Appartement"}</option>
            <option value="maison">{"🏠 Maison"}</option>
            <option value="terrain">{"🌿 Terrain"}</option>
            <option value="immeuble">{"🏗️ Immeuble"}</option>
            <option value="garage">{"🚗 Garage"}</option>
            <option value="local_pro_location">{"🏬 Local à louer"}</option>
            <option value="local_pro_vente">{"🏪 Local à vendre"}</option>
          </select>
          <select className="form-select" style={{flex:"1 1 auto",minWidth:0,maxWidth:"100%",fontSize:12}} value={filtreAgent} onChange={function(e){setFiltreAgent(e.target.value);}}>
            <option value="">{"Tous agents"}</option>
            {agents.map(function(a){ return <option key={a.id} value={a.id}>{a.nom}</option>; })}
          </select>
          {(searchTexte||filtreBien||filtreAgent) && (
            <button className="btn btn-secondary btn-sm" onClick={function(){setSearchTexte("");setFiltreBien("");setFiltreAgent("");}}>{"✕"}</button>
          )}
        </div>
      </div>

      {/* Carte */}
      <div style={{position:"relative",borderRadius:12,overflow:"hidden",border:"1px solid var(--g200)",minHeight:300,width:"100%",zIndex:0}}>
        <div ref={mapRef} className="carte-map-container"/>
        {!leafletReady && (
          <div style={{position:"absolute",inset:0,zIndex:10,display:"flex",alignItems:"center",justifyContent:"center",background:"#F0F4F8",flexDirection:"column",gap:10}}>
            <div style={{width:36,height:36,border:"4px solid var(--blue)",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}></div>
            <div style={{fontSize:12,color:"var(--g400)"}}>{"Chargement de la carte…"}</div>
            <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
          </div>
        )}
        <div style={{position:"absolute",top:8,left:"50%",transform:"translateX(-50%)",zIndex:999,background:"rgba(255,255,255,0.92)",borderRadius:8,padding:"4px 10px",fontSize:11,color:"var(--g500)",fontWeight:600,pointerEvents:"none",whiteSpace:"nowrap"}}>
          {"👆 Clic = ouvrir le bien"}
        </div>
      </div>

      {points.length === 0 && (
        <div style={{textAlign:"center",padding:"12px",color:"var(--g400)",fontSize:12,marginTop:6}}>
          {"Aucun bien à afficher — ajoutez des mandats pour les voir sur la carte."}
        </div>
      )}
    </div>
  );
}
