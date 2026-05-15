import { useState, useMemo } from "react";
import { useApp } from "../App";
import { fmt, commHT } from "./Shared";

var MOIS_NOM = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
var MOIS_COURT = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

function getMoisStr(offset) {
  var d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0");
}

function parseMois(m) {
  var [y, mo] = m.split("-");
  return { annee: Number(y), mois: Number(mo)-1, label: MOIS_NOM[Number(mo)-1] + " " + y };
}

// Données sync Supabase via ctx

var CATEGORIES_ENTREES = [
  { id:"commission_vente",    label:"🏆 Commission vente",       color:"var(--green)" },
  { id:"commission_location", label:"🏠 Commission location",    color:"#059669" },
  { id:"commission_gestion",  label:"🔑 Gestion locative",       color:"#0891B2" },
  { id:"honoraires_autres",   label:"📋 Autres honoraires",      color:"#7C3AED" },
  { id:"ca_manuel",           label:"💼 CA exceptionnel",        color:"#F59E0B" },
];

var CATEGORIES_SORTIES = [
  { id:"charges_fixes",       label:"🏢 Charges fixes (loyer, assurances…)", color:"var(--red)" },
  { id:"charges_variables",   label:"📊 Charges variables",                  color:"#DC2626" },
  { id:"salaires",            label:"👥 Salaires et charges sociales",       color:"#EF4444" },
  { id:"marketing",           label:"📣 Marketing / Publicité",              color:"#F97316" },
  { id:"logiciels",           label:"💻 Logiciels / Abonnements",            color:"#92400E" },
  { id:"divers_charges",      label:"📎 Divers charges",                     color:"#6B7280" },
];

var STATUTS = [
  { id:"prevu",      label:"📅 Prévu",           color:"#93C5FD", bg:"#EFF6FF" },
  { id:"confirme",   label:"✅ Confirmé",         color:"#6EE7B7", bg:"#F0FDF4" },
  { id:"encaisse",   label:"💰 Encaissé",         color:"#059669", bg:"#ECFDF5" },
  { id:"reporte",    label:"⏳ Reporté",          color:"#FCD34D", bg:"#FFFBEB" },
  { id:"annule",     label:"❌ Annulé",           color:"#FCA5A5", bg:"#FEF2F2" },
];

export default function Tresorerie() {
  var ctx = useApp();
  var mandats   = ctx.mandats   || [];
  var locations = ctx.locations || [];
  var gestion   = ctx.gestion   || [];
  var users     = ctx.users     || [];
  var agenceId  = ctx.currentUser.agenceId;
  var isSuper   = ctx.currentUser.role==="superadmin";
  var agents    = users.filter(function(u){ return u.agenceId===agenceId && u.actif && (u.role==="agent"||u.role==="manager"||u.role==="superadmin"); });

  // Données sync Supabase
  var data      = ctx.tresorerie || {ecritures:[]};
  var ecritures = data.ecritures || [];

  function setData(fn) {
    var next = typeof fn==="function" ? fn(data) : fn;
    ctx.setTresorerie(next);
  }

  // ─── STATE UI ────────────────────────────────────────────────────────────────
  var now = new Date();
  var moisActuel = now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0");
  var [periodeDebut,  setPeriodeDebut]  = useState(getMoisStr(-2));
  var [periodeFin,    setPeriodeFin]    = useState(getMoisStr(3));
  var [showForm,      setShowForm]      = useState(false);
  var [editId,        setEditId]        = useState(null);
  var [onglet,        setOnglet]        = useState("dashboard"); // dashboard | ecritures | previsionnel
  var [f, setF] = useState({
    type:"entree", categorie:"commission_vente", label:"", montantTTC:"", montantHT:"",
    tvaRate:20, moisEncaissement:moisActuel, statut:"prevu", mandatRef:"", notes:"",
    partAgence:100, agentCoId:"", partAgentCo:0
  });
  function setFField(k,v) { setF(function(p){return {...p,[k]:v};}); }

  // ─── GÉNÉRATION AUTO depuis les mandats ──────────────────────────────────────
  var ecrituresAuto = useMemo(function() {
    var list = [];

    // ─── SOUS OFFRE (probable) ─────────────────────────────────────────────
    mandats.filter(function(m){ return m.statut==="sous_offre"&&m.commission>0; }).forEach(function(m) {
      var ag = users.find(function(u){return u.id===m.agentId;})||{};
      var moisEst = getMoisStr(2);
      var ht = commHT(m.commission||0, m.typeBien);
      list.push({
        id:"auto-offre-"+m.id, type:"entree", categorie:"commission_vente",
        label:"📝 Sous offre — "+m.ref+" ("+ag.nom+")",
        montant:ht, montantHT:ht, montantTTC:Math.round(ht*1.2*100)/100, tvaRate:20,
        moisEncaissement:moisEst, statut:"prevu", auto:true, mandatRef:m.ref,
        agentId:m.agentId, partAgence:100, partAgentCo:0,
      });
    });

    // ─── COMPROMIS (confirmé) ──────────────────────────────────────────────
    mandats.filter(function(m){ return m.statut==="compromis"&&m.commission>0; }).forEach(function(m) {
      var ag = users.find(function(u){return u.id===m.agentId;})||{};
      var moisPrev = m.dateSignature ? m.dateSignature.slice(0,7) : getMoisStr(2);
      var ht = commHT(m.commission||0, m.typeBien);
      list.push({
        id:"auto-compr-"+m.id, type:"entree", categorie:"commission_vente",
        label:"🤝 Compromis — "+m.ref+" ("+ag.nom+")",
        montant:ht, montantHT:ht, montantTTC:Math.round(ht*1.2*100)/100, tvaRate:20,
        moisEncaissement:moisPrev, statut:"confirme", auto:true, mandatRef:m.ref,
        agentId:m.agentId, partAgence:100, partAgentCo:0,
      });
    });

    // ─── CS LEVÉES (quasi-certain) ─────────────────────────────────────────
    mandats.filter(function(m){ return m.statut==="compromis"&&m.clausesSuspensivesLevees&&m.commission>0; }).forEach(function(m) {
      var ag = users.find(function(u){return u.id===m.agentId;})||{};
      var moisPrev = m.dateSignature ? m.dateSignature.slice(0,7) : getMoisStr(1);
      var ht = commHT(m.commission||0, m.typeBien);
      // Remplacer l'écriture compromis par CS levées (plus fiable)
      var idx = list.findIndex(function(x){return x.id==="auto-compr-"+m.id;});
      if(idx>=0) {
        list[idx] = {...list[idx], id:"auto-cs-"+m.id, label:"✅ CS levées — "+m.ref+" ("+ag.nom+")", statut:"confirme", moisEncaissement:moisPrev};
      }
    });

    // ─── VENDUS (encaissé ou à encaisser) ─────────────────────────────────
    mandats.filter(function(m){ return m.statut==="vendu"&&m.commission>0; }).forEach(function(m) {
      var ag = users.find(function(u){return u.id===m.agentId;})||{};
      var moisVente = m.dateSignature ? m.dateSignature.slice(0,7) : moisActuel;
      var ht = commHT(m.commission||0, m.typeBien);
      list.push({
        id:"auto-vendu-"+m.id, type:"entree", categorie:"commission_vente",
        label:"🏆 Acte signé — "+m.ref+" ("+ag.nom+")",
        montant:ht, montantHT:ht, montantTTC:Math.round(ht*1.2*100)/100, tvaRate:20,
        moisEncaissement:moisVente, statut:"encaisse", auto:true, mandatRef:m.ref,
        agentId:m.agentId, partAgence:100, partAgentCo:0,
      });
    });

    // ─── LOCATIONS SIGNÉES ─────────────────────────────────────────────────
    var locations = ctx.locations||[];
    locations.filter(function(l){ return l.locataireTrouve&&l.commission>0; }).forEach(function(l) {
      var ag = users.find(function(u){return u.id===l.agentId;})||{};
      var moisLoc = l.dateTrouve ? l.dateTrouve.slice(0,7) : moisActuel;
      var ht = commHT(l.commission||0, "appartement");
      list.push({
        id:"auto-loc-"+l.id, type:"entree", categorie:"commission_location",
        label:"🏠 Location — "+(l.adresse||"").split(",")[0]+" ("+ag.nom+")",
        montant:ht, montantHT:ht, montantTTC:Math.round(ht*1.2*100)/100, tvaRate:20,
        moisEncaissement:moisLoc, statut:"encaisse", auto:true,
        agentId:l.agentId, partAgence:100, partAgentCo:0,
      });
    });

    // ─── GESTION LOCATIVE (mensuel récurrent) ─────────────────────────────
    gestion.filter(function(g){return g.actif&&g.commissionMensuelle>0;}).forEach(function(g){
      for(var i=-1;i<6;i++) {
        var mois = getMoisStr(i);
        list.push({
          id:"auto-gest-"+g.id+"-"+mois, type:"entree", categorie:"commission_gestion",
          label:"🔑 Gestion — "+(g.adresse||"").split(",")[0],
          montant:g.commissionMensuelle||0, montantHT:g.commissionMensuelle||0,
          montantTTC:Math.round((g.commissionMensuelle||0)*1.2*100)/100, tvaRate:20,
          moisEncaissement:mois, statut:mois<=moisActuel?"encaisse":"prevu", auto:true,
          agentId:g.agentId, partAgence:100, partAgentCo:0,
        });
      }
    });

    return list;
  }, [mandats, gestion, users, ctx.locations]);

  var toutesEcritures = [...ecritures, ...ecrituresAuto];

  // ─── CALCULS PAR MOIS ─────────────────────────────────────────────────────────
  var moisList = useMemo(function() {
    var list = []; var m = periodeDebut;
    while (m <= periodeFin) {
      list.push(m);
      var [y,mo] = m.split("-").map(Number);
      mo++; if(mo>12){mo=1;y++;}
      m = y+"-"+String(mo).padStart(2,"0");
    }
    return list;
  }, [periodeDebut, periodeFin]);

  function calcMois(mois) {
    var ecs = toutesEcritures.filter(function(e){return e.moisEncaissement===mois&&e.statut!=="annule";});
    var entrees = ecs.filter(function(e){return e.type==="entree";}).reduce(function(s,e){return s+Number(e.montant||0);},0);
    var sorties = ecs.filter(function(e){return e.type==="sortie";}).reduce(function(s,e){return s+Number(e.montant||0);},0);
    var solde = entrees - sorties;
    var encaisse = ecs.filter(function(e){return e.statut==="encaisse"&&e.type==="entree";}).reduce(function(s,e){return s+Number(e.montant||0);},0);
    return { entrees, sorties, solde, encaisse };
  }

  // ─── STATS PAR STATUT MANDAT ─────────────────────────────────────────
  var caStock     = 0; // Mandats actifs exclus — taux de transformation trop faible
  var caSousOffre = ecrituresAuto.filter(function(e){return e.id.startsWith("auto-offre-");}).reduce(function(s,e){return s+e.montant;},0);
  var caCompromis = ecrituresAuto.filter(function(e){return e.id.startsWith("auto-compr-")||e.id.startsWith("auto-cs-");}).reduce(function(s,e){return s+e.montant;},0);
  var caVendus    = ecrituresAuto.filter(function(e){return e.id.startsWith("auto-vendu-");}).reduce(function(s,e){return s+e.montant;},0);
  var caGestion   = 0; // Gestion désactivée — aucun bien en gestion
  var caManuel    = ecritures.filter(function(e){return e.type==="entree"&&e.statut!=="annule";}).reduce(function(s,e){return s+Number(e.montantHT||e.montant||0);},0);

  var statsTotal = moisList.reduce(function(acc, m) {
    var s = calcMois(m);
    return { entrees:acc.entrees+s.entrees, sorties:acc.sorties+s.sorties, solde:acc.solde+s.solde, encaisse:acc.encaisse+s.encaisse };
  }, {entrees:0, sorties:0, solde:0, encaisse:0});

  // ─── ACTIONS ──────────────────────────────────────────────────────────────────
  function openNew(type) {
    setEditId(null);
    setF({type:type||"entree", categorie:type==="sortie"?"charges_fixes":"commission_vente", label:"", montant:"", moisEncaissement:moisActuel, statut:"prevu", mandatRef:"", notes:""});
    setShowForm(true);
  }
  function openEdit(e) {
    setEditId(e.id);
    setF({type:e.type, categorie:e.categorie, label:e.label, montantTTC:String(e.montantTTC||e.montant||""), montantHT:String(e.montantHT||""), tvaRate:e.tvaRate||20, moisEncaissement:e.moisEncaissement, statut:e.statut, mandatRef:e.mandatRef||"", notes:e.notes||"", partAgence:e.partAgence||100, agentCoId:e.agentCoId||"", partAgentCo:e.partAgentCo||0});
    setShowForm(true);
  }
  function sauvegarder() {
    if (!f.label.trim()||(!f.montantTTC&&!f.montantHT)||Number(f.montantTTC||f.montantHT||0)<=0) return;
    var ttc = Number(f.montantTTC)||0;
    var ht  = Number(f.montantHT)||Math.round(ttc/((f.tvaRate||20)/100+1)*100)/100;
    var partAg  = Number(f.partAgence||100);
    var partCo  = Number(f.partAgentCo||0);
    var montantAgence   = Math.round(ht * partAg / 100 * 100) / 100;
    var montantAgentCo  = Math.round(ht * partCo / 100 * 100) / 100;
    var entry = {...f,
      montant: ht,        // on stocke HT comme montant principal
      montantTTC: ttc,
      montantHT:  ht,
      tvaRate:    Number(f.tvaRate||20),
      partAgence: partAg,
      partAgentCo:partCo,
      montantAgence,
      montantAgentCo,
      id: editId||(Date.now()+"-"+Math.random().toString(36).slice(2))
    };
    setData(function(prev) {
      var ecs = prev.ecritures||[];
      return {...prev, ecritures: editId ? ecs.map(function(e){return e.id===editId?entry:e;}) : [...ecs,entry]};
    });
    setShowForm(false); setEditId(null);
  }
  function supprimer(id) {
    if(!window.confirm("Supprimer cette écriture ?")) return;
    setData(function(prev){ return {...prev, ecritures:(prev.ecritures||[]).filter(function(e){return e.id!==id;})}; });
  }
  function changerStatut(id, statut) {
    setData(function(prev){ return {...prev, ecritures:(prev.ecritures||[]).map(function(e){return e.id===id?{...e,statut}:e;})}; });
  }

  var cats = f.type==="entree" ? CATEGORIES_ENTREES : CATEGORIES_SORTIES;
  var moisLabel = function(m){ var p=parseMois(m); return MOIS_COURT[p.mois]+" "+p.annee; };

  return (
    <div>
      {/* ─── HEADER ─── */}
      <div style={{background:"linear-gradient(135deg,#1D3557,#059669)",borderRadius:14,padding:"16px 18px",marginBottom:14,color:"#fff"}}>
        <div style={{fontWeight:900,fontSize:15,marginBottom:2}}>{"💰 Suivi de trésorerie"}</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.65)"}}>{"CA prévisionnels + encaissements réels"+(isSuper?"":" — Lecture seule")}</div>
      </div>

      {/* ─── KPIs RÉSUMÉ ─── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {/* Ligne 1 : Pipeline par statut */}
      <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:"12px 14px",marginBottom:10}}>
        <div style={{fontWeight:800,color:"var(--navy)",fontSize:12,marginBottom:10}}>{"📊 Pipeline CA (commissions HT)"}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:8}}>
          {[
            {label:"📝 Sous offre",       val:fmt(caSousOffre), color:"var(--amber)",  sub:"Probable — inclus dans tréso"},
            {label:"🤝 Compromis",        val:fmt(caCompromis), color:"var(--green)",  sub:"Confirmé"},
            {label:"🏆 Actes signés",     val:fmt(caVendus),    color:"var(--red)",    sub:"Encaissable"},
          ].map(function(k){
            return(
              <div key={k.label} style={{background:"var(--g50)",borderRadius:8,padding:"8px 10px",borderLeft:"3px solid "+k.color}}>
                <div style={{fontSize:9,color:"var(--g400)",fontWeight:700}}>{k.label}</div>
                <div style={{fontWeight:900,fontSize:15,color:k.color}}>{k.val}</div>
                <div style={{fontSize:9,color:"var(--g400)"}}>{k.sub}</div>
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",gap:8}}>
          <div style={{flex:1,background:"#EFF6FF",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
            <div style={{fontSize:9,color:"var(--g400)",fontWeight:700}}>{"🔑 Gestion /mois"}</div>
            <div style={{fontWeight:800,fontSize:14,color:"var(--blue)"}}>{fmt(caGestion)}</div>
          </div>
          <div style={{flex:1,background:"#F5F3FF",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
            <div style={{fontSize:9,color:"var(--g400)",fontWeight:700}}>{"💼 CA manuel saisi"}</div>
            <div style={{fontWeight:800,fontSize:14,color:"var(--purple)"}}>{fmt(caManuel)}</div>
          </div>
        </div>
      </div>

      {/* Ligne 2 : Tréso période */}
      {[
          {label:"Entrées prévues", val:fmt(statsTotal.entrees), color:"var(--green)", icon:"📈"},
          {label:"Sorties prévues", val:fmt(statsTotal.sorties), color:"var(--red)",   icon:"📉"},
          {label:"Solde net",       val:fmt(statsTotal.solde),   color:statsTotal.solde>=0?"var(--green)":"var(--red)", icon:"💰"},
          {label:"Encaissé réel",   val:fmt(statsTotal.encaisse),color:"var(--blue)",  icon:"✅"},
        ].map(function(k){
          return (
            <div key={k.label} style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",borderLeft:"4px solid "+k.color,padding:"12px 14px"}}>
              <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{k.icon+" "+k.label}</div>
              <div style={{fontWeight:900,fontSize:18,color:k.color}}>{k.val}</div>
            </div>
          );
        })}
      </div>

      {/* ─── ONGLETS ─── */}
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        {[["dashboard","📊 Vue mensuelle"],["ecritures","📋 Écritures"],["previsionnel","📅 Prévisionnel"]].map(function(o){
          var actif=onglet===o[0];
          return <button key={o[0]} onClick={function(){setOnglet(o[0]);}} style={{flex:1,padding:"8px",borderRadius:10,border:"2px solid "+(actif?"var(--navy)":"var(--g200)"),background:actif?"var(--navy)":"#fff",color:actif?"#fff":"var(--g500)",fontWeight:700,fontSize:12,cursor:"pointer"}}>{o[1]}</button>;
        })}
      </div>

      {/* ─── PÉRIODE ─── */}
      <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:"10px 14px",marginBottom:12,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:11,color:"var(--g400)",fontWeight:700}}>{"Période :"}</span>
        <div style={{display:"flex",alignItems:"center",gap:6,flex:1}}>
          <input type="month" value={periodeDebut} onChange={function(e){setPeriodeDebut(e.target.value);}} style={{flex:1,padding:"5px 8px",borderRadius:8,border:"1px solid var(--g200)",fontSize:12}}/>
          <span style={{color:"var(--g400)"}}>{"→"}</span>
          <input type="month" value={periodeFin} onChange={function(e){setPeriodeFin(e.target.value);}} style={{flex:1,padding:"5px 8px",borderRadius:8,border:"1px solid var(--g200)",fontSize:12}}/>
        </div>
        {isSuper && (
          <div style={{display:"flex",gap:6}}>
            <button className="btn btn-primary btn-sm" onClick={function(){openNew("entree");}}>{"+ Entrée"}</button>
            <button className="btn btn-sm" style={{background:"#FEF2F2",color:"var(--red)",border:"none"}} onClick={function(){openNew("sortie");}}>{"+ Charge"}</button>
          </div>
        )}
      </div>

      {/* ─── FORMULAIRE ─── */}
      {showForm && isSuper && (
        <div style={{background:"#fff",borderRadius:14,border:"2px solid var(--navy)",padding:16,marginBottom:14}}>
          <div style={{fontWeight:800,color:"var(--navy)",fontSize:13,marginBottom:12}}>{editId?"✏️ Modifier":"➕ Nouvelle "+(f.type==="entree"?"entrée":"charge")}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"TYPE"}</label>
              <div style={{display:"flex",gap:8}}>
                {[["entree","💰 Entrée CA"],["sortie","📉 Charge / Sortie"]].map(function(t){
                  return <button key={t[0]} onClick={function(){setFField("type",t[0]);setFField("categorie",t[0]==="entree"?"commission_vente":"charges_fixes");}} style={{flex:1,padding:"7px",borderRadius:8,border:"2px solid "+(f.type===t[0]?(t[0]==="entree"?"var(--green)":"var(--red)"):"var(--g200)"),background:f.type===t[0]?(t[0]==="entree"?"#F0FDF4":"#FEF2F2"):"#fff",color:f.type===t[0]?(t[0]==="entree"?"var(--green)":"var(--red)"):"var(--g500)",fontWeight:700,fontSize:12,cursor:"pointer"}}>{t[1]}</button>;
                })}
              </div>
            </div>
            <div>
              <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"CATÉGORIE"}</label>
              <select className="form-select" style={{fontSize:12}} value={f.categorie} onChange={function(e){setFField("categorie",e.target.value);}}>
                {cats.map(function(cat){ return <option key={cat.id} value={cat.id}>{cat.label}</option>; })}
              </select>
            </div>
            <div>
              <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"STATUT"}</label>
              <select className="form-select" style={{fontSize:12}} value={f.statut} onChange={function(e){setFField("statut",e.target.value);}}>
                {STATUTS.map(function(s){ return <option key={s.id} value={s.id}>{s.label}</option>; })}
              </select>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"LIBELLÉ *"}</label>
              <input className="form-input" value={f.label} onChange={function(e){setFField("label",e.target.value);}} placeholder="Ex : Vente Dupont — 40 Rue Hugo"/>
            </div>
            {/* TTC → HT auto */}
            <div>
              <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"MONTANT TTC (€) *"}</label>
              <input type="number" className="form-input" value={f.montantTTC} onChange={function(e){
                var ttc=Number(e.target.value)||0;
                var ht=Math.round(ttc/((Number(f.tvaRate)||20)/100+1)*100)/100;
                setF(function(p){return{...p,montantTTC:e.target.value,montantHT:String(ht)};});
              }} placeholder="Ex : 12000"/>
            </div>
            <div>
              <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"TVA (%)"}</label>
              <select className="form-select" style={{fontSize:12}} value={f.tvaRate} onChange={function(e){
                var rate=Number(e.target.value);
                var ht=Math.round((Number(f.montantTTC)||0)/(rate/100+1)*100)/100;
                setF(function(p){return{...p,tvaRate:rate,montantHT:String(ht)};});
              }}>
                {[20,10,5.5,0].map(function(r){return <option key={r} value={r}>{r+"% TVA"}</option>;})}
              </select>
            </div>
            <div style={{gridColumn:"1/-1",background:"#EFF6FF",borderRadius:10,padding:"10px 12px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,color:"var(--g500)"}}>{"Montant HT calculé :"}</span>
                <span style={{fontWeight:900,fontSize:18,color:"var(--blue)"}}>{f.montantHT?Number(f.montantHT).toLocaleString("fr-FR")+"€ HT":"—"}</span>
              </div>
              {f.montantTTC>0&&<div style={{fontSize:10,color:"var(--g400)",marginTop:2}}>{"TVA : "+Math.round((Number(f.montantTTC||0)-Number(f.montantHT||0))*100)/100+"€"}</div>}
            </div>
            {/* Répartition */}
            {f.type==="entree" && (
              <div style={{gridColumn:"1/-1",background:"#F0FDF4",borderRadius:10,padding:"12px"}}>
                <div style={{fontWeight:800,color:"var(--green)",fontSize:12,marginBottom:10}}>{"📊 Répartition des honoraires"}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <div>
                    <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"PART AGENCE (%)"}</label>
                    <input type="number" min="0" max="100" className="form-input" value={f.partAgence} onChange={function(e){
                      var pa=Math.min(100,Math.max(0,Number(e.target.value)||0));
                      setF(function(p){return{...p,partAgence:pa,partAgentCo:Math.round((100-pa)*100)/100};});
                    }}/>
                    <div style={{fontSize:10,color:"var(--green)",marginTop:2,fontWeight:700}}>{"= "+Math.round((Number(f.montantHT||0)*f.partAgence/100)*100)/100+"€ HT"}</div>
                  </div>
                  <div>
                    <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"PART AGENT CO (%)"}</label>
                    <input type="number" min="0" max="100" className="form-input" value={f.partAgentCo} onChange={function(e){
                      var pc=Math.min(100,Math.max(0,Number(e.target.value)||0));
                      setF(function(p){return{...p,partAgentCo:pc,partAgence:Math.round((100-pc)*100)/100};});
                    }}/>
                    <div style={{fontSize:10,color:"var(--blue)",marginTop:2,fontWeight:700}}>{"= "+Math.round((Number(f.montantHT||0)*f.partAgentCo/100)*100)/100+"€ HT"}</div>
                  </div>
                </div>
                {/* Raccourcis répartition */}
                <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                  {[[100,0,"100% Agence"],[70,30,"70/30"],[60,40,"60/40"],[50,50,"50/50"]].map(function(r){
                    var actif = f.partAgence===r[0]&&f.partAgentCo===r[1];
                    return <button key={r[2]} onClick={function(){setF(function(p){return{...p,partAgence:r[0],partAgentCo:r[1]};});}} style={{padding:"4px 10px",borderRadius:20,border:"2px solid "+(actif?"var(--green)":"var(--g200)"),background:actif?"var(--green)":"#fff",color:actif?"#fff":"var(--g500)",fontWeight:700,fontSize:10,cursor:"pointer"}}>{r[2]}</button>;
                  })}
                </div>
                {/* Sélection agent co */}
                {f.partAgentCo>0 && (
                  <div>
                    <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"AGENT CO (bénéficiaire de la part)"}</label>
                    <select className="form-select" style={{fontSize:12}} value={f.agentCoId} onChange={function(e){setFField("agentCoId",e.target.value);}}>
                      <option value="">{"— Choisir un agent —"}</option>
                      {agents.filter(function(a){return a.actif;}).map(function(a){return <option key={a.id} value={a.id}>{a.nom}</option>;})}
                    </select>
                  </div>
                )}
              </div>
            )}
            <div>
              <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"MOIS D'ENCAISSEMENT"}</label>
              <input type="month" className="form-input" value={f.moisEncaissement} onChange={function(e){setFField("moisEncaissement",e.target.value);}}/>
            </div>
            <div>
              <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"RÉF. MANDAT (optionnel)"}</label>
              <input className="form-input" value={f.mandatRef} onChange={function(e){setFField("mandatRef",e.target.value);}} placeholder="Ex: SB-116"/>
            </div>
            <div>
              <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"NOTES"}</label>
              <input className="form-input" value={f.notes} onChange={function(e){setFField("notes",e.target.value);}} placeholder="Notes..."/>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-secondary" style={{flex:1}} onClick={function(){setShowForm(false);setEditId(null);}}>{"Annuler"}</button>
            <button className="btn btn-primary" style={{flex:2}} onClick={sauvegarder} disabled={!f.label.trim()||Number(f.montantTTC||f.montantHT||0)<=0}>{"💾 Enregistrer"}</button>
          </div>
        </div>
      )}

      {/* ─── VUE MENSUELLE ─── */}
      {onglet==="dashboard" && (
        <div>
          {moisList.map(function(mois) {
            var s = calcMois(mois);
            var mEcs = toutesEcritures.filter(function(e){return e.moisEncaissement===mois&&e.statut!=="annule";});
            var isCurrent = mois===moisActuel;
            var isFuture  = mois>moisActuel;
            return (
              <div key={mois} style={{background:"#fff",borderRadius:12,border:"2px solid "+(isCurrent?"var(--navy)":"var(--g200)"),overflow:"hidden",marginBottom:10}}>
                <div style={{background:isCurrent?"var(--navy)":isFuture?"#F8FAFC":"var(--g50)",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <span style={{fontWeight:800,color:isCurrent?"#fff":"var(--navy)",fontSize:13}}>{moisLabel(mois)}</span>
                    {isCurrent && <span style={{fontSize:10,color:"rgba(255,255,255,0.7)",marginLeft:8}}>{"← Mois en cours"}</span>}
                  </div>
                  <div style={{display:"flex",gap:12,alignItems:"center"}}>
                    <span style={{fontSize:12,fontWeight:700,color:isCurrent?"#6EE7B7":"var(--green)"}}>{"+"+fmt(s.entrees)}</span>
                    {s.sorties>0&&<span style={{fontSize:12,fontWeight:700,color:isCurrent?"#FCA5A5":"var(--red)"}}>{"-"+fmt(s.sorties)}</span>}
                    <span style={{fontWeight:900,fontSize:14,color:s.solde>=0?(isCurrent?"#fff":"var(--green)"):"var(--red)"}}>{"= "+fmt(s.solde)}</span>
                  </div>
                </div>
                {mEcs.length===0 && <div style={{padding:"8px 14px",fontSize:11,color:"var(--g400)",fontStyle:"italic"}}>{"Aucune écriture ce mois"}</div>}
                {mEcs.map(function(e){
                  var catList = e.type==="entree"?CATEGORIES_ENTREES:CATEGORIES_SORTIES;
                  var cat = catList.find(function(c){return c.id===e.categorie;})||{color:"var(--navy)",label:e.categorie};
                  var st  = STATUTS.find(function(s){return s.id===e.statut;})||STATUTS[0];
                  return (
                    <div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",borderTop:"1px solid var(--g50)"}}>
                      <div style={{width:3,height:32,borderRadius:2,background:e.type==="entree"?"var(--green)":"var(--red)",flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700,color:"var(--navy)",fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.label}</div>
                        <div style={{display:"flex",gap:6,marginTop:2,flexWrap:"wrap"}}>
                          <span style={{fontSize:9,background:cat.color+"22",color:cat.color,borderRadius:6,padding:"1px 6px",fontWeight:700}}>{cat.label}</span>
                          <span style={{fontSize:9,background:st.bg,color:st.color,borderRadius:6,padding:"1px 6px",fontWeight:700}}>{st.label}</span>
                          {e.auto&&<span style={{fontSize:9,background:"var(--g100)",color:"var(--g400)",borderRadius:6,padding:"1px 6px"}}>{"Auto"}</span>}
                        </div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontWeight:900,fontSize:14,color:e.type==="entree"?"var(--green)":"var(--red)"}}>{(e.type==="entree"?"+":"-")+fmt(Number(e.montantHT||e.montant||0))+" HT"}</div>
                      {e.montantTTC&&e.montantTTC!==e.montantHT&&<div style={{fontSize:10,color:"var(--g400)"}}>{"TTC : "+fmt(Number(e.montantTTC))}</div>}
                      {e.type==="entree"&&e.partAgentCo>0&&(function(){
                        var agCo = users.find(function(u){return u.id===e.agentCoId;});
                        return (
                          <div style={{marginTop:4}}>
                            <div style={{fontSize:9,color:"var(--green)",fontWeight:700}}>{"Agence : "+fmt(e.montantAgence||0)+" ("+e.partAgence+"%)"}</div>
                            {agCo&&<div style={{fontSize:9,color:"var(--blue)",fontWeight:700}}>{agCo.nom+" : "+fmt(e.montantAgentCo||0)+" ("+e.partAgentCo+"%)"}</div>}
                          </div>
                        );
                      })()}
                        {!e.auto && isSuper && (
                          <div style={{display:"flex",gap:4,marginTop:4,justifyContent:"flex-end"}}>
                            <button onClick={function(){openEdit(e);}} style={{background:"var(--g50)",border:"none",borderRadius:6,width:24,height:24,cursor:"pointer",fontSize:11}}>{"✏️"}</button>
                            <button onClick={function(){supprimer(e.id);}} style={{background:"#FEF2F2",border:"none",borderRadius:6,width:24,height:24,cursor:"pointer",fontSize:11}}>{"🗑"}</button>
                          </div>
                        )}
                        {!e.auto && isSuper && e.statut!=="encaisse" && e.type==="entree" && (
                          <button onClick={function(){changerStatut(e.id,"encaisse");}} style={{marginTop:4,background:"#F0FDF4",border:"1px solid #A7F3D0",borderRadius:6,padding:"2px 6px",fontSize:9,fontWeight:700,color:"var(--green)",cursor:"pointer"}}>{"✓ Encaisser"}</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── LISTE ÉCRITURES ─── */}
      {onglet==="ecritures" && (
        <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden"}}>
          <div style={{background:"var(--g50)",padding:"10px 14px",borderBottom:"1px solid var(--g100)",fontWeight:800,color:"var(--navy)",fontSize:13}}>
            {"Toutes les écritures — "+toutesEcritures.filter(function(e){return e.moisEncaissement>=periodeDebut&&e.moisEncaissement<=periodeFin;}).length+" entrées"}
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead>
                <tr style={{background:"var(--g50)"}}>
                  {["Mois","Libellé","Catégorie","Statut","Montant",""].map(function(h){
                    return <th key={h} style={{padding:"7px 10px",fontWeight:700,color:"var(--g500)",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {toutesEcritures
                  .filter(function(e){return e.moisEncaissement>=periodeDebut&&e.moisEncaissement<=periodeFin;})
                  .sort(function(a,b){return a.moisEncaissement.localeCompare(b.moisEncaissement);})
                  .map(function(e){
                    var catList = e.type==="entree"?CATEGORIES_ENTREES:CATEGORIES_SORTIES;
                    var cat = catList.find(function(c){return c.id===e.categorie;})||{label:e.categorie,color:"var(--navy)"};
                    var st  = STATUTS.find(function(s){return s.id===e.statut;})||STATUTS[0];
                    return (
                      <tr key={e.id} style={{borderBottom:"1px solid var(--g50)"}}>
                        <td style={{padding:"7px 10px",fontWeight:600,color:"var(--navy)",whiteSpace:"nowrap"}}>{moisLabel(e.moisEncaissement)}</td>
                        <td style={{padding:"7px 10px",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.label}{e.notes&&<span style={{color:"var(--g400)",fontSize:10}}>{" — "+e.notes}</span>}</td>
                        <td style={{padding:"7px 10px",whiteSpace:"nowrap"}}><span style={{fontSize:9,background:cat.color+"22",color:cat.color,borderRadius:6,padding:"1px 6px",fontWeight:700}}>{cat.label}</span></td>
                        <td style={{padding:"7px 10px"}}><span style={{fontSize:9,background:st.bg,color:st.color,borderRadius:6,padding:"1px 6px",fontWeight:700}}>{st.label}</span></td>
                        <td style={{padding:"7px 10px",fontWeight:800,color:e.type==="entree"?"var(--green)":"var(--red)",textAlign:"right",whiteSpace:"nowrap"}}>{(e.type==="entree"?"+":"-")+fmt(Number(e.montant||0))}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",whiteSpace:"nowrap"}}>
                          {!e.auto&&isSuper&&<button onClick={function(){openEdit(e);}} style={{background:"var(--g50)",border:"none",borderRadius:6,width:22,height:22,cursor:"pointer",fontSize:10,marginRight:4}}>{"✏️"}</button>}
                          {!e.auto&&isSuper&&<button onClick={function(){supprimer(e.id);}} style={{background:"#FEF2F2",border:"none",borderRadius:6,width:22,height:22,cursor:"pointer",fontSize:10}}>{"🗑"}</button>}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── PRÉVISIONNEL ─── */}
      {onglet==="previsionnel" && (
        <div>
          {/* Graphique barres */}
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:"14px",marginBottom:14}}>
            <div style={{fontWeight:800,color:"var(--navy)",fontSize:13,marginBottom:12}}>{"Prévision entrées / sorties par mois"}</div>
            <div style={{display:"flex",gap:4,alignItems:"flex-end",height:120,overflowX:"auto"}}>
              {moisList.map(function(mois){
                var s = calcMois(mois);
                var max = Math.max(...moisList.map(function(m2){var s2=calcMois(m2);return Math.max(s2.entrees,s2.sorties);}),1);
                var hE = Math.max(4,Math.round(s.entrees/max*100));
                var hS = Math.max(0,Math.round(s.sorties/max*100));
                var isCurrent = mois===moisActuel;
                return (
                  <div key={mois} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,minWidth:40}}>
                    <div style={{display:"flex",gap:2,alignItems:"flex-end",height:100,width:"100%",justifyContent:"center"}}>
                      <div style={{width:"45%",height:hE+"%",background:isCurrent?"var(--green)":"#A7F3D0",borderRadius:"3px 3px 0 0",minHeight:2}}/>
                      {hS>0&&<div style={{width:"45%",height:hS+"%",background:isCurrent?"var(--red)":"#FCA5A5",borderRadius:"3px 3px 0 0",minHeight:2}}/>}
                    </div>
                    <div style={{fontSize:8,color:isCurrent?"var(--navy)":"var(--g400)",fontWeight:isCurrent?800:400,textAlign:"center"}}>{MOIS_COURT[parseMois(mois).mois]}</div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:14,marginTop:8,fontSize:10}}>
              <span style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:12,height:12,borderRadius:2,background:"var(--green)"}}/>{"Entrées"}</span>
              <span style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:12,height:12,borderRadius:2,background:"var(--red)"}}/>{"Charges"}</span>
            </div>
          </div>

          {/* Tableau synthèse */}
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden"}}>
            <div style={{background:"var(--g50)",padding:"10px 14px",borderBottom:"1px solid var(--g100)",fontWeight:800,color:"var(--navy)",fontSize:13}}>{"Synthèse mensuelle"}</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:380}}>
                <thead>
                  <tr style={{background:"var(--g50)"}}>
                    {["Mois","Entrées","Charges","Solde net","Encaissé"].map(function(h){
                      return <th key={h} style={{padding:"8px 12px",fontWeight:700,color:"var(--g500)",textAlign:h==="Mois"?"left":"right"}}>{h}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {moisList.map(function(mois){
                    var s = calcMois(mois);
                    var isCurrent = mois===moisActuel;
                    return (
                      <tr key={mois} style={{borderBottom:"1px solid var(--g50)",background:isCurrent?"#F0F9FF":"#fff"}}>
                        <td style={{padding:"9px 12px",fontWeight:isCurrent?800:600,color:isCurrent?"var(--blue)":"var(--navy)"}}>{moisLabel(mois)}{isCurrent&&<span style={{fontSize:9,color:"var(--blue)",marginLeft:6}}>{"← actuel"}</span>}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",fontWeight:700,color:"var(--green)"}}>{s.entrees>0?fmt(s.entrees):"—"}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",fontWeight:700,color:"var(--red)"}}>{s.sorties>0?fmt(s.sorties):"—"}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",fontWeight:900,color:s.solde>=0?"var(--green)":"var(--red)"}}>{fmt(s.solde)}</td>
                        <td style={{padding:"9px 12px",textAlign:"right",fontWeight:700,color:"var(--blue)"}}>{s.encaisse>0?fmt(s.encaisse):"—"}</td>
                      </tr>
                    );
                  })}
                  <tr style={{background:"var(--g50)",borderTop:"2px solid var(--g200)"}}>
                    <td style={{padding:"9px 12px",fontWeight:800,color:"var(--navy)"}}>{"TOTAL"}</td>
                    <td style={{padding:"9px 12px",textAlign:"right",fontWeight:900,color:"var(--green)"}}>{fmt(statsTotal.entrees)}</td>
                    <td style={{padding:"9px 12px",textAlign:"right",fontWeight:900,color:"var(--red)"}}>{fmt(statsTotal.sorties)}</td>
                    <td style={{padding:"9px 12px",textAlign:"right",fontWeight:900,color:statsTotal.solde>=0?"var(--green)":"var(--red)"}}>{fmt(statsTotal.solde)}</td>
                    <td style={{padding:"9px 12px",textAlign:"right",fontWeight:900,color:"var(--blue)"}}>{fmt(statsTotal.encaisse)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
