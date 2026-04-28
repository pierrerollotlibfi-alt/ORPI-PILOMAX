import { useState, useMemo } from "react";
import { useApp } from "../App";
import { notifLeadAttribue, notifLeadTraite } from "../notifications";
import { Modal, avatarColor, fmtDate, fmt } from "./Shared";

var STATUTS = [
  { id:"nouveau",   label:"Nouveau",   icon:"🔵", color:"#2563EB", bg:"#EFF6FF" },
  { id:"contacte",  label:"Contacté",  icon:"🟡", color:"#D97706", bg:"#FFFBEB" },
  { id:"rdv",       label:"RDV fixé",  icon:"🟣", color:"#7C3AED", bg:"#F5F3FF" },
  { id:"mandat",    label:"Mandat",    icon:"🟢", color:"#059669", bg:"#F0FDF4" },
  { id:"perdu",     label:"Perdu",     icon:"🔴", color:"#DC2626", bg:"#FEF2F2" },
];
var PRIORITES = [
  { id:"haute",   label:"Haute",   color:"#DC2626", bg:"#FEF2F2" },
  { id:"normale", label:"Normale", color:"#D97706", bg:"#FFFBEB" },
  { id:"basse",   label:"Basse",   color:"#6B7280", bg:"var(--g100)" },
];
var SOURCES = ["Site web","SeLoger","Leboncoin","PAP","Bien'ici","Facebook","Recommandation","Panneau","Téléphone","Autre"];
var TYPES_BIEN = ["Vente","Location","Estimation","Autre"];

var INIT_LEADS = [
  { id:"lead-1", nom:"Marc Dubois", telephone:"06 44 55 66 77", email:"m.dubois@email.fr", source:"Site web", typeBien:"Vente", secteur:"Amiens Centre", budget:280000, budgetMax:320000, notes:"Cherche T3 proche centre, budget flexible", statut:"nouveau", priorite:"haute", agentId:"agent-1", agenceId:"agence-1", dateCreation:"2026-04-12", contacts:[], attribueAt:"2026-04-12" },
  { id:"lead-2", nom:"Isabelle Fontaine", telephone:"07 33 44 55 66", email:"", source:"Leboncoin", typeBien:"Vente", secteur:"Longueau", budget:240000, budgetMax:280000, notes:"Maison avec jardin, secteur calme", statut:"contacte", priorite:"normale", agentId:"agent-2", agenceId:"agence-1", dateCreation:"2026-04-10", contacts:[{date:"2026-04-11",note:"Appel OK, intéressée"}], attribueAt:"2026-04-10" },
  { id:"lead-3", nom:"Thomas Leroy", telephone:"07 11 22 33 44", email:"t.leroy@gmail.com", source:"SeLoger", typeBien:"Vente", secteur:"Henriville", budget:350000, budgetMax:400000, notes:"Budget 350-400k€, recherche T4", statut:"rdv", priorite:"normale", agentId:"agent-3", agenceId:"agence-1", dateCreation:"2026-04-08", contacts:[{date:"2026-04-09",note:"RDV fixé le 16/04"},{date:"2026-04-10",note:"Confirmation RDV"}], attribueAt:"2026-04-08" },
  { id:"lead-4", nom:"Sophie Renard", telephone:"06 55 44 33 22", email:"s.renard@email.fr", source:"Facebook", typeBien:"Location", secteur:"Jules Verne", budget:800, budgetMax:950, notes:"Cherche T2, disponible fin avril", statut:"nouveau", priorite:"normale", agentId:null, agenceId:"agence-1", dateCreation:"2026-04-13", contacts:[], attribueAt:null },
  { id:"lead-5", nom:"Famille Martin", telephone:"03 22 11 44 55", email:"", source:"Recommandation", typeBien:"Estimation", secteur:"Amiens Sud", budget:0, budgetMax:0, notes:"Estimation maison 180m², propriétaires depuis 20 ans", statut:"mandat", priorite:"haute", agentId:"agent-1", agenceId:"agence-1", dateCreation:"2026-04-05", contacts:[{date:"2026-04-06",note:"Prise de contact"},{date:"2026-04-09",note:"Estimation effectuée"},{date:"2026-04-11",note:"Mandat signé !"}], attribueAt:"2026-04-05" },
];

export default function Leads() {
  var ctx = useApp();
  var isManager = ctx.currentUser.role === "manager";
  var agenceId = ctx.currentUser.agenceId;
  var agents = ctx.users.filter(function(u){ return u.role==="agent" && u.actif && u.agenceId===agenceId; });

  // Load leads from localStorage or init with demo
  var SK = "orpi_data_leads_v1";
  var [leads, setLeadsState] = useState(function() {
    try { var v = localStorage.getItem(SK); return v ? JSON.parse(v) : INIT_LEADS; } catch(e) { return INIT_LEADS; }
  });
  function setLeads(updater) {
    setLeadsState(function(prev) {
      var next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem(SK, JSON.stringify(next)); } catch(e) {}
      return next;
    });
  }

  var [showForm,    setShowForm]    = useState(false);
  var [showDetail,  setShowDetail]  = useState(null);
  var [filterStatut,setFilterStatut]= useState("");
  var [filterAgent, setFilterAgent] = useState("");
  var [filterPrio,  setFilterPrio]  = useState("");

  var myLeads = isManager
    ? leads.filter(function(l){ return l.agenceId===agenceId; })
    : leads.filter(function(l){ return l.agentId===ctx.currentUser.id; });

  var filtered = useMemo(function() {
    return myLeads.filter(function(l) {
      if (filterStatut && l.statut!==filterStatut) return false;
      if (filterAgent  && l.agentId!==filterAgent)  return false;
      if (filterPrio   && l.priorite!==filterPrio)   return false;
      return true;
    });
  }, [myLeads, filterStatut, filterAgent, filterPrio]);

  var stats = STATUTS.map(function(s) {
    return {...s, count: myLeads.filter(function(l){ return l.statut===s.id; }).length};
  });
  var nonAttribues = myLeads.filter(function(l){ return !l.agentId; }).length;

  function updateLead(id, patch) {
    if (patch.statut && (patch.statut==="traite"||patch.statut==="gagne"||patch.statut==="perdu")) {
      var lead2 = leads.find(function(l){return l.id===id;});
      if (lead2 && lead2.statut!==patch.statut) { notifLeadTraite({...lead2,...patch}, ""); }
    }
    setLeads(function(prev){ return prev.map(function(l){ return l.id===id ? {...l,...patch} : l; }); });
    if (showDetail && showDetail.id===id) setShowDetail(function(prev){ return {...prev,...patch}; });
  }
  function deleteLead(id) {
    if (!window.confirm("Supprimer ce lead ?")) return;
    setLeads(function(prev){ return prev.filter(function(l){ return l.id!==id; }); });
    setShowDetail(null);
  }
  function addContact(leadId, note) {
    var contact = { date:new Date().toISOString().slice(0,10), note:note };
    setLeads(function(prev){ return prev.map(function(l){ return l.id===leadId ? {...l, contacts:[...(l.contacts||[]),contact]} : l; }); });
    setShowDetail(function(prev){ return {...prev, contacts:[...(prev.contacts||[]),contact]}; });
  }

  return (
    <div>
      {/* Stats pipeline */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        {stats.map(function(s) {
          return (
            <div key={s.id} onClick={function(){setFilterStatut(filterStatut===s.id?"":s.id);}} style={{background:s.bg,border:"1px solid "+s.color+"44",borderRadius:10,padding:"7px 14px",display:"flex",alignItems:"center",gap:8,cursor:"pointer",outline:filterStatut===s.id?"3px solid "+s.color:"none"}}>
              <span style={{fontSize:15}}>{s.icon}</span>
              <div>
                <div style={{fontWeight:900,fontSize:17,color:s.color,lineHeight:1}}>{s.count}</div>
                <div style={{fontSize:10,color:s.color,fontWeight:600}}>{s.label}</div>
              </div>
            </div>
          );
        })}
        {nonAttribues>0 && (
          <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,padding:"7px 14px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:15}}>{"⚠️"}</span>
            <div>
              <div style={{fontWeight:900,fontSize:17,color:"var(--red)",lineHeight:1}}>{nonAttribues}</div>
              <div style={{fontSize:10,color:"var(--red)",fontWeight:600}}>{"Non attribués"}</div>
            </div>
          </div>
        )}
      </div>

      {/* Filtres + bouton */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <select className="form-select" style={{width:"auto"}} value={filterStatut} onChange={function(e){setFilterStatut(e.target.value);}}>
          <option value="">{"Tous statuts"}</option>
          {STATUTS.map(function(s){ return <option key={s.id} value={s.id}>{s.icon+" "+s.label}</option>; })}
        </select>
        {isManager && (
          <select className="form-select" style={{width:"auto"}} value={filterAgent} onChange={function(e){setFilterAgent(e.target.value);}}>
            <option value="">{"Tous les agents"}</option>
            <option value="none">{"⚠️ Non attribués"}</option>
            {agents.map(function(a){ return <option key={a.id} value={a.id}>{a.nom}</option>; })}
          </select>
        )}
        <select className="form-select" style={{width:"auto"}} value={filterPrio} onChange={function(e){setFilterPrio(e.target.value);}}>
          <option value="">{"Toutes priorités"}</option>
          {PRIORITES.map(function(p){ return <option key={p.id} value={p.id}>{p.label}</option>; })}
        </select>
        <span style={{fontSize:13,color:"var(--g400)"}}>{filtered.length+" lead(s)"}</span>
        <div style={{flex:1}}></div>
        <button className="btn btn-primary btn-sm" onClick={function(){setShowForm(true);}}>{"+ Nouveau lead"}</button>
      </div>

      {/* Liste leads */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {filtered.map(function(lead) {
          var statutMeta = STATUTS.find(function(s){return s.id===lead.statut;}) || STATUTS[0];
          var prioMeta   = PRIORITES.find(function(p){return p.id===lead.priorite;}) || PRIORITES[1];
          var agent      = lead.agentId ? agents.find(function(a){return a.id===lead.agentId;}) : null;
          var nbContacts = (lead.contacts||[]).length;
          return (
            <div key={lead.id} className="m-card" style={{borderLeft:"4px solid "+statutMeta.color,display:"flex",alignItems:"flex-start",gap:12}}>
              <div style={{width:40,height:40,borderRadius:20,background:avatarColor(lead.nom),display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:14,flexShrink:0}}>{lead.nom.charAt(0)}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4}}>
                  <span style={{fontWeight:800,color:"var(--navy)",fontSize:14}}>{lead.nom}</span>
                  <span style={{background:statutMeta.bg,color:statutMeta.color,padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{statutMeta.icon+" "+statutMeta.label}</span>
                  <span style={{background:prioMeta.bg,color:prioMeta.color,padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{prioMeta.label}</span>
                  {!lead.agentId && <span style={{background:"#FEF2F2",color:"var(--red)",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{"⚠️ Non attribué"}</span>}
                </div>
                <div style={{fontSize:12,color:"var(--g500)",marginBottom:3}}>
                  {lead.telephone && "📞 "+lead.telephone+" · "}
                  {lead.source+" · "}
                  {lead.typeBien+" · "}
                  {lead.secteur}
                  {agent && " · "+agent.nom}
                </div>
                {lead.notes && <div style={{fontSize:12,color:"var(--g700)",fontStyle:"italic",marginBottom:4}}>{'"'+lead.notes+'"'}</div>}
                {nbContacts>0 && <div style={{fontSize:11,color:"var(--g400)"}}>{"💬 "+nbContacts+" contact(s)"}</div>}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                {isManager && !lead.agentId && (
                  <select className="form-select" style={{fontSize:11,padding:"4px 7px",border:"2px solid var(--red)",color:"var(--red)",fontWeight:700}} value="" onChange={function(e){
  if(e.target.value) {
    updateLead(lead.id,{agentId:e.target.value,attribueAt:new Date().toISOString().slice(0,10)});
    notifLeadAttribue({...lead, agentId:e.target.value});
  }
}}>
                    <option value="">{"Attribuer…"}</option>
                    {agents.map(function(a){ return <option key={a.id} value={a.id}>{a.nom}</option>; })}
                  </select>
                )}
                <button className="btn btn-secondary btn-sm" onClick={function(){setShowDetail(lead);}}>{"Voir →"}</button>
              </div>
            </div>
          );
        })}
        {filtered.length===0 && (
          <div style={{textAlign:"center",padding:"40px",color:"var(--g400)"}}>
            <div style={{fontSize:36,marginBottom:10}}>{"📥"}</div>
            <div style={{fontWeight:700,fontSize:14,color:"var(--navy)"}}>{"Aucun lead trouvé"}</div>
          </div>
        )}
      </div>

      {/* Modal nouveau lead */}
      {showForm && <LeadForm agents={agents} agenceId={agenceId} isManager={isManager} currentUser={ctx.currentUser} onSave={function(form){ setLeads(function(prev){ return [...prev, {...form, id:"lead-"+Date.now(), contacts:[], dateCreation:new Date().toISOString().slice(0,10)}]; }); setShowForm(false); }} onCancel={function(){setShowForm(false);}}/>}

      {/* Modal détail */}
      {showDetail && (
        <LeadDetail lead={showDetail} agents={agents} isManager={isManager} currentUser={ctx.currentUser}
          onUpdate={function(patch){updateLead(showDetail.id,patch);}}
          onAddContact={function(note){addContact(showDetail.id,note);}}
          onDelete={function(){deleteLead(showDetail.id);}}
          onClose={function(){setShowDetail(null);}}
        />
      )}
    </div>
  );
}

// ─── LEAD FORM ────────────────────────────────────────────────────────────────
function LeadForm({ agents, agenceId, isManager, currentUser, onSave, onCancel }) {
  var [f, setF] = useState({ nom:"", telephone:"", email:"", source:"Site web", typeBien:"Vente", secteur:"", budget:"", budgetMax:"", notes:"", statut:"nouveau", priorite:"normale", agentId:isManager?"":currentUser.id, agenceId:agenceId });
  function set(k,v){ setF(function(p){ return {...p,[k]:v}; }); }
  return (
    <Modal title={"📥 Nouveau lead"} onClose={onCancel}
      footer={<div style={{display:"flex",gap:8,width:"100%"}}><button className="btn btn-secondary" onClick={onCancel}>{"Annuler"}</button><button className="btn btn-primary" style={{flex:1}} onClick={function(){if(f.nom.trim()) onSave(f);}}>{"Enregistrer"}</button></div>}>
      <div className="form-grid">
        <div className="form-group form-full"><label className="form-label">{"Nom *"}</label><input className="form-input" value={f.nom} onChange={function(e){set("nom",e.target.value);}} placeholder="Prénom Nom"/></div>
        <div className="form-group"><label className="form-label">{"Téléphone"}</label><input className="form-input" value={f.telephone} onChange={function(e){set("telephone",e.target.value);}}/></div>
        <div className="form-group"><label className="form-label">{"Email"}</label><input className="form-input" type="email" value={f.email} onChange={function(e){set("email",e.target.value);}}/></div>
        <div className="form-group"><label className="form-label">{"Source"}</label><select className="form-select" value={f.source} onChange={function(e){set("source",e.target.value);}}>{SOURCES.map(function(s){return <option key={s} value={s}>{s}</option>;})}</select></div>
        <div className="form-group"><label className="form-label">{"Type"}</label><select className="form-select" value={f.typeBien} onChange={function(e){set("typeBien",e.target.value);}}>{TYPES_BIEN.map(function(s){return <option key={s} value={s}>{s}</option>;})}</select></div>
        <div className="form-group form-full"><label className="form-label">{"Secteur / Quartier"}</label><input className="form-input" value={f.secteur} onChange={function(e){set("secteur",e.target.value);}} placeholder="Ex: Amiens Centre, Henriville..."/></div>
        <div className="form-group"><label className="form-label">{"Budget min (€)"}</label><input className="form-input" type="number" value={f.budget} onChange={function(e){set("budget",Number(e.target.value));}}/></div>
        <div className="form-group"><label className="form-label">{"Budget max (€)"}</label><input className="form-input" type="number" value={f.budgetMax} onChange={function(e){set("budgetMax",Number(e.target.value));}}/></div>
        <div className="form-group"><label className="form-label">{"Priorité"}</label><select className="form-select" value={f.priorite} onChange={function(e){set("priorite",e.target.value);}}>{PRIORITES.map(function(p){return <option key={p.id} value={p.id}>{p.label}</option>;})}</select></div>
        {isManager && <div className="form-group"><label className="form-label">{"Attribuer à"}</label><select className="form-select" value={f.agentId} onChange={function(e){set("agentId",e.target.value);}}><option value="">{"— Non attribué —"}</option>{agents.map(function(a){return <option key={a.id} value={a.id}>{a.nom}</option>;})}</select></div>}
        <div className="form-group form-full"><label className="form-label">{"Notes"}</label><textarea className="form-input" rows={3} value={f.notes} onChange={function(e){set("notes",e.target.value);}} style={{resize:"vertical",fontFamily:"var(--font)"}}></textarea></div>
      </div>
    </Modal>
  );
}

// ─── LEAD DETAIL ──────────────────────────────────────────────────────────────
function LeadDetail({ lead, agents, isManager, currentUser, onUpdate, onAddContact, onDelete, onClose }) {
  var [newContact, setNewContact] = useState("");
  var statutMeta = STATUTS.find(function(s){return s.id===lead.statut;}) || STATUTS[0];
  var agent = lead.agentId ? agents.find(function(a){return a.id===lead.agentId;}) : null;

  return (
    <Modal title={"📋 "+lead.nom} onClose={onClose} wide
      footer={
        <div style={{display:"flex",gap:8,width:"100%"}}>
          <button className="btn btn-sm" style={{background:"#FEF2F2",color:"var(--red)",border:"none"}} onClick={onDelete}>{"🗑 Supprimer"}</button>
          <div style={{flex:1}}></div>
          <button className="btn btn-secondary" onClick={onClose}>{"Fermer"}</button>
        </div>
      }>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {/* Infos */}
        <div style={{background:"var(--g50)",borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontWeight:700,color:"var(--navy)",fontSize:13,marginBottom:8}}>{"📋 Informations"}</div>
          {[["📞","Téléphone",lead.telephone||"—"],["📧","Email",lead.email||"—"],["🌐","Source",lead.source],["🏠","Type",lead.typeBien],["📍","Secteur",lead.secteur||"—"],["💰","Budget",lead.budget?(lead.budget.toLocaleString("fr-FR")+"€ — "+lead.budgetMax.toLocaleString("fr-FR")+"€"):"—"],["📅","Créé le",fmtDate(lead.dateCreation)]].map(function(row) {
            return (
              <div key={row[1]} style={{display:"flex",gap:8,marginBottom:5,fontSize:12}}>
                <span style={{flexShrink:0}}>{row[0]}</span>
                <span style={{color:"var(--g500)",fontWeight:600,flexShrink:0}}>{row[1]+" :"}</span>
                <span style={{color:"var(--navy)",fontWeight:700}}>{row[2]}</span>
              </div>
            );
          })}
          {lead.notes && <div style={{marginTop:8,fontSize:12,color:"var(--g700)",fontStyle:"italic",background:"#fff",borderRadius:7,padding:"7px 10px"}}>{"\""+lead.notes+"\""}</div>}
        </div>

        {/* Statut + attribution */}
        <div>
          <div style={{fontWeight:700,color:"var(--navy)",fontSize:13,marginBottom:8}}>{"📊 Statut"}</div>
          <div style={{marginBottom:10}}>
            <label className="form-label">{"Statut pipeline"}</label>
            <select className="form-select" value={lead.statut} onChange={function(e){onUpdate({statut:e.target.value});}}>
              {STATUTS.map(function(s){ return <option key={s.id} value={s.id}>{s.icon+" "+s.label}</option>; })}
            </select>
          </div>
          <div style={{marginBottom:10}}>
            <label className="form-label">{"Priorité"}</label>
            <select className="form-select" value={lead.priorite} onChange={function(e){onUpdate({priorite:e.target.value});}}>
              {PRIORITES.map(function(p){ return <option key={p.id} value={p.id}>{p.label}</option>; })}
            </select>
          </div>
          {isManager && (
            <div>
              <label className="form-label">{"Agent attribué"}</label>
              <select className="form-select" value={lead.agentId||""} onChange={function(e){onUpdate({agentId:e.target.value||null,attribueAt:e.target.value?new Date().toISOString().slice(0,10):null});}}>
                <option value="">{"— Non attribué —"}</option>
                {agents.map(function(a){ return <option key={a.id} value={a.id}>{a.nom}</option>; })}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Historique contacts */}
      <div>
        <div style={{fontWeight:700,color:"var(--navy)",fontSize:13,marginBottom:8}}>{"💬 Historique des contacts ("+(lead.contacts||[]).length+")"}</div>
        {(lead.contacts||[]).length===0 && <div style={{fontSize:12,color:"var(--g400)",fontStyle:"italic",marginBottom:8}}>{"Aucun contact enregistré"}</div>}
        {(lead.contacts||[]).map(function(c, i) {
          return (
            <div key={i} style={{display:"flex",gap:10,marginBottom:8,padding:"8px 10px",background:"var(--g50)",borderRadius:9,fontSize:12}}>
              <div style={{fontWeight:700,color:"var(--navy)",flexShrink:0}}>{fmtDate(c.date)}</div>
              <div style={{color:"var(--g700)"}}>{c.note}</div>
            </div>
          );
        })}
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <input className="form-input" value={newContact} onChange={function(e){setNewContact(e.target.value);}} placeholder={"Note de contact…"} onKeyDown={function(e){if(e.key==="Enter"&&newContact.trim()){onAddContact(newContact.trim());setNewContact("");}}}/>
          <button className="btn btn-primary btn-sm" onClick={function(){if(newContact.trim()){onAddContact(newContact.trim());setNewContact("");}}} disabled={!newContact.trim()}>{"+ Ajouter"}</button>
        </div>
      </div>
    </Modal>
  );
}
