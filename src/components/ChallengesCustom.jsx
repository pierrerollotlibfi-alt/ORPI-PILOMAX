import { useState, useMemo } from "react";
import { useApp } from "../App";
import { Modal, avatarColor, fmt } from "./Shared";

// ─── CHALLENGES PERSONNALISES (créés par le manager) ────────────────────────
// Le manager définit : nom, indicateur, objectif, période. Le classement se
// calcule en direct à partir des mandats / ventes / prospection / visites.

var INDICATEURS = [
  { v: "mandats",     label: "Mandats rentrés",     unite: "mandat",  icon: "\uD83D\uDCDD" },
  { v: "ventes",      label: "Ventes / compromis",  unite: "vente",   icon: "\uD83E\uDD1D" },
  { v: "prospection", label: "Actions prospection", unite: "action",  icon: "\uD83D\uDEB6" },
  { v: "visites",     label: "Visites effectuées",  unite: "visite",  icon: "\uD83D\uDD11" },
];
var PERIODES = [
  { v: "hebdo",   label: "Cette semaine" },
  { v: "mensuel", label: "Ce mois-ci" },
  { v: "libre",   label: "Dates libres" },
];

function lundiCourant() {
  var d = new Date(); var day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1); d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10);
}
function dimancheCourant() {
  var d = new Date(lundiCourant()); d.setDate(d.getDate()+6);
  return d.toISOString().slice(0,10);
}
function debutMois() {
  var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10);
}
function finMois() {
  var d = new Date(); return new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10);
}

export default function ChallengesCustom() {
  var ctx = useApp();
  var agenceId = ctx.currentUser.agenceId;
  var role = ctx.currentUser.role;
  var isManager = role === "manager" || role === "superadmin" || role === "admin";

  var challenges = (ctx.challenges || []).filter(function(c){ return c.agenceId === agenceId; });
  var agents = (ctx.users || []).filter(function(u){
    return u.agenceId === agenceId && u.actif &&
      (u.role === "agent" || u.role === "manager" || u.role === "superadmin" || u.role === "admin");
  });
  var mandats = (ctx.mandats || []).filter(function(m){ return m.agenceId === agenceId; });
  var ventes = (ctx.ventes || []).filter(function(v){ return v.agenceId === agenceId; });
  var prospection = (ctx.prospection || []).filter(function(p){ return p.agenceId === agenceId; });

  var [showForm, setShowForm] = useState(false);
  var [edit, setEdit] = useState(null);

  function nomAgent(id) {
    var a = agents.find(function(x){ return x.id === id; });
    return a ? a.nom : "?";
  }

  // Calcule le score d'un agent pour un challenge
  function scoreAgent(ch, agentId) {
    var d1 = ch.debut, d2 = ch.fin;
    if (ch.indicateur === "mandats") {
      return mandats.filter(function(m){
        var dt = m.dateMandat || "";
        return m.agentId === agentId && dt >= d1 && dt <= d2;
      }).length;
    }
    if (ch.indicateur === "ventes") {
      return ventes.filter(function(v){
        var dt = v.date || "";
        return (v.agentId === agentId || v.agentId2 === agentId) && dt >= d1 && dt <= d2;
      }).length;
    }
    if (ch.indicateur === "prospection") {
      return prospection.filter(function(p){
        return p.agentId === agentId && p.date >= d1 && p.date <= d2;
      }).length;
    }
    if (ch.indicateur === "visites") {
      var n = 0;
      mandats.forEach(function(m){
        (m.visites || []).forEach(function(vis){
          var dt = (vis && vis.date) ? vis.date : "";
          if (m.agentId === agentId && dt >= d1 && dt <= d2) n++;
        });
      });
      return n;
    }
    return 0;
  }

  function classement(ch) {
    return agents.map(function(a){
      return { id: a.id, nom: a.nom, avatar: a.avatar, score: scoreAgent(ch, a.id) };
    }).sort(function(x, y){ return y.score - x.score; });
  }

  function supprimer(id) {
    ctx.setChallenges(function(prev){ return (prev||[]).filter(function(c){ return c.id !== id; }); });
  }

  var MEDALS = ["\uD83E\uDD47","\uD83E\uDD48","\uD83E\uDD49"];

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: "var(--navy)" }}>{"\uD83C\uDFC6 Challenges personnalisés"}</div>
        {isManager && (
          <button className="btn btn-primary btn-sm" onClick={function(){ setEdit(null); setShowForm(true); }}>
            {"\u2795 Créer un challenge"}
          </button>
        )}
      </div>

      {challenges.length === 0 && (
        <div style={{ background:"#fff", border:"1px dashed var(--g300)", borderRadius:12, padding:24, textAlign:"center", color:"var(--g400)" }}>
          <div style={{ fontSize: 30, marginBottom: 6 }}>{"\uD83C\uDFC6"}</div>
          <div style={{ fontWeight: 700, color:"var(--g600)" }}>{"Aucun challenge en cours"}</div>
          {isManager && <div style={{ fontSize: 12, marginTop: 4 }}>{"Créez un challenge sur mesure pour motiver l'équipe."}</div>}
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap: 14 }}>
        {challenges.map(function(ch){
          var ind = INDICATEURS.find(function(x){ return x.v === ch.indicateur; }) || INDICATEURS[0];
          var cl = classement(ch);
          var leader = cl[0];
          var objectif = ch.objectif || 0;
          var auj = new Date().toISOString().slice(0,10);
          var actif = auj >= ch.debut && auj <= ch.fin;
          var termine = auj > ch.fin;
          return (
            <div key={ch.id} style={{ background:"#fff", border:"1px solid var(--g200)", borderRadius:14, overflow:"hidden" }}>
              {/* Bandeau */}
              <div style={{ background:"linear-gradient(135deg,var(--navy),#1a3a5c)", padding:"14px 16px", color:"#fff" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontWeight:900, fontSize:16 }}>{ind.icon + " " + ch.nom}</div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,0.7)", marginTop:2 }}>
                      {ind.label + " \u00B7 " + ch.debut.split("-").reverse().join("/") + " \u2192 " + ch.fin.split("-").reverse().join("/")}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                    <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10,
                      background: termine ? "rgba(255,255,255,0.15)" : actif ? "#16A34A" : "rgba(255,255,255,0.15)" }}>
                      {termine ? "Terminé" : actif ? "En cours" : "À venir"}
                    </span>
                    {isManager && (
                      <span onClick={function(){ setEdit(ch); setShowForm(true); }} style={{ cursor:"pointer", fontSize:13 }}>{"\u270F\uFE0F"}</span>
                    )}
                  </div>
                </div>
                {objectif > 0 && (
                  <div style={{ marginTop:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3, color:"rgba(255,255,255,0.8)" }}>
                      <span>{"Objectif : " + objectif + " " + ind.unite + (objectif>1?"s":"") + " / agent"}</span>
                      {leader && <span>{"Leader : " + leader.nom.split(" ")[0] + " (" + leader.score + ")"}</span>}
                    </div>
                  </div>
                )}
              </div>
              {/* Classement */}
              <div style={{ padding: "8px 0" }}>
                {cl.slice(0, 8).map(function(s, idx){
                  var col = avatarColor(s.nom);
                  var pct = objectif > 0 ? Math.min(100, Math.round(s.score / objectif * 100)) : (leader.score > 0 ? Math.round(s.score / leader.score * 100) : 0);
                  var atteint = objectif > 0 && s.score >= objectif;
                  return (
                    <div key={s.id} style={{ padding:"8px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:5 }}>
                        <div style={{ width:22, textAlign:"center", fontWeight:900, fontSize:14, color: idx<3?"var(--navy)":"var(--g400)" }}>
                          {idx < 3 ? MEDALS[idx] : "#" + (idx+1)}
                        </div>
                        <div style={{ width:28, height:28, borderRadius:14, background:col, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:11, flexShrink:0 }}>{s.avatar || s.nom.slice(0,2).toUpperCase()}</div>
                        <div style={{ flex:1, fontWeight:600, fontSize:13, color:"var(--g800)" }}>{s.nom}{atteint ? " \u2705" : ""}</div>
                        <div style={{ fontWeight:900, fontSize:16, color:col }}>{s.score}</div>
                      </div>
                      <div style={{ background:"var(--g100)", borderRadius:4, height:5, overflow:"hidden" }}>
                        <div style={{ background:col, height:"100%", width:pct+"%", borderRadius:4, transition:"width .3s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {isManager && (
                <div style={{ padding:"8px 16px", borderTop:"1px solid var(--g100)", textAlign:"right" }}>
                  <span onClick={function(){ if(window.confirm("Supprimer ce challenge ?")) supprimer(ch.id); }}
                    style={{ cursor:"pointer", fontSize:12, color:"var(--g400)" }}>{"\uD83D\uDDD1\uFE0F Supprimer"}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showForm && <ChallengeForm challenge={edit} onClose={function(){ setShowForm(false); }} />}
    </div>
  );
}

// ─── FORMULAIRE DE CRÉATION / ÉDITION ───────────────────────────────────────
function ChallengeForm({ challenge, onClose }) {
  var ctx = useApp();
  var isEdit = !!challenge;
  var [f, setF] = useState(function(){
    return challenge ? Object.assign({}, challenge) : {
      nom: "", indicateur: "mandats", periode: "hebdo",
      debut: lundiCourant(), fin: dimancheCourant(), objectif: 3,
    };
  });
  function up(k, val){ setF(function(p){ var n = Object.assign({}, p); n[k] = val; return n; }); }

  function changerPeriode(p) {
    var debut = f.debut, fin = f.fin;
    if (p === "hebdo") { debut = lundiCourant(); fin = dimancheCourant(); }
    else if (p === "mensuel") { debut = debutMois(); fin = finMois(); }
    setF(function(prev){ return Object.assign({}, prev, { periode: p, debut: debut, fin: fin }); });
  }

  function enregistrer() {
    if (!f.nom.trim()) return;
    var ch = {
      id: challenge ? challenge.id : "CH-" + Date.now(),
      agenceId: ctx.currentUser.agenceId,
      nom: f.nom.trim(),
      indicateur: f.indicateur,
      periode: f.periode,
      debut: f.debut, fin: f.fin,
      objectif: parseInt(f.objectif) || 0,
      creePar: ctx.currentUser.id,
    };
    ctx.setChallenges(function(prev){
      var arr = (prev || []).slice();
      var idx = arr.findIndex(function(x){ return x.id === ch.id; });
      if (idx >= 0) arr[idx] = ch; else arr.push(ch);
      return arr;
    });
    onClose();
  }

  var champ = { width:"100%", padding:"9px 10px", borderRadius:8, border:"1px solid var(--g300)", fontSize:14, boxSizing:"border-box" };
  var lab = { fontSize:12, fontWeight:600, color:"var(--g600)", marginBottom:4, display:"block" };

  return (
    <Modal title={isEdit ? "\u270F\uFE0F Modifier le challenge" : "\uD83C\uDFC6 Nouveau challenge"} onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <div>
          <label style={lab}>{"Nom du challenge"}</label>
          <input style={champ} value={f.nom} onChange={function(e){ up("nom", e.target.value); }} placeholder="Ex : Sprint mandats de septembre" />
        </div>
        <div>
          <label style={lab}>{"Indicateur mesuré"}</label>
          <select style={champ} value={f.indicateur} onChange={function(e){ up("indicateur", e.target.value); }}>
            {INDICATEURS.map(function(i){ return <option key={i.v} value={i.v}>{i.icon + " " + i.label}</option>; })}
          </select>
        </div>
        <div>
          <label style={lab}>{"Période"}</label>
          <select style={champ} value={f.periode} onChange={function(e){ changerPeriode(e.target.value); }}>
            {PERIODES.map(function(p){ return <option key={p.v} value={p.v}>{p.label}</option>; })}
          </select>
        </div>
        {f.periode === "libre" && (
          <div style={{ display:"flex", gap:10 }}>
            <div style={{ flex:1 }}>
              <label style={lab}>{"Du"}</label>
              <input style={champ} type="date" value={f.debut} onChange={function(e){ up("debut", e.target.value); }} />
            </div>
            <div style={{ flex:1 }}>
              <label style={lab}>{"Au"}</label>
              <input style={champ} type="date" value={f.fin} onChange={function(e){ up("fin", e.target.value); }} />
            </div>
          </div>
        )}
        {f.periode !== "libre" && (
          <div style={{ fontSize:12, color:"var(--g500)" }}>
            {"Du " + f.debut.split("-").reverse().join("/") + " au " + f.fin.split("-").reverse().join("/")}
          </div>
        )}
        <div>
          <label style={lab}>{"Objectif par agent (0 = classement libre)"}</label>
          <input style={champ} type="number" value={f.objectif} onChange={function(e){ up("objectif", e.target.value); }} />
        </div>
        <button className="btn btn-primary" onClick={enregistrer} disabled={!f.nom.trim()} style={{ marginTop:4 }}>
          {isEdit ? "\uD83D\uDCBE Enregistrer" : "\uD83C\uDFC6 Lancer le challenge"}
        </button>
      </div>
    </Modal>
  );
}
