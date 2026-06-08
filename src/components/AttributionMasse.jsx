import { useState, useMemo } from "react";
import { useApp } from "../App";
import { Modal, fmt, avatarColor } from "./Shared";

// ─── ECRAN D'ATTRIBUTION EN MASSE DES MANDATS ───────────────────────────────
// Permet de reassigner rapidement l'agent responsable de chaque mandat.
// Utile apres un import SweepBright (qui ne porte pas l'agent negociateur).
export default function AttributionMasse({ onClose }) {
  var ctx = useApp();
  var agenceId = ctx.currentUser.agenceId;
  var mandats = (ctx.mandats || []).filter(function(m){ return m.agenceId === agenceId; });
  var setMandats = ctx.setMandats;
  var addJournal = ctx.addJournal;

  // Liste des agents attribuables
  var agents = (ctx.users || []).filter(function(u){
    return u.agenceId === agenceId && u.actif &&
      (u.role === "agent" || u.role === "manager" || u.role === "superadmin" || u.role === "admin");
  });

  // Etat local : map mandatId -> nouvel agentId (modifications en attente)
  var [changes, setChanges] = useState({});
  var [filtreAgent, setFiltreAgent] = useState("");   // filtrer par agent actuel
  var [filtreStatut, setFiltreStatut] = useState("");
  var [recherche, setRecherche] = useState("");
  var [saved, setSaved] = useState(false);

  function nomAgent(id) {
    var a = agents.find(function(x){ return x.id === id; });
    return a ? (a.prenom + " " + a.nom) : (id === "manager-1" ? "Non attribue" : "?");
  }

  // Mandats filtres + tries
  var liste = useMemo(function() {
    var q = recherche.trim().toLowerCase();
    return mandats
      .filter(function(m) {
        if (filtreAgent && m.agentId !== filtreAgent) return false;
        if (filtreStatut && m.statut !== filtreStatut) return false;
        if (q) {
          var hay = ((m.ref||"") + " " + (m.adresse||"") + " " + (m.proprietaireNom||"")).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      })
      .sort(function(a, b) {
        // Non attribues (manager-1) en premier
        var aNon = a.agentId === "manager-1" ? 0 : 1;
        var bNon = b.agentId === "manager-1" ? 0 : 1;
        if (aNon !== bNon) return aNon - bNon;
        return (b.prix || 0) - (a.prix || 0);
      });
  }, [mandats, filtreAgent, filtreStatut, recherche]);

  var nbChanges = Object.keys(changes).length;
  var nbNonAttribues = mandats.filter(function(m){ return m.agentId === "manager-1"; }).length;

  function setChange(mandatId, newAgentId) {
    setChanges(function(prev) {
      var next = Object.assign({}, prev);
      var original = mandats.find(function(m){ return m.id === mandatId; });
      if (original && original.agentId === newAgentId) {
        delete next[mandatId]; // pas de changement reel
      } else {
        next[mandatId] = newAgentId;
      }
      return next;
    });
    setSaved(false);
  }

  function enregistrer() {
    if (nbChanges === 0) return;
    setMandats(function(prev) {
      return prev.map(function(m) {
        if (changes[m.id]) {
          return Object.assign({}, m, { agentId: changes[m.id] });
        }
        return m;
      });
    });
    if (addJournal) {
      addJournal({
        type: "modification",
        description: "Attribution en masse : " + nbChanges + " mandat(s) reassigne(s)",
        cible: "mandat",
      });
    }
    setChanges({});
    setSaved(true);
  }

  var STATUTS = [
    { v: "", l: "Tous les statuts" },
    { v: "mandat", l: "Mandats actifs" },
    { v: "sous_offre", l: "Sous offre" },
    { v: "compromis", l: "Compromis" },
    { v: "vendu", l: "Vendus" },
  ];

  return (
    <Modal title={"\uD83D\uDC65 Attribution des mandats"} onClose={onClose} wide>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:13,color:"var(--g600)",lineHeight:1.5,marginBottom:10}}>
          {"Choisissez l'agent responsable de chaque mandat. Les biens non attribues apparaissent en premier. Les modifications ne sont enregistrees que lorsque vous cliquez sur le bouton en bas."}
        </div>

        {nbNonAttribues > 0 && (
          <div style={{background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#92400E",marginBottom:10}}>
            {"\u26A0\uFE0F " + nbNonAttribues + " mandat(s) sans agent attribue (affiches en haut)."}
          </div>
        )}

        {/* Filtres */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
          <input
            value={recherche}
            onChange={function(e){ setRecherche(e.target.value); }}
            placeholder={"\uD83D\uDD0D Rechercher (ref, adresse, proprietaire)"}
            style={{flex:"1 1 200px",minWidth:160,padding:"8px 10px",borderRadius:8,border:"1px solid var(--g300)",fontSize:13}}
          />
          <select value={filtreAgent} onChange={function(e){ setFiltreAgent(e.target.value); }}
            style={{padding:"8px 10px",borderRadius:8,border:"1px solid var(--g300)",fontSize:13}}>
            <option value="">{"Tous les agents"}</option>
            <option value="manager-1">{"Non attribue"}</option>
            {agents.map(function(a){
              return <option key={a.id} value={a.id}>{a.prenom + " " + a.nom}</option>;
            })}
          </select>
          <select value={filtreStatut} onChange={function(e){ setFiltreStatut(e.target.value); }}
            style={{padding:"8px 10px",borderRadius:8,border:"1px solid var(--g300)",fontSize:13}}>
            {STATUTS.map(function(s){ return <option key={s.v} value={s.v}>{s.l}</option>; })}
          </select>
        </div>

        <div style={{fontSize:12,color:"var(--g500)",marginBottom:6}}>
          {liste.length + " mandat(s) affiche(s)"}
        </div>
      </div>

      {/* Liste */}
      <div style={{maxHeight:"50vh",overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
        {liste.map(function(m) {
          var current = changes[m.id] || m.agentId;
          var isChanged = !!changes[m.id];
          var isNonAttribue = m.agentId === "manager-1" && !changes[m.id];
          return (
            <div key={m.id} style={{
              display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,
              border: isChanged ? "1px solid var(--red)" : "1px solid var(--g200)",
              background: isChanged ? "#FEF2F2" : (isNonAttribue ? "#FFFBEB" : "#fff"),
            }}>
              <div style={{flex:"1 1 auto",minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:"var(--g800)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {(m.ref || "") + " \u2014 " + (m.adresse || "").split(",")[0]}
                </div>
                <div style={{fontSize:11,color:"var(--g500)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {(m.proprietaireNom || "?") + " \u00B7 " + fmt(m.prix)}
                </div>
              </div>
              <select
                value={current}
                onChange={function(e){ setChange(m.id, e.target.value); }}
                style={{
                  flex:"0 0 auto",minWidth:150,padding:"7px 8px",borderRadius:8,fontSize:13,
                  border: isChanged ? "1px solid var(--red)" : "1px solid var(--g300)",
                  fontWeight: isChanged ? 600 : 400,
                }}>
                <option value="manager-1">{"\u2014 Non attribue \u2014"}</option>
                {agents.map(function(a){
                  return <option key={a.id} value={a.id}>{a.prenom + " " + a.nom}</option>;
                })}
              </select>
            </div>
          );
        })}
        {liste.length === 0 && (
          <div style={{textAlign:"center",padding:30,color:"var(--g400)",fontSize:13}}>
            {"Aucun mandat ne correspond aux filtres."}
          </div>
        )}
      </div>

      {/* Pied : enregistrer */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginTop:14,paddingTop:12,borderTop:"1px solid var(--g200)"}}>
        <div style={{fontSize:13,color: nbChanges > 0 ? "var(--red)" : "var(--g500)",fontWeight: nbChanges > 0 ? 600 : 400}}>
          {saved ? "\u2705 Modifications enregistrees"
                 : (nbChanges > 0 ? (nbChanges + " modification(s) en attente") : "Aucune modification")}
        </div>
        <button
          className="btn btn-primary"
          disabled={nbChanges === 0}
          onClick={enregistrer}
          style={{opacity: nbChanges === 0 ? 0.5 : 1}}>
          {"\uD83D\uDCBE Enregistrer " + (nbChanges > 0 ? "(" + nbChanges + ")" : "")}
        </button>
      </div>
    </Modal>
  );
}
