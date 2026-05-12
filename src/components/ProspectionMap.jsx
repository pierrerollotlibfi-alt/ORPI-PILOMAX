import { useState, useEffect, useRef } from "react";
import { useApp } from "../App";
import { Modal, fmtDate } from "./Shared";

var MAPBOX_TOKEN = "pk.eyJ1Ijoib3JwaWRlY2xpY2ltbW8iLCJhIjoiY21uOHB5c2duMDBrZzJycXd6cmQ5cXNwcCJ9.k4utkv8sd__3bxpSFBjijA";

var TYPES_ACTION = [
  { id:"boitage", label:"Boîtage flyers",     icon:"📬", color:"#3B82F6" },
  { id:"porte",   label:"Porte-à-porte",       icon:"🚪", color:"#8B5CF6" },
  { id:"visite",  label:"Visite de bien",       icon:"🏠", color:"#10B981" },
  { id:"projet",  label:"Projet vente 6 mois", icon:"📅", color:"#F59E0B" },
];

function diffMois(dateStr) {
  if (!dateStr) return 999;
  var d = new Date(dateStr), now = new Date();
  return (now.getFullYear()-d.getFullYear())*12+(now.getMonth()-d.getMonth());
}
function couleurStatut(actions, delai) {
  if (!actions || actions.length===0) return "#EF4444";
  var sorted = actions.slice().sort(function(a,b){return b.date.localeCompare(a.date);});
  return diffMois(sorted[0].date) > delai ? "#F59E0B" : "#10B981";
}

export default function ProspectionMap({ currentUser, isManager }) {
  var ctx = useApp();
  var prospection = ctx.prospection;
  var setProspection = ctx.setProspection;
  var prospConfig = ctx.prospConfig;
  var setProspConfig = ctx.setProspConfig;
  var users = ctx.users;

  var mapContainer = useRef(null);
  var map          = useRef(null);
  var markersRef   = useRef([]);

  var [mapLoaded,      setMapLoaded]      = useState(false);
  var [selectedRue,    setSelectedRue]    = useState(null);
  var [showActionForm, setShowActionForm] = useState(false);
  var [showConfig,     setShowConfig]     = useState(false);
  var [filtreAgentProsp, setFiltreAgentProsp] = useState("all"); // "all" | agentId
  var [styleMode,      setStyleMode]      = useState("streets");
  var [zoom,           setZoom]           = useState(12);
  var [stats,          setStats]          = useState({prospectees:0, rappel:0, total:0});

  var delai  = (prospConfig && prospConfig.delaiRappelMois) || 2;
  var agents = users.filter(function(u){ return (u.role==="agent"||u.role==="manager"||u.role==="superadmin") && u.actif && u.agenceId===currentUser.agenceId; });
  // Prospection filtrée par agent
  var prospectionFiltree = filtreAgentProsp==="all" ? prospection : prospection.filter(function(a){ return a.agentId===filtreAgentProsp; });
  var actionsRue = selectedRue ? prospectionFiltree.filter(function(a){ return a.rueId===selectedRue.id; }).sort(function(a,b){ return b.date.localeCompare(a.date); }) : [];

  // Charge Mapbox GL JS
  useEffect(function() {
    if (window.mapboxgl) { initMap(); return; }
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
    document.head.appendChild(link);
    var script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
    script.onload = initMap;
    document.head.appendChild(script);
    return function() { if (map.current) { map.current.remove(); map.current = null; } };
  }, []); // eslint-disable-line

  function initMap() {
    if (map.current || !mapContainer.current) return;
    window.mapboxgl.accessToken = MAPBOX_TOKEN;
    map.current = new window.mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [2.2945, 49.8942],
      zoom: 12,
      language: "fr",
    });
    map.current.addControl(new window.mapboxgl.NavigationControl(), "top-right");
    map.current.addControl(new window.mapboxgl.ScaleControl({unit:"metric"}), "bottom-left");
    map.current.on("load", function() { setMapLoaded(true); addRoadLayer(); });
    map.current.on("zoom", function() { setZoom(Math.round(map.current.getZoom())); });
  }

  function addRoadLayer() {
    if (!map.current) return;
    if (!map.current.getSource("prosp-roads")) {
      map.current.addSource("prosp-roads", { type:"geojson", data:{type:"FeatureCollection",features:[]} });
      map.current.addLayer({ id:"prosp-roads-layer", type:"line", source:"prosp-roads", layout:{"line-join":"round","line-cap":"round"}, paint:{"line-color":["get","color"],"line-width":5,"line-opacity":0.85} });
    }
  }

  // Mise à jour marqueurs
  useEffect(function() {
    if (!mapLoaded || !map.current) return;
    markersRef.current.forEach(function(m){ m.remove(); });
    markersRef.current = [];

    var ruesProsp = {};
    prospection.forEach(function(a) {
      if (!a.rueId) return;
      if (!ruesProsp[a.rueId]) ruesProsp[a.rueId] = { actions:[], coords:a.coords, nom:a.rueNom };
      ruesProsp[a.rueId].actions.push(a);
    });

    var prospectees=0, rappelCount=0;
    Object.keys(ruesProsp).forEach(function(rueId) {
      var data = ruesProsp[rueId];
      if (!data.coords) return;
      var couleur = couleurStatut(data.actions, delai);
      if (couleur==="#10B981") prospectees++;
      else if (couleur==="#F59E0B") rappelCount++;

      var el = document.createElement("div");
      el.style.cssText = "width:28px;height:28px;border-radius:50%;background:"+couleur+";border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;";
      el.textContent = data.actions.length;
      el.title = data.nom;

      var marker = new window.mapboxgl.Marker({element:el, anchor:"center"})
        .setLngLat(data.coords)
        .addTo(map.current);

      el.addEventListener("click", function(e) {
        e.stopPropagation();
        setSelectedRue({id:rueId, nom:data.nom, coords:data.coords});
      });
      markersRef.current.push(marker);
    });

    setStats({prospectees:prospectees, rappel:rappelCount, total:Object.keys(ruesProsp).length});
  }, [mapLoaded, prospection, delai]);

  // Changement style
  useEffect(function() {
    if (!map.current || !mapLoaded) return;
    var style = styleMode==="satellite" ? "mapbox://styles/mapbox/satellite-streets-v12" : "mapbox://styles/mapbox/streets-v12";
    map.current.setStyle(style);
    map.current.once("styledata", function(){ addRoadLayer(); });
  }, [styleMode]); // eslint-disable-line

  // Clic sur carte
  useEffect(function() {
    if (!mapLoaded || !map.current) return;
    function handleClick(e) {
      if (zoom < 14) return;
      var features = map.current.queryRenderedFeatures(e.point, {
        layers: ["road-label","road-street","road-secondary-tertiary","road-primary","road-minor"]
      });
      if (features.length > 0) {
        var f   = features[0];
        var nom = (f.properties && (f.properties.name || f.properties.ref)) || "Rue sans nom";
        var rueId = "rue-" + nom.toLowerCase().replace(/[^a-z0-9]/g,"_");
        setSelectedRue({id:rueId, nom:nom, coords:[e.lngLat.lng, e.lngLat.lat]});
      }
    }
    map.current.on("click", handleClick);
    return function() { if(map.current) map.current.off("click", handleClick); };
  }, [mapLoaded, zoom]);

  function handleSaveAction(action) {
    setProspection(function(prev) {
      return [...prev, {
        ...action, id:"p-"+Date.now(),
        rueId: selectedRue.id, rueNom: selectedRue.nom,
        coords: selectedRue.coords,
        agenceId: currentUser.agenceId,
      }];
    });
    setShowActionForm(false);
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Stats bar */}
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        {[
          {label:"Rues prospectées", count:stats.prospectees, color:"#059669", bg:"#F0FDF4", icon:"🟢"},
          {label:"Rappel > "+delai+"m", count:stats.rappel, color:"#D97706", bg:"#FFFBEB", icon:"🟡"},
          {label:"Total suivi", count:stats.total, color:"#1D3557", bg:"#EFF6FF", icon:"📍"},
        ].map(function(s) {
          return (
            <div key={s.label} style={{background:s.bg,border:"1px solid "+s.color+"33",borderRadius:10,padding:"8px 14px",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:14}}>{s.icon}</span>
              <div>
                <div style={{fontWeight:800,fontSize:18,color:s.color,lineHeight:1}}>{s.count}</div>
                <div style={{fontSize:11,color:s.color,fontWeight:600}}>{s.label}</div>
              </div>
            </div>
          );
        })}
        <div style={{flex:1}}></div>
        <div style={{display:"flex",gap:4,background:"var(--g100)",borderRadius:8,padding:3}}>
          {[{v:"streets",l:"🗺️ Plan"},{v:"satellite",l:"🛰️ Satellite"}].map(function(s) {
            return (
              <button key={s.v} onClick={function(){setStyleMode(s.v);}} style={{padding:"5px 12px",borderRadius:6,border:"none",fontWeight:700,fontSize:12,cursor:"pointer",background:styleMode===s.v?"#fff":"transparent",color:styleMode===s.v?"var(--navy)":"var(--g400)",boxShadow:styleMode===s.v?"0 1px 4px rgba(0,0,0,0.1)":"none",fontFamily:"var(--font)"}}>
                {s.l}
              </button>
            );
          })}
        </div>
        {isManager && (
          <button onClick={function(){setShowConfig(true);}} style={{background:"var(--g100)",border:"none",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:700,color:"var(--g700)",fontFamily:"var(--font)"}}>
            {"⚙️ Délai : "+delai+" mois"}
          </button>
        )}
      </div>

      {zoom < 14 && (
        <div className="alert alert-info">
          {"💡 Zoomez sur une rue (niveau "+zoom+"/14+) pour la sélectionner et enregistrer une action de prospection"}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr min(340px,100%)",gap:14}} className="prosp-layout">
        {/* Carte */}
        <div style={{borderRadius:14,overflow:"hidden",border:"1px solid var(--g200)",boxShadow:"var(--sh)",position:"relative",minHeight:"min(520px,55vh)"}}>
          <div ref={mapContainer} className="carte-map-container" style={{minHeight:"min(520px,55vh)"}}></div>
          {!mapLoaded && (
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#F8FAFC",flexDirection:"column",gap:12}}>
              <div style={{fontSize:32}}>🗺️</div>
              <div style={{fontWeight:700,color:"var(--navy)"}}>{"Chargement de la carte…"}</div>
            </div>
          )}
          <div style={{position:"absolute",bottom:32,right:10,background:"rgba(255,255,255,0.92)",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:700,color:"var(--navy)",boxShadow:"var(--sh)",pointerEvents:"none"}}>
            {"Zoom : "+zoom}
          </div>
        </div>

        {/* Panneau latéral */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {selectedRue ? (
            <RuePanel
              rue={selectedRue} actions={actionsRue} delai={delai}
              agents={agents} currentUser={currentUser} isManager={isManager}
              onAddAction={function(){setShowActionForm(true);}}
              onClose={function(){setSelectedRue(null);}}
              onDelete={function(id) {
                var a = prospection.find(function(x){return x.id===id;});
                if (isManager || (a && a.agentId===currentUser.id))
                  setProspection(function(prev){return prev.filter(function(x){return x.id!==id;});});
              }}
            />
          ) : (
            <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",padding:24,textAlign:"center",color:"var(--g400)"}}>
              <div style={{fontSize:40,marginBottom:10}}>🗺️</div>
              <div style={{fontWeight:700,fontSize:14,color:"var(--navy)",marginBottom:6}}>{"Sélectionnez une rue"}</div>
              <div style={{fontSize:12,lineHeight:1.7}}>{"Zoomez jusqu'au niveau rue, puis cliquez dessus pour voir l'historique et ajouter une action."}</div>
            </div>
          )}
          <DernieresRues prospection={prospection} delai={delai} onSelect={function(id,nom,coords){setSelectedRue({id:id,nom:nom,coords:coords});}} mapRef={map}/>
        </div>
      </div>

      {/* Actions récentes */}
      <ActionsRecentes prospection={prospection} agents={agents} currentUser={currentUser} isManager={isManager} setProspection={setProspection}/>

      {/* Modals */}
      {showActionForm && selectedRue && (
        <ActionForm rue={selectedRue} agents={agents} currentUser={currentUser} isManager={isManager} onSave={handleSaveAction} onClose={function(){setShowActionForm(false);}}/>
      )}
      {showConfig && (
        <ConfigModal delai={delai} onSave={function(v){setProspConfig({...prospConfig,delaiRappelMois:v});setShowConfig(false);}} onClose={function(){setShowConfig(false);}}/>
      )}
    </div>
  );
}

// ─── RUE PANEL ────────────────────────────────────────────────────────────────
function RuePanel({ rue, actions, delai, agents, currentUser, isManager, onAddAction, onClose, onDelete }) {
  var derniere = actions[0];
  var mois   = derniere ? diffMois(derniere.date) : null;
  var statut = !derniere ? "jamais" : mois > delai ? "rappel" : "ok";
  var couleur = statut==="ok" ? "#059669" : statut==="rappel" ? "#D97706" : "#DC2626";
  var bg      = statut==="ok" ? "#F0FDF4" : statut==="rappel" ? "#FFFBEB" : "#FEF2F2";
  var statutText = statut==="ok" ? ("✅ Il y a "+mois+" mois") : statut==="rappel" ? ("⚠️ "+mois+" mois — rappel requis") : "🔴 Jamais prospectée";

  return (
    <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",overflow:"hidden",boxShadow:"var(--sh)"}}>
      <div style={{background:"var(--navy)",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{color:"#fff",fontWeight:800,fontSize:14,marginBottom:2}}>{"📍 "+rue.nom}</div>
          <div style={{color:"rgba(255,255,255,0.5)",fontSize:11}}>{actions.length+" action"+(actions.length!==1?"s":"")+" enregistrée"+(actions.length!==1?"s":"")}</div>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,0.5)",fontSize:20,cursor:"pointer",lineHeight:1,padding:0}}>{"×"}</button>
      </div>
      <div style={{padding:"10px 14px",background:bg,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,fontWeight:700,color:couleur}}>{statutText}</span>
        <button className="btn btn-primary btn-sm" onClick={onAddAction}>{"+ Action"}</button>
      </div>
      <div style={{maxHeight:260,overflowY:"auto",padding:"10px 14px"}}>
        {actions.length===0 ? (
          <div style={{textAlign:"center",color:"var(--g400)",fontSize:12,padding:"16px 0"}}>{"Aucune action enregistrée sur cette rue"}</div>
        ) : actions.map(function(a) {
          var agent   = agents.find(function(x){return x.id===a.agentId;});
          var type    = TYPES_ACTION.find(function(t){return t.id===a.type;});
          var canDel  = isManager || a.agentId===currentUser.id;
          return (
            <div key={a.id} style={{marginBottom:10,padding:"10px 12px",background:"var(--g50)",borderRadius:10,border:"1px solid var(--g100)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:16}}>{type && type.icon}</span>
                  <span style={{fontWeight:700,fontSize:12,color:"var(--navy)"}}>{type && type.label}</span>
                </div>
                {canDel && <button onClick={function(){onDelete(a.id);}} style={{background:"none",border:"none",color:"#EF4444",cursor:"pointer",fontSize:13}}>{"×"}</button>}
              </div>
              <div style={{fontSize:11,color:"var(--g500)",marginBottom:3}}>{fmtDate(a.date)+" · "+(agent && agent.nom)}</div>
              {a.notes && <div style={{fontSize:11,color:"var(--g700)",fontStyle:"italic",marginBottom:4}}>{'"'+a.notes+'"'}</div>}
              {a.photos && a.photos.length>0 && (
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                  {a.photos.map(function(p, i) {
                    return (
                      <img key={i} src={p} alt={"photo-"+i} style={{width:60,height:60,objectFit:"cover",borderRadius:7,border:"1px solid var(--g200)",cursor:"pointer"}} onClick={function(){window.open(p,"_blank");}}/>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DERNIÈRES RUES ───────────────────────────────────────────────────────────
function DernieresRues({ prospection, delai, onSelect, mapRef }) {
  var rues = {};
  prospection.forEach(function(a) {
    if (!a.rueId) return;
    if (!rues[a.rueId]) rues[a.rueId] = {id:a.rueId, nom:a.rueNom, coords:a.coords, actions:[]};
    rues[a.rueId].actions.push(a);
  });
  var rappel = Object.values(rues).filter(function(r) {
    var sorted = r.actions.slice().sort(function(a,b){return b.date.localeCompare(a.date);});
    return diffMois(sorted[0] && sorted[0].date) > delai;
  }).sort(function(a,b) {
    var da = a.actions.slice().sort(function(x,y){return y.date.localeCompare(x.date);})[0];
    var db = b.actions.slice().sort(function(x,y){return y.date.localeCompare(x.date);})[0];
    return diffMois(da && da.date) - diffMois(db && db.date);
  }).slice(0,6);

  if (rappel.length===0) return null;
  return (
    <div style={{background:"#FFFBEB",borderRadius:12,border:"1px solid #FDE68A",overflow:"hidden"}}>
      <div style={{padding:"10px 14px",borderBottom:"1px solid #FDE68A",fontWeight:800,color:"#92400E",fontSize:12}}>{"⚠️ Rues à re-prospecter"}</div>
      <div style={{padding:"8px 10px",display:"flex",flexDirection:"column",gap:5}}>
        {rappel.map(function(r) {
          var d = r.actions.slice().sort(function(a,b){return b.date.localeCompare(a.date);})[0];
          return (
            <button key={r.id} onClick={function(){onSelect(r.id,r.nom,r.coords); if(mapRef.current&&r.coords) mapRef.current.flyTo({center:r.coords,zoom:16});}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fff",border:"1px solid #FDE68A",borderRadius:7,padding:"6px 10px",cursor:"pointer",textAlign:"left",width:"100%",fontFamily:"var(--font)"}}>
              <span style={{fontSize:12,fontWeight:700,color:"#92400E",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180}}>{r.nom}</span>
              <span style={{fontSize:11,color:"#B45309",fontWeight:600,flexShrink:0,marginLeft:8}}>{diffMois(d&&d.date)+" mois"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── ACTIONS RÉCENTES ─────────────────────────────────────────────────────────
function ActionsRecentes({ prospection, agents, currentUser, isManager, setProspection }) {
  var recentes = prospection.slice().sort(function(a,b){return b.date.localeCompare(a.date);}).slice(0,10);
  if (recentes.length===0) return null;
  return (
    <div className="card">
      <div className="card-header"><span className="card-title">{"📋 Dernières actions de prospection"}</span></div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {["Date","Rue","Type","Agent","Notes","Photos",""].map(function(h){ return <th key={h}>{h}</th>; })}
            </tr>
          </thead>
          <tbody>
            {recentes.map(function(a) {
              var agent  = agents.find(function(x){return x.id===a.agentId;});
              var type   = TYPES_ACTION.find(function(t){return t.id===a.type;});
              var canDel = isManager || a.agentId===currentUser.id;
              return (
                <tr key={a.id}>
                  <td style={{fontWeight:700,color:"var(--navy)",whiteSpace:"nowrap"}}>{fmtDate(a.date)}</td>
                  <td style={{fontWeight:600,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.rueNom||"—"}</td>
                  <td>
                    <span style={{background:type?type.color+"22":"#eee",color:type&&type.color,padding:"2px 8px",borderRadius:6,fontWeight:700,fontSize:11,whiteSpace:"nowrap"}}>
                      {type&&type.icon} {type&&type.label}
                    </span>
                  </td>
                  <td style={{whiteSpace:"nowrap"}}>{agent&&agent.nom}</td>
                  <td style={{color:"var(--g500)",fontStyle:"italic",maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.notes||"—"}</td>
                  <td>
                    {a.photos && a.photos.length>0 && (
                      <div style={{display:"flex",gap:4}}>
                        {a.photos.slice(0,3).map(function(p,i){
                          return <img key={i} src={p} alt="" style={{width:32,height:32,objectFit:"cover",borderRadius:5,cursor:"pointer"}} onClick={function(){window.open(p,"_blank");}}/>;
                        })}
                        {a.photos.length>3 && <span style={{fontSize:11,color:"var(--g400)",alignSelf:"center"}}>{"+"+(a.photos.length-3)}</span>}
                      </div>
                    )}
                  </td>
                  <td>
                    {canDel && <button onClick={function(){setProspection(function(prev){return prev.filter(function(x){return x.id!==a.id;});});}} style={{background:"none",border:"none",color:"#EF4444",cursor:"pointer",fontSize:13}}>{"×"}</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── FORMULAIRE ACTION + PHOTOS ───────────────────────────────────────────────
function ActionForm({ rue, agents, currentUser, isManager, onSave, onClose }) {
  var today2 = new Date().toISOString().slice(0,10);
  var [f, setF] = useState({
    type:"boitage", date:today2,
    agentId: isManager ? "" : currentUser.id,
    notes:"", photos:[],
  });
  var [uploading, setUploading] = useState(false);
  function set(k, v) { setF(function(p){ return {...p,[k]:v}; }); }

  function handlePhotos(e) {
    var files = Array.from(e.target.files);
    setUploading(true);
    Promise.all(files.map(function(file) {
      return new Promise(function(resolve) {
        var reader = new FileReader();
        reader.onload = function(ev){ resolve(ev.target.result); };
        reader.readAsDataURL(file);
      });
    })).then(function(results) {
      setF(function(p){ return {...p, photos:[...p.photos,...results]}; });
      setUploading(false);
    });
  }

  var valid = f.type && f.date && f.agentId;
  return (
    <Modal title={"📍 Nouvelle action — "+rue.nom} onClose={onClose}
      footer={
        <div style={{display:"flex",gap:8,width:"100%"}}>
          <button className="btn btn-secondary" onClick={onClose}>{"Annuler"}</button>
          <button className="btn btn-primary" style={{flex:1,opacity:valid?1:0.5}} onClick={function(){if(valid)onSave(f);}}>{"Enregistrer"}</button>
        </div>
      }>
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">{"Type d'action"}</label>
          <select className="form-select" value={f.type} onChange={function(e){set("type",e.target.value);}}>
            {TYPES_ACTION.map(function(t){ return <option key={t.id} value={t.id}>{t.icon+" "+t.label}</option>; })}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{"Date"}</label>
          <input className="form-input" type="date" value={f.date} onChange={function(e){set("date",e.target.value);}}/>
        </div>
        <div className="form-group form-full">
          <label className="form-label">{"Agent commercial"}</label>
          {isManager ? (
            <select className="form-select" value={f.agentId} onChange={function(e){set("agentId",e.target.value);}}>
              <option value="">{"— Choisir —"}</option>
              {agents.map(function(a){ return <option key={a.id} value={a.id}>{a.nom}</option>; })}
            </select>
          ) : (
            <input className="form-input" value={currentUser.nom} disabled style={{background:"var(--g100)",color:"var(--g500)"}}/>
          )}
        </div>
        <div className="form-group form-full">
          <label className="form-label">{"Notes (optionnel)"}</label>
          <textarea className="form-input" rows={3} placeholder="Ex: 50 flyers distribués rue entière, contact intéressé au n°12..." value={f.notes} onChange={function(e){set("notes",e.target.value);}} style={{resize:"vertical",fontFamily:"var(--font)"}}></textarea>
        </div>
      </div>
      <div>
        <label className="form-label" style={{display:"block",marginBottom:8}}>{"📷 Photos (flyer, terrain...)"}</label>
        <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,border:"2px dashed var(--g200)",borderRadius:10,padding:14,cursor:"pointer",background:"var(--g50)",marginBottom:10}}>
          <input type="file" accept="image/*" multiple onChange={handlePhotos} style={{display:"none"}}/>
          <span style={{fontSize:20}}>{"📎"}</span>
          <span style={{fontSize:13,color:"var(--g500)",fontWeight:600}}>{uploading ? "Chargement…" : "Cliquez pour ajouter des photos"}</span>
        </label>
        {f.photos.length>0 && (
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {f.photos.map(function(p, i) {
              return (
                <div key={i} style={{position:"relative"}}>
                  <img src={p} alt="" style={{width:80,height:80,objectFit:"cover",borderRadius:9,border:"1px solid var(--g200)"}}/>
                  <button onClick={function(){setF(function(prev){ return {...prev, photos:prev.photos.filter(function(_,idx){return idx!==i;})};});}} style={{position:"absolute",top:-6,right:-6,width:20,height:20,borderRadius:"50%",background:"#EF4444",border:"2px solid #fff",color:"#fff",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,lineHeight:1}}>
                    {"×"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div style={{background:"var(--g50)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"var(--g700)"}}>
        {"📍 Rue sélectionnée : "}<strong>{rue.nom}</strong>
      </div>
    </Modal>
  );
}

// ─── CONFIG DÉLAI ─────────────────────────────────────────────────────────────
function ConfigModal({ delai, onSave, onClose }) {
  var [val, setVal] = useState(delai);
  return (
    <Modal title={"⚙️ Délai de re-prospection"} onClose={onClose}
      footer={
        <div style={{display:"flex",gap:8,width:"100%"}}>
          <button className="btn btn-secondary" onClick={onClose}>{"Annuler"}</button>
          <button className="btn btn-primary" onClick={function(){onSave(Number(val));}}>{"Enregistrer"}</button>
        </div>
      }>
      <div className="alert alert-info">{"Délai au-delà duquel une rue apparaît en orange sur la carte."}</div>
      <div className="form-group">
        <label className="form-label">{"Délai de rappel"}</label>
        <select className="form-select" value={val} onChange={function(e){setVal(e.target.value);}}>
          {[1,2,3,4,6,12].map(function(v){ return <option key={v} value={v}>{v+" mois"}</option>; })}
        </select>
      </div>
    </Modal>
  );
}
