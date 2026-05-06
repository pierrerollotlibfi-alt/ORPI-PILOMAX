import { useState, useMemo } from "react";
import { useApp } from "../App";

// ─── BARÈMES KILOMÉTRIQUES 2024 (fiscaux) ─────────────────────────────────────
var BAREMES = {
  "3CV":  { t1: 0.529, t2: 0.316, t3: 0.370, seuil1: 5000, seuil2: 20000 },
  "4CV":  { t1: 0.606, t2: 0.340, t3: 0.407, seuil1: 5000, seuil2: 20000 },
  "5CV":  { t1: 0.636, t2: 0.357, t3: 0.427, seuil1: 5000, seuil2: 20000 },
  "6CV":  { t1: 0.665, t2: 0.374, t3: 0.447, seuil1: 5000, seuil2: 20000 },
  "7CV+": { t1: 0.697, t2: 0.394, t3: 0.470, seuil1: 5000, seuil2: 20000 },
};

var MOIS_NOM = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
var MOIS_COURT = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

function getTauxKm(puissance, kmCumul, km) {
  var b = BAREMES[puissance] || BAREMES["5CV"];
  var taux;
  if (kmCumul < b.seuil1) taux = b.t1;
  else if (kmCumul < b.seuil2) taux = b.t2;
  else taux = b.t3;
  return Math.round(km * taux * 100) / 100;
}

function fmtEur(v) { return (Math.round(v*100)/100).toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2})+"€"; }
function fmtKm(v)  { return Number(v).toLocaleString("fr-FR")+" km"; }

var SK = "orpi_km_data_v1";
function lload() { try { return JSON.parse(localStorage.getItem(SK)||"{}"); } catch(e) { return {}; } }
function lsave(v) { try { localStorage.setItem(SK, JSON.stringify(v)); } catch(e) {} }

export default function IndemniteKm() {
  var ctx    = useApp();
  var me     = ctx.currentUser;
  var userId   = me.id;
  var mandats  = ctx.mandats  || [];
  var locations= ctx.locations|| [];
  var agenceId = me.agenceId;
  // Biens de l'agent (mandats + locations)
  var mesBiens = [
    ...mandats.filter(function(m){ return m.agentId===me.id && m.adresse; }).map(function(m){
      return { id:m.id, label:m.ref+" — "+m.adresse.split(",")[0], adresse:m.adresse, type:"mandat",
        client:(m.proprietairePrenom||"")+" "+(m.proprietaireNom||""), prix:m.prix||0 };
    }),
    ...locations.filter(function(l){ return l.agentId===me.id && l.adresse; }).map(function(l){
      return { id:l.id, label:l.ref+" — "+l.adresse.split(",")[0], adresse:l.adresse, type:"location",
        client:(l.proprietairePrenom||"")+" "+(l.proprietaireNom||""), loyer:l.loyer||0 };
    }),
  ];

  // Charger données persistées par user
  var [allData, setAllDataRaw] = useState(lload);
  var userData = allData[userId] || { deplacement:[], puissance:"5CV", vehicule:"" };

  function setUserData(fn) {
    setAllDataRaw(function(prev) {
      var next = {...prev, [userId]: fn(prev[userId]||{deplacement:[],puissance:"5CV",vehicule:""})};
      lsave(next);
      // Sync Supabase si dispo
      if (ctx.setKpiConfig) {} // placeholder
      return next;
    });
  }

  var deplacement = userData.deplacement || [];
  var puissance   = userData.puissance   || "5CV";
  var vehicule    = userData.vehicule    || "";

  // ─── STATE FORMULAIRE ────────────────────────────────────────────────────
  var NOW = new Date();
  var [showForm,   setShowForm]   = useState(false);
  var [editId,     setEditId]     = useState(null);
  var [filtreMois, setFiltreMois] = useState(NOW.getFullYear()+"-"+String(NOW.getMonth()+1).padStart(2,"0"));
  var [showConfig, setShowConfig] = useState(false);
  var [f, setF] = useState({ date:NOW.toISOString().slice(0,10), depart:"", arrivee:"", motif:"", km:"", allerRetour:false });
  var [calcLoading,  setCalcLoading]  = useState(false);
  var [calcError,    setCalcError]    = useState("");
  var [searchBien,   setSearchBien]   = useState("");
  var [showSuggestions, setShowSuggestions] = useState(false);
  function setFField(k,v) { setF(function(p){return{...p,[k]:v};}); }

  // ─── CALCULS ─────────────────────────────────────────────────────────────
  var annee = Number(filtreMois.split("-")[0]);
  var depAnnee = deplacement.filter(function(d){ return d.date && d.date.slice(0,4)===String(annee); })
    .sort(function(a,b){ return a.date.localeCompare(b.date); });

  // Calculer km cumulé pour le barème progressif
  var depAvecIndemnite = useMemo(function(){
    var cumul = 0;
    return depAnnee.map(function(d){
      var km = Number(d.km) * (d.allerRetour ? 2 : 1);
      var indemnite = getTauxKm(puissance, cumul, km);
      cumul += km;
      return { ...d, kmReel:km, indemnite, cumulApres:cumul };
    });
  }, [depAnnee, puissance]);

  // Stats mois sélectionné
  var depMois = depAvecIndemnite.filter(function(d){ return d.date && d.date.slice(0,7)===filtreMois; });
  var totalKmMois     = depMois.reduce(function(s,d){return s+d.kmReel;},0);
  var totalIndemMois  = depMois.reduce(function(s,d){return s+d.indemnite;},0);

  // Stats année
  var totalKmAnnee    = depAvecIndemnite.reduce(function(s,d){return s+d.kmReel;},0);
  var totalIndemAnnee = depAvecIndemnite.reduce(function(s,d){return s+d.indemnite;},0);

  // Résumé par mois pour la vue annuelle
  var parMois = useMemo(function(){
    var map = {};
    depAvecIndemnite.forEach(function(d){
      var m = d.date.slice(0,7);
      if (!map[m]) map[m] = {km:0,indem:0,nb:0};
      map[m].km    += d.kmReel;
      map[m].indem += d.indemnite;
      map[m].nb    += 1;
    });
    return map;
  }, [depAvecIndemnite]);

  // ─── ACTIONS ─────────────────────────────────────────────────────────────
  function openNew() {
    setEditId(null);
    setF({ date:NOW.toISOString().slice(0,10), depart:"", arrivee:"", motif:"", km:"", allerRetour:false });
    setShowForm(true);
  }
  function openEdit(d) {
    setEditId(d.id);
    setF({ date:d.date, depart:d.depart, arrivee:d.arrivee, motif:d.motif, km:d.km, allerRetour:d.allerRetour||false });
    setShowForm(true);
  }


  // ─── RECHERCHE BIEN → PRÉREMPLISSAGE ──────────────────────────────────────
  var suggestions = searchBien.length >= 2
    ? mesBiens.filter(function(b){
        var q = searchBien.toLowerCase();
        return b.label.toLowerCase().includes(q)
          || (b.client||"").toLowerCase().includes(q)
          || b.adresse.toLowerCase().includes(q);
      }).slice(0, 8)
    : [];

  function selectionnerBien(bien) {
    var motifType = bien.type==="location" ? "Visite location" : "Visite bien";
    setFField("arrivee", bien.adresse);
    setFField("motif", motifType+" — "+bien.label+(bien.client&&bien.client.trim()?" ("+bien.client.trim()+")":""));
    setSearchBien("");
    setShowSuggestions(false);
  }

  // ─── CALCUL DISTANCE AUTO via OSRM (gratuit, sans clé API) ──────────────
  async function calculerDistance() {
    var dep = f.depart.trim();
    var arr = f.arrivee.trim();
    if (!dep || !arr) { setCalcError("Renseignez le départ et l'arrivée"); return; }
    setCalcLoading(true); setCalcError("");
    try {
      // Géocoder les deux adresses via Nominatim
      async function geocode(adresse) {
        var query = encodeURIComponent(adresse + ", France");
        var resp  = await fetch("https://nominatim.openstreetmap.org/search?q="+query+"&format=json&limit=1", {
          headers:{"Accept-Language":"fr","User-Agent":"ORPI-Pilomax/1.0"}
        });
        var data = await resp.json();
        if (!data || data.length===0) throw new Error("Adresse introuvable : "+adresse);
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), label: data[0].display_name };
      }
      var [coordDep, coordArr] = await Promise.all([geocode(dep), geocode(arr)]);
      // Calculer l'itinéraire via OSRM (routage routier gratuit)
      var url = "https://router.project-osrm.org/route/v1/driving/"
        +coordDep.lon+","+coordDep.lat+";"
        +coordArr.lon+","+coordArr.lat
        +"?overview=false";
      var resp2 = await fetch(url);
      var data2 = await resp2.json();
      if (data2.code !== "Ok" || !data2.routes || data2.routes.length===0) {
        throw new Error("Itinéraire introuvable");
      }
      var distanceKm = Math.round(data2.routes[0].distance / 1000 * 10) / 10;
      setFField("km", distanceKm);
      setCalcError("");
    } catch(e) {
      setCalcError(e.message || "Erreur de calcul");
    } finally {
      setCalcLoading(false);
    }
  }

  function saveForm() {
    if (!f.date||!f.motif.trim()||!f.km||Number(f.km)<=0) return;
    setUserData(function(ud){
      var dep = ud.deplacement||[];
      var entry = { ...f, km:Number(f.km), id:editId||(Date.now()+"-"+Math.random().toString(36).slice(2)) };
      return { ...ud, deplacement: editId
        ? dep.map(function(d){return d.id===editId?entry:d;})
        : [...dep, entry]
      };
    });
    setShowForm(false); setEditId(null);
  }
  function deleteEntry(id) {
    if (!window.confirm("Supprimer ce déplacement ?")) return;
    setUserData(function(ud){ return {...ud, deplacement:(ud.deplacement||[]).filter(function(d){return d.id!==id;})}; });
  }
  function exportCSV() {
    var rows = [["Date","Départ","Arrivée","Motif","KM","A/R","KM réels","Indemnité (€)"]];
    depAvecIndemnite.forEach(function(d){
      rows.push([d.date,d.depart,d.arrivee,d.motif,d.km,d.allerRetour?"Oui":"Non",d.kmReel,d.indemnite.toFixed(2)]);
    });
    var csv = rows.map(function(r){return r.join(";");}).join("\n");
    var a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8,"+encodeURIComponent(csv);
    a.download = "indemnites_km_"+annee+"_"+me.nom.replace(/ /g,"_")+".csv";
    a.click();
  }

  // ─── MOIS DISPONIBLES ────────────────────────────────────────────────────
  var moisDispos = [];
  for (var mi=0; mi<12; mi++) {
    var ms = annee+"-"+String(mi+1).padStart(2,"0");
    moisDispos.push(ms);
  }

  return (
    <div onClick={function(e){ if(!e.target.closest||!e.target.closest("[data-search]")) setShowSuggestions(false); }}>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      {/* ─── CONFIG ──────────────────────────────────────────────────────── */}
      {showConfig && (
        <div style={{background:"#fff",borderRadius:12,border:"2px solid var(--navy)",padding:16,marginBottom:14}}>
          <div style={{fontWeight:800,color:"var(--navy)",fontSize:13,marginBottom:12}}>{"⚙️ Paramètres véhicule"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div>
              <label style={{fontSize:11,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"PUISSANCE FISCALE"}</label>
              <select className="form-select" value={puissance} onChange={function(e){setUserData(function(ud){return{...ud,puissance:e.target.value};});}}>
                {Object.keys(BAREMES).map(function(k){ return <option key={k} value={k}>{k}</option>; })}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"VÉHICULE (optionnel)"}</label>
              <input className="form-input" value={vehicule} onChange={function(e){setUserData(function(ud){return{...ud,vehicule:e.target.value};});}} placeholder="Ex: Peugeot 308"/>
            </div>
          </div>
          <div style={{background:"#EFF6FF",borderRadius:8,padding:"8px 12px",fontSize:11,color:"#1D4ED8",marginBottom:10}}>
            {"Barème fiscal "+annee+" — "+puissance+" : 0–5000km = "+BAREMES[puissance].t1+"€/km · 5001–20000km = "+BAREMES[puissance].t2+"€/km · +20000km = "+BAREMES[puissance].t3+"€/km"}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={function(){setShowConfig(false);}}>{"Fermer"}</button>
        </div>
      )}

      {/* ─── HEADER STATS ────────────────────────────────────────────────── */}
      <div style={{background:"linear-gradient(135deg,#1D3557,#2a4a7a)",borderRadius:14,padding:"16px 18px",marginBottom:14,color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>{"🚗 Indemnités kilométriques "+annee}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:2}}>{me.nom+(vehicule?" · "+vehicule:"")+" · "+puissance}</div>
          </div>
          <button onClick={function(){setShowConfig(function(p){return !p;});}} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{"⚙️"}</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div style={{background:"rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 14px"}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginBottom:3}}>{"KM ce mois"}</div>
            <div style={{fontSize:22,fontWeight:900}}>{fmtKm(totalKmMois)}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginTop:2}}>{fmtEur(totalIndemMois)+" d'indemnités"}</div>
          </div>
          <div style={{background:"rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 14px"}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginBottom:3}}>{"KM année "+annee}</div>
            <div style={{fontSize:22,fontWeight:900}}>{fmtKm(totalKmAnnee)}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginTop:2}}>{fmtEur(totalIndemAnnee)+" d'indemnités"}</div>
          </div>
        </div>
      </div>

      {/* ─── SÉLECTEUR MOIS ──────────────────────────────────────────────── */}
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:12,scrollbarWidth:"none"}}>
        {moisDispos.map(function(m){
          var actif = m===filtreMois;
          var hasDep = parMois[m] && parMois[m].nb>0;
          return (
            <button key={m} onClick={function(){setFiltreMois(m);}} style={{flexShrink:0,padding:"6px 12px",borderRadius:20,border:"2px solid "+(actif?"var(--navy)":hasDep?"var(--green)":"var(--g200)"),background:actif?"var(--navy)":hasDep?"#F0FDF4":"#fff",color:actif?"#fff":hasDep?"var(--green)":"var(--g400)",fontWeight:actif?800:600,fontSize:11,cursor:"pointer"}}>
              {MOIS_COURT[parseInt(m.split("-")[1])-1]}
              {hasDep && !actif && <span style={{fontSize:9,marginLeft:4,fontWeight:800}}>{parMois[m].nb}</span>}
            </button>
          );
        })}
      </div>

      {/* ─── FORMULAIRE ──────────────────────────────────────────────────── */}
      {showForm && (
        <div style={{background:"#fff",borderRadius:14,border:"2px solid var(--navy)",padding:16,marginBottom:14}}>
          <div style={{fontWeight:800,color:"var(--navy)",fontSize:13,marginBottom:12}}>{editId?"✏️ Modifier le déplacement":"➕ Nouveau déplacement"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            {/* Recherche rapide bien/client */}
            <div style={{gridColumn:"1/-1",position:"relative"}}>
              <label style={{fontSize:11,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"🔍 RECHERCHER UN BIEN (optionnel)"}</label>
              <input className="form-input" value={searchBien}
                onChange={function(e){setSearchBien(e.target.value);setShowSuggestions(true);}}
                onFocus={function(){setShowSuggestions(true);}}
                placeholder="Nom client, référence, adresse…" data-search="1"
                style={{background:"#F0F9FF",border:"2px solid var(--blue)"}}
              />
              {showSuggestions && suggestions.length>0 && (
                <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:"#fff",border:"1px solid var(--g200)",borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",marginTop:4,maxHeight:240,overflowY:"auto"}}>
                  {suggestions.map(function(b){
                    return (
                      <div key={b.id} onClick={function(){selectionnerBien(b);}}
                        style={{padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid var(--g50)",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                        onMouseEnter={function(e){e.currentTarget.style.background="#EFF6FF";}}
                        onMouseLeave={function(e){e.currentTarget.style.background="#fff";}}>
                        <div>
                          <div style={{fontWeight:700,color:"var(--navy)",fontSize:12}}>{b.label}</div>
                          {b.client&&b.client.trim() && <div style={{fontSize:11,color:"var(--g400)",marginTop:1}}>{"👤 "+b.client.trim()}</div>}
                        </div>
                        <span style={{fontSize:10,background:b.type==="location"?"#FFF7ED":"#EFF6FF",color:b.type==="location"?"var(--amber)":"var(--blue)",borderRadius:20,padding:"2px 8px",fontWeight:700,flexShrink:0,marginLeft:8}}>
                          {b.type==="location"?"🔑 Loc":"🏠 Vente"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {searchBien.length>0 && suggestions.length===0 && showSuggestions && (
                <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:"#fff",border:"1px solid var(--g200)",borderRadius:10,padding:"10px 14px",marginTop:4,fontSize:12,color:"var(--g400)"}}>{"Aucun bien trouvé"}</div>
              )}
            </div>

            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:11,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"DATE *"}</label>
              <input type="date" className="form-input" value={f.date} onChange={function(e){setFField("date",e.target.value);}}/>
            </div>
            <div>
              <label style={{fontSize:11,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"DÉPART"}</label>
              <input className="form-input" value={f.depart} onChange={function(e){setFField("depart",e.target.value);}} placeholder="Ex: Agence Amiens"/>
            </div>
            <div>
              <label style={{fontSize:11,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"ARRIVÉE"}</label>
              <input className="form-input" value={f.arrivee} onChange={function(e){setFField("arrivee",e.target.value);}} placeholder="Ex: 40 Rue Voiture"/>
            </div>
            {/* Bouton calcul auto */}
            {f.depart.trim() && f.arrivee.trim() && (
              <div style={{gridColumn:"1/-1"}}>
                <button type="button" onClick={calculerDistance} disabled={calcLoading}
                  style={{width:"100%",padding:"8px",borderRadius:10,border:"2px solid var(--blue)",background:calcLoading?"var(--g50)":"#EFF6FF",color:"var(--blue)",fontWeight:800,fontSize:12,cursor:calcLoading?"wait":"pointer",fontFamily:"var(--font)",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  {calcLoading
                    ? <><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⏳</span>{"Calcul en cours..."}</>
                    : <><span>{"📍"}</span>{"Calculer la distance automatiquement"}</>
                  }
                </button>
                {calcError && <div style={{fontSize:11,color:"var(--red)",marginTop:4,fontWeight:600}}>{"⚠️ "+calcError}</div>}
              </div>
            )}

            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:11,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"MOTIF *"}</label>
              <input className="form-input" value={f.motif} onChange={function(e){setFField("motif",e.target.value);}} placeholder="Ex: Visite mandat Dupont — M-2024-001" autoFocus/>
            </div>
            <div>
              <label style={{fontSize:11,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"DISTANCE (km) *"}</label>
              <input type="number" className="form-input" value={f.km} onChange={function(e){setFField("km",e.target.value);}} placeholder="0" min="0" step="0.5"/>
            </div>
            <div style={{display:"flex",alignItems:"center"}}>
              <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"10px 12px",background:f.allerRetour?"#EFF6FF":"var(--g50)",borderRadius:10,border:"2px solid "+(f.allerRetour?"var(--blue)":"var(--g200)"),width:"100%"}}>
                <input type="checkbox" checked={f.allerRetour||false} onChange={function(e){setFField("allerRetour",e.target.checked);}} style={{width:18,height:18}}/>
                <div>
                  <div style={{fontWeight:700,fontSize:12,color:f.allerRetour?"var(--blue)":"var(--g600)"}}>{"Aller-retour"}</div>
                  {f.km>0 && <div style={{fontSize:10,color:"var(--g400)"}}>{"= "+Number(f.km)*2+" km réels"}</div>}
                </div>
              </label>
            </div>
          </div>
          {/* Aperçu indemnité */}
          {f.km>0 && (
            <div style={{background:"#F0FDF4",border:"1px solid #A7F3D0",borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,color:"#065F46",fontWeight:600}}>{"Indemnité estimée (barème "+puissance+")"}</span>
              <span style={{fontWeight:900,fontSize:16,color:"var(--green)"}}>
                {fmtEur(getTauxKm(puissance, totalKmAnnee, Number(f.km)*(f.allerRetour?2:1)))}
              </span>
            </div>
          )}
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-secondary" style={{flex:1}} onClick={function(){setShowForm(false);setEditId(null);}}>{"Annuler"}</button>
            <button className="btn btn-primary" style={{flex:2}} onClick={saveForm} disabled={!f.date||!f.motif.trim()||!f.km||Number(f.km)<=0}>{"💾 Enregistrer"}</button>
          </div>
        </div>
      )}

      {/* ─── ACTIONS ─────────────────────────────────────────────────────── */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        {!showForm && (
          <button className="btn btn-primary btn-sm" onClick={openNew}>{"+ Déplacement"}</button>
        )}
        <button className="btn btn-secondary btn-sm" onClick={exportCSV}>{"⬇️ Export CSV "+annee}</button>
        <span style={{fontSize:12,color:"var(--g400)",alignSelf:"center",marginLeft:"auto"}}>
          {depMois.length+" déplacement"+(depMois.length>1?"s":"")+" ce mois"}
        </span>
      </div>

      {/* ─── LISTE DU MOIS ───────────────────────────────────────────────── */}
      {depMois.length===0 && !showForm && (
        <div style={{textAlign:"center",padding:"30px 20px",color:"var(--g400)"}}>
          <div style={{fontSize:36,marginBottom:10}}>{"🚗"}</div>
          <div style={{fontWeight:700,fontSize:14,color:"var(--navy)",marginBottom:4}}>{"Aucun déplacement"}</div>
          <div style={{fontSize:12}}>{"Ajoutez vos déplacements professionnels de "+MOIS_NOM[parseInt(filtreMois.split("-")[1])-1]}</div>
        </div>
      )}

      {depMois.map(function(d,i){
        var isAR = d.allerRetour;
        return (
          <div key={d.id} style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",borderLeft:"4px solid var(--navy)",padding:"12px 14px",marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:800,color:"var(--navy)",fontSize:13,marginBottom:2}}>{d.motif}</div>
                <div style={{fontSize:11,color:"var(--g500)"}}>{d.date.split("-").reverse().join("/")}
                  {d.depart && <span>{" · "+d.depart}</span>}
                  {d.arrivee && <span>{" → "+d.arrivee}</span>}
                </div>
                <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                  <span style={{fontSize:11,background:"var(--g50)",borderRadius:20,padding:"1px 8px",fontWeight:700,color:"var(--navy)"}}>{fmtKm(d.kmReel)+(isAR?" (A/R)":"")}</span>
                  <span style={{fontSize:11,background:"#F0FDF4",color:"var(--green)",borderRadius:20,padding:"1px 8px",fontWeight:700}}>{fmtEur(d.indemnite)}</span>
                </div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:8}}>
                <button onClick={function(){openEdit(d);}} style={{background:"var(--g50)",border:"none",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:13}}>{"✏️"}</button>
                <button onClick={function(){deleteEntry(d.id);}} style={{background:"#FEF2F2",border:"none",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:13}}>{"🗑️"}</button>
              </div>
            </div>
          </div>
        );
      })}

      {/* ─── TOTAL MOIS ──────────────────────────────────────────────────── */}
      {depMois.length>0 && (
        <div style={{background:"linear-gradient(135deg,#059669,#10B981)",borderRadius:12,padding:"14px 16px",marginTop:8,display:"flex",justifyContent:"space-between",alignItems:"center",color:"#fff"}}>
          <div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",marginBottom:2}}>{"Total "+MOIS_NOM[parseInt(filtreMois.split("-")[1])-1]}</div>
            <div style={{fontWeight:900,fontSize:18}}>{fmtKm(totalKmMois)+" · "+fmtEur(totalIndemMois)}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",marginBottom:2}}>{"Cumul "+annee}</div>
            <div style={{fontWeight:800,fontSize:14}}>{fmtKm(totalKmAnnee)+" · "+fmtEur(totalIndemAnnee)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
