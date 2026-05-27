import { useState } from "react";
import { useApp } from "../App";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
export var todayStr = new Date().toISOString().slice(0,10);
export function fmt(n) { return n != null ? n.toLocaleString("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0})+" HT" : "—"; }
export function fmtDate(d) { return d ? new Date(d).toLocaleDateString("fr-FR") : "—"; }
export function diffDays(a, b) { return Math.round((new Date(b)-new Date(a))/86400000); }
export function inPeriod(dateStr, period, from, to) {
  if (!dateStr || period==="all") return true;
  var d = new Date(dateStr), t = new Date();
  if (period==="custom") return (!from||dateStr>=from)&&(!to||dateStr<=to);
  if (period==="month")   return d.getMonth()===t.getMonth()&&d.getFullYear()===t.getFullYear();
  if (period==="quarter") return d.getFullYear()===t.getFullYear()&&Math.floor(d.getMonth()/3)===Math.floor(t.getMonth()/3);
  if (period==="year")    return d.getFullYear()===t.getFullYear();
  return true;
}

var AC = ["#E63946","#F59E0B","#3B82F6","#10B981","#8B5CF6","#EC4899","#06B6D4","#84CC16"];
export function avatarColor(str) {
  var h = 0;
  for (var i = 0; i < (str||"").length; i++) h = (h*31+str.charCodeAt(i))&0xffff;
  return AC[h%AC.length];
}

// ─── LOGO ─────────────────────────────────────────────────────────────────────
export function OrpiLogo() {
  return (
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{background:"#E63946",borderRadius:8,padding:"5px 10px",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{color:"#fff",fontWeight:900,fontSize:15,letterSpacing:0.5}}>ORPI</span>
      </div>
      <div>
        <div style={{color:"#fff",fontWeight:900,fontSize:13,lineHeight:1}}>DÉCLIC</div>
        <div style={{color:"rgba(255,255,255,0.4)",fontSize:9,letterSpacing:2,textTransform:"uppercase"}}>IMMO</div>
      </div>
    </div>
  );
}

// ─── SAVE BANNER ──────────────────────────────────────────────────────────────
export function SaveBanner() {
  var ctx = useApp();
  var [open, setOpen] = useState(false);
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,background:"var(--navy)",borderRadius:8,padding:"5px 10px",marginBottom:10,fontSize:11}}>
      <span style={{color:"rgba(255,255,255,0.5)",flex:1}}>{"💾 Données locales"+((ctx.syncMode||"local")==="supabase"?" · Supabase":"")}</span>
      {ctx.saveMsg && <span style={{color:"#6EE7B7",fontWeight:700}}>{ctx.saveMsg}</span>}
      <button style={{background:"rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.8)",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,fontFamily:"var(--font)"}} onClick={ctx.handleExport}>{"⬇️"}</button>
      <label style={{background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.6)",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11}}>
        {"⬆️"}
        <input type="file" accept=".json" style={{display:"none"}} onChange={function(e){ if(e.target.files[0]){ctx.handleImport(e.target.files[0]);e.target.value="";} }}/>
      </label>
    </div>
  );
}

// ─── SHELL (layout desktop + mobile) ─────────────────────────────────────────
export function AppShell({ navItems, children, title, topbarActions, onBack }) {
  var ctx = useApp();

  return (
    <div className="shell">
      {/* SIDEBAR DESKTOP */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <OrpiLogo/>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(function(item) {
            if (item.type==="section") return (
              <div key={item.label} className="nav-section">{item.label}</div>
            );
            return (
              <button key={item.id} className={"nav-item"+(item.active?" active":"")} onClick={item.onClick}>
                <span className="icon">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge != null && <span className="nav-badge">{item.badge}</span>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar" style={{background:avatarColor(ctx.currentUser&&ctx.currentUser.nom),width:32,height:32,fontSize:11}}>{ctx.currentUser&&ctx.currentUser.avatar}</div>
            <div>
              <div className="sidebar-user-name">{ctx.currentUser&&ctx.currentUser.nom}</div>
              <div className="sidebar-user-role">{ctx.currentUser&&ctx.currentUser.role}</div>
            </div>
          </div>
          <button className="sidebar-logout" onClick={ctx.handleLogout}>{"↩ Déconnexion"}</button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main">
        {/* TOPBAR DESKTOP */}
        <div className="topbar">
          <span className="topbar-title">{title}</span>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {topbarActions}
          </div>
        </div>

        {/* TOPBAR MOBILE */}
        <div className="mob-topbar">
          <OrpiLogo/>
          <span className="mob-topbar-title">{title}</span>
          <button style={{background:"none",border:"none",color:"rgba(255,255,255,0.6)",fontSize:22,cursor:"pointer"}} onClick={ctx.handleLogout}>{"↩"}</button>
        </div>

        <div className="content">
          {children}
        </div>
      </div>

      {/* BOTTOM NAV MOBILE */}
      <div className="bottom-nav">
        <div className="bottom-nav-inner">
          {navItems.filter(function(i){return i.type!=="section";}).map(function(item) {
            return (
              <button key={item.id} className={"bnav-item"+(item.active?" active":"")} onClick={item.onClick}>
                {item.badge != null && item.badge > 0 && <span className="bnav-dot"></span>}
                <span className="bnav-icon">{item.icon}</span>
                <span className="bnav-label">{item.shortLabel||item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={wide?{maxWidth:720}:{}} onClick={function(e){e.stopPropagation();}}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>{"×"}</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, sub, color, icon, trend, onClick }) {
  var c = color || "var(--navy)";
  return (
    <div className="kpi-card" style={{borderLeftColor:c, cursor:onClick?"pointer":"default", position:"relative"}} onClick={onClick}>
      {onClick && <div style={{position:"absolute",top:6,right:8,fontSize:10,color:"var(--g300)"}}>{"▶"}</div>}
      <div className="kpi-label">{icon&&<span style={{marginRight:4}}>{icon}</span>}{label}</div>
      <div className="kpi-value" style={{color:c}}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      {trend !== undefined && (
        <div style={{fontSize:11,fontWeight:700,color:trend>0?"#10B981":trend<0?"#EF4444":"#94A3B8",marginTop:4}}>
          {trend>0?"▲":trend<0?"▼":"—"} {Math.abs(trend)}% vs période préc.
        </div>
      )}
    </div>
  );
}

// ─── PERIOD SELECTOR ──────────────────────────────────────────────────────────
export function PeriodSelector({ value, onChange, customFrom, customTo, onCustomFrom, onCustomTo }) {
  var opts = [["month","Ce mois"],["quarter","Trimestre"],["year","Année"],["all","Tout"],["custom","Perso"]];
  return (
    <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
      {opts.map(function(pair) {
        return (
          <button key={pair[0]} onClick={function(){onChange(pair[0]);}} style={{padding:"6px 12px",borderRadius:20,border:"1.5px solid "+(value===pair[0]?"var(--red)":"var(--g200)"),background:value===pair[0]?"var(--red)":"#fff",color:value===pair[0]?"#fff":"var(--g500)",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"var(--font)"}}>
            {pair[1]}
          </button>
        );
      })}
      {value==="custom" && (
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <input type="date" value={customFrom} onChange={function(e){onCustomFrom(e.target.value);}} className="form-input" style={{width:"auto",fontSize:12}}/>
          <span style={{color:"var(--g400)"}}>{"→"}</span>
          <input type="date" value={customTo}   onChange={function(e){onCustomTo(e.target.value);}}   className="form-input" style={{width:"auto",fontSize:12}}/>
        </div>
      )}
    </div>
  );
}

// ─── BADGES ───────────────────────────────────────────────────────────────────

// ─── HT / TTC ─────────────────────────────────────────────────────────────────
var TVA_IMMO = 0.20; // TVA 20% sur honoraires et locaux pro
var TYPES_PRO = ["local_pro_location","local_pro_vente","immeuble","fonds_commerce"];

// Détermine si le type de bien est soumis à TVA
export function isTVA(typeBien) {
  return TYPES_PRO.includes(typeBien);
}

// Commission HT depuis commission TTC (pour KPI CA)
export function commHT(commTTC, typeBien) {
  if (!commTTC) return 0;
  // Les honoraires immo sont toujours TTC — on les ramène HT pour les KPI
  return Math.round(commTTC / (1 + TVA_IMMO) * 100) / 100;
}

// Commission TTC depuis HT
export function commTTC(commHT, typeBien) {
  return Math.round(commHT * (1 + TVA_IMMO) * 100) / 100;
}

// Formater un prix avec mention HT si local pro
export function fmtPrix(prix, typeBien) {
  if (!prix) return "—";
  var base = Number(prix).toLocaleString("fr-FR")+"€";
  if (isTVA(typeBien)) return base+" HT";
  return base;
}

// Formater une commission toujours TTC (pour affichage terrain)
export function fmtComm(comm, typeBien) {
  if (!comm) return "—";
  var ht = commHT(comm, typeBien);
  var base = Number(comm).toLocaleString("fr-FR")+"€ TTC";
  if (isTVA(typeBien)) return base+" ("+Number(ht).toLocaleString("fr-FR")+"€ HT)";
  return base;
}

// ─── CONFIDENTIALITÉ CONTACTS ─────────────────────────────────────────────────
// canSeeContact : true si manager/superadmin, agent créateur, co-agent
// Si confidentiel=true : seuls manager et créateur voient les coordonnées
export function canSeeContact(currentUser, agentId, coAgents, confidentiel) {
  if (!currentUser) return false;
  // Superadmin voit toujours tout, sans exception
  if (currentUser.role === "superadmin") return true;
  // Le créateur voit toujours ses propres données
  if (currentUser.id === agentId) return true;
  // Si confidentiel : seuls le créateur (ci-dessus) et le superadmin (ci-dessus) voient
  if (confidentiel) return false;
  // Sinon managers et co-agents voient
  if (currentUser.role === "manager") return true;
  if (coAgents && coAgents.find(function(ca){ return ca.agentId === currentUser.id; })) return true;
  return false;
}

// Masquer un texte confidentiel
export function masquer(texte, visible) {
  if (!texte) return "—";
  if (visible) return texte;
  return "••••••••";
}

// Masquer un téléphone : garder les 2 premiers chiffres
export function masquerTel(tel, visible) {
  if (!tel) return "—";
  if (visible) return tel;
  return tel.toString().slice(0,2)+" ••• ••• ••";
}

export function BadgeStatut({ statut }) {
  var map = { mandat:"badge-mandat", sous_offre:"badge-sous-offre", compromis:"badge-compromis", vendu:"badge-vendu" };
  var lbl = { mandat:"Mandat", sous_offre:"🤝 Sous offre", compromis:"Compromis", vendu:"Vendu" };
  return <span className={"badge "+(map[statut]||"badge-mandat")}>{lbl[statut]||statut}</span>;
}
export function BadgeType({ type }) {
  return <span className={"badge "+(type==="exclusif"?"badge-exclusif":"badge-simple")}>{type==="exclusif"?"⭐ Exclusif":"Simple"}</span>;
}
export function BadgeNiveau({ niveau }) {
  return <span className={"badge "+(niveau==="senior"?"badge-senior":"badge-junior")}>{niveau==="senior"?"🏆 Senior":"🌱 Junior"}</span>;
}

// ─── MANDAT FORM ──────────────────────────────────────────────────────────────
export function MandatForm({ initial, agents, agenceId, onSave, onCancel }) {
  var init = initial || {};
  var [erreurs, setErreurs] = useState([]);
  // Préremplir agentId avec le premier agent si non défini
  var defaultAgentId = (init.agentId) || (agents && agents.length>0 ? agents[0].id : "");
  var today2 = new Date().toISOString().slice(0,10);
  var [f, setF] = useState({
    ref:"", typeMandat:"simple", typeBien:"appartement", adresse:"", prix:"", commission:"", tauxCommission:7,
    statut:"mandat", agentId:defaultAgentId, agenceId:agenceId||"", nbApparts:"", loyersMensuel:"", loyersAnnuel:"", chargesAnnuelles:"",
    dateMandat:today2, dateExpiration:"", dateCompromis:"", dateSignature:"",
    clausesSuspensivesLevees:false,
    // Composition
    surface:"", nbPieces:"", nbChambres:"", nbSDB:"", etage:"", orientation:"",
    // Options
    avecJardin:false, avecGarage:false, avecTerrasse:false,
    avecAscenseur:false, avecCave:false, avecParking:false, avecPiscine:false,
    // Autres
    dpe:"", anneeConstruction:"", chauffage:"",
    proprietaireNom:"", proprietairePrenom:"", proprietaireTel:"", proprietaireMail:"",
    notes:"", photos:[],
    ...init,
  });
  function set(k, v) {
    setF(function(p) {
      var next = {...p,[k]:v};
      // Recalcul auto commission si prix ou taux change
      if ((k==="prix"||k==="tauxCommission") && next.prix && next.tauxCommission) {
        next.commission = Math.round(Number(next.prix) * Number(next.tauxCommission) / 100);
      }
      return next;
    });
  }
  function toggleOpt(k) { setF(function(p){ return {...p,[k]:!p[k]}; }); }

  var TYPES_BIEN = [
    {id:"appartement",        label:"🏢 Appartement"},
    {id:"maison",             label:"🏠 Maison"},
    {id:"terrain",            label:"🌿 Terrain"},
    {id:"immeuble",           label:"🏗️ Immeuble"},
    {id:"garage",             label:"🚗 Garage"},
    {id:"local_pro_vente",    label:"🏪 Local pro à vendre"},
    {id:"local_pro_location", label:"🏬 Local pro à louer"},
    {id:"fonds_commerce",      label:"🏪 Fonds de commerce"},
  ];
  var DPE_OPTS = ["A","B","C","D","E","F","G"];
  var DPE_COL  = {A:"#059669",B:"#22C55E",C:"#84CC16",D:"#EAB308",E:"#F97316",F:"#EF4444",G:"#991B1B"};
  var ETAGES   = ["RDC","1er","2ème","3ème","4ème","5ème","Dernier étage"];
  var ORIENT   = ["Nord","Sud","Est","Ouest","Sud-Est","Sud-Ouest"];
  var CHAUFF   = ["Gaz","Électrique","Fioul","Pompe à chaleur","Géothermie","Bois","Autre"];

  return (
    <Modal title={init.id?"✏️ Modifier le mandat":"➕ Nouveau mandat"} onClose={onCancel}
      footer={
        <div style={{display:"flex",gap:8,width:"100%",flexDirection:"column"}}>
          {erreurs.length>0 && (
            <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,padding:"10px 14px",width:"100%"}}>
              {erreurs.map(function(e,i){ return <div key={i} style={{fontSize:12,color:"#DC2626",fontWeight:600}}>{"⚠️ "+e}</div>; })}
            </div>
          )}
          <div style={{display:"flex",gap:8,width:"100%"}}>
          <button className="btn btn-secondary" onClick={onCancel}>{"Annuler"}</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={function(){
            var errs = [];
            if (!f.ref || !f.ref.trim())        errs.push("Référence mandat obligatoire");
            if (!f.adresse || !f.adresse.trim())errs.push("Adresse obligatoire");
            if (!f.prix || Number(f.prix)<=0)   errs.push("Prix obligatoire (supérieur à 0)");
            if (!f.agentId)                     errs.push("Veuillez sélectionner un agent");
            setErreurs(errs);
            if (errs.length===0) onSave(f);
          }}>
            {init.id?"Enregistrer les modifications":"Créer le mandat"}
          </button>
          </div>
        </div>
      }>
      <div className="form-grid">

        {/* ─── IDENTIFICATION ─── */}
        <div className="form-group">
          <label className="form-label">{"Référence"}</label>
          <input className="form-input" value={f.ref} onChange={function(e){set("ref",e.target.value);}} placeholder="MAN-016"/>
        </div>
        <div className="form-group">
          <label className="form-label">{"Type de mandat"}</label>
          <select className="form-select" value={f.typeMandat} onChange={function(e){set("typeMandat",e.target.value);}}>
            <option value="simple">{"Simple"}</option>
            <option value="exclusif">{"Exclusif"}</option>
          </select>
        </div>
        <div className="form-group form-full">
          <label className="form-label">{"Adresse"}</label>
          <input className="form-input" value={f.adresse} onChange={function(e){set("adresse",e.target.value);}} placeholder="5 Rue de la Paix, Amiens"/>
        </div>

        {/* ─── TYPE DE BIEN ─── */}
        <div className="form-group form-full">
          <label className="form-label">{"Type de bien"}</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {TYPES_BIEN.map(function(t){
              var actif = f.typeBien===t.id;
              return (
                <button key={t.id} type="button" onClick={function(){set("typeBien",t.id);}} style={{padding:"6px 12px",borderRadius:20,border:"2px solid "+(actif?"var(--blue)":"var(--g200)"),background:actif?"#EFF6FF":"#fff",color:actif?"var(--blue)":"var(--g400)",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"var(--font)"}}>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── PRIX ─── */}
        <div className="form-group">
          <label className="form-label">{isTVA(f.typeBien)?"Prix HT (€)":"Prix de vente (€)"}</label>
          <input className="form-input" type="number" value={f.prix} onChange={function(e){set("prix",Number(e.target.value));}} placeholder="Ex : 250000"/>
          {isTVA(f.typeBien)&&f.prix>0&&<div style={{fontSize:11,color:"var(--g400)",marginTop:3}}>{"TTC : "+Math.round(f.prix*1.2).toLocaleString("fr-FR")+"€"}</div>}
        {/* ─── CHAMPS IMMEUBLE DE RAPPORT ─── */}
        {f.typeBien==="immeuble" && (
          <div style={{gridColumn:"1/-1",background:"#EFF6FF",borderRadius:10,padding:"12px 14px"}}>
            <div style={{fontWeight:800,color:"var(--blue)",fontSize:12,marginBottom:10}}>{"🏗️ Données immeuble de rapport"}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"NB APPARTEMENTS"}</label>
                <input type="number" className="form-input" value={f.nbApparts||""} onChange={function(e){set("nbApparts",e.target.value);}} placeholder="Ex: 6"/>
              </div>
              <div>
                <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"LOYERS MENSUELS (€)"}</label>
                <input type="number" className="form-input" value={f.loyersMensuel||""} onChange={function(e){
                  set("loyersMensuel",Number(e.target.value));
                  set("loyersAnnuel",Math.round(Number(e.target.value)*12));
                }} placeholder="Ex: 3200"/>
              </div>
              <div>
                <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"LOYERS ANNUELS (€)"}</label>
                <input type="number" className="form-input" value={f.loyersAnnuel||""} onChange={function(e){set("loyersAnnuel",Number(e.target.value));}} placeholder="Calculé auto"/>
              </div>
              <div>
                <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"CHARGES ANNUELLES (€)"}</label>
                <input type="number" className="form-input" value={f.chargesAnnuelles||""} onChange={function(e){set("chargesAnnuelles",Number(e.target.value));}} placeholder="Ex: 4800"/>
              </div>
            </div>
            {/* Calcul rentabilité auto */}
            {f.prix>0 && f.loyersMensuel>0 && (function(){
              var brut = Math.round(f.loyersMensuel*12/f.prix*100*10)/10;
              var net  = f.chargesAnnuelles ? Math.round((f.loyersMensuel*12-f.chargesAnnuelles)/f.prix*100*10)/10 : null;
              return (
                <div style={{marginTop:10,display:"flex",gap:10}}>
                  <div style={{flex:1,background:"#fff",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                    <div style={{fontSize:9,color:"var(--g400)",fontWeight:700}}>{"RENTA BRUTE"}</div>
                    <div style={{fontWeight:900,fontSize:18,color:"var(--blue)"}}>{brut+"%"}</div>
                  </div>
                  {net && <div style={{flex:1,background:"#fff",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                    <div style={{fontSize:9,color:"var(--g400)",fontWeight:700}}>{"RENTA NETTE"}</div>
                    <div style={{fontWeight:900,fontSize:18,color:"var(--green)"}}>{net+"%"}</div>
                  </div>}
                </div>
              );
            })()}
          </div>
        )}
        </div>
        <div className="form-group">
          <label className="form-label">{"Commission TTC (€)"}</label>
          <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
            {[3,4,5,6,7,8].map(function(t){
              var actif = f.tauxCommission===t || (!f.tauxCommission && t===7);
              return (
                <button key={t} type="button" onClick={function(){set("tauxCommission",t);}}
                  style={{flex:1,padding:"4px 0",borderRadius:7,border:"2px solid "+(actif?"var(--navy)":"var(--g200)"),background:actif?"var(--navy)":"#fff",color:actif?"#fff":"var(--g500)",fontWeight:800,fontSize:11,cursor:"pointer",fontFamily:"var(--font)"}}>
                  {t+"%"}
                </button>
              );
            })}
          </div>
          <input className="form-input" type="number" value={f.commission} onChange={function(e){set("commission",Number(e.target.value));}} placeholder="Calculé automatiquement"/>
          {f.prix>0&&f.commission>0&&(
            <div style={{fontSize:11,color:"var(--g400)",marginTop:3,display:"flex",gap:8}}>
              <span>{"HT : "+Math.round(f.commission/1.2).toLocaleString("fr-FR")+"€"}</span>
              <span>{"· "+Math.round(f.commission/f.prix*100*100)/100+"% du prix"}</span>
            </div>
          )}
        </div>

        {/* ─── COMPOSITION ─── */}
        <div style={{gridColumn:"1/-1",fontWeight:700,color:"var(--navy)",fontSize:12,paddingTop:12,borderTop:"1px solid var(--g100)"}}>{"🛏️ Composition"}</div>
        <div className="form-group">
          <label className="form-label">{"Surface (m²)"}</label>
          <input className="form-input" type="number" value={f.surface} onChange={function(e){set("surface",e.target.value);}} placeholder="Ex : 75"/>
        </div>
        <div className="form-group">
          <label className="form-label">{"Nb de pièces"}</label>
          <select className="form-select" value={f.nbPieces} onChange={function(e){set("nbPieces",e.target.value);}}>
            <option value="">{"— Indifférent"}</option>
            {["1","2","3","4","5","6","7","8+"].map(function(v){return <option key={v} value={v}>{v+" pièce"+(v==="1"?"":"s")}</option>;})}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{"Nb de chambres"}</label>
          <select className="form-select" value={f.nbChambres} onChange={function(e){set("nbChambres",e.target.value);}}>
            <option value="">{"—"}</option>
            {["1","2","3","4","5","6+"].map(function(v){return <option key={v} value={v}>{v+" chambre"+(v==="1"?"":"s")}</option>;})}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{"Nb de SDB"}</label>
          <select className="form-select" value={f.nbSDB} onChange={function(e){set("nbSDB",e.target.value);}}>
            <option value="">{"—"}</option>
            <option value="1">{"1 SDB"}</option>
            <option value="2">{"2 SDB"}</option>
            <option value="3">{"3+ SDB"}</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{"Étage"}</label>
          <select className="form-select" value={f.etage} onChange={function(e){set("etage",e.target.value);}}>
            <option value="">{"—"}</option>
            {ETAGES.map(function(e){return <option key={e} value={e}>{e}</option>;})}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{"Orientation"}</label>
          <select className="form-select" value={f.orientation} onChange={function(e){set("orientation",e.target.value);}}>
            <option value="">{"—"}</option>
            {ORIENT.map(function(o){return <option key={o} value={o}>{o}</option>;})}
          </select>
        </div>

        {/* ─── OPTIONS ─── */}
        <div style={{gridColumn:"1/-1",fontWeight:700,color:"var(--navy)",fontSize:12,paddingTop:12,borderTop:"1px solid var(--g100)"}}>{"✨ Options & équipements"}</div>
        <div style={{gridColumn:"1/-1",display:"flex",gap:8,flexWrap:"wrap"}}>
          {[
            ["avecJardin","🌿 Jardin"],["avecGarage","🚗 Garage"],["avecTerrasse","☀️ Terrasse/Balcon"],
            ["avecAscenseur","🛗 Ascenseur"],["avecCave","📦 Cave"],["avecParking","🅿️ Parking"],
            ["avecPiscine","🏊 Piscine"],
          ].map(function(opt){
            var actif = !!f[opt[0]];
            return (
              <button key={opt[0]} type="button" onClick={function(){toggleOpt(opt[0]);}} style={{padding:"6px 12px",borderRadius:20,border:"2px solid "+(actif?"var(--green)":"var(--g200)"),background:actif?"#F0FDF4":"#fff",color:actif?"var(--green)":"var(--g400)",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"var(--font)"}}>
                {opt[1]}
              </button>
            );
          })}
        </div>

        {/* ─── INFOS TECHNIQUES ─── */}
        <div style={{gridColumn:"1/-1",fontWeight:700,color:"var(--navy)",fontSize:12,paddingTop:12,borderTop:"1px solid var(--g100)"}}>{"🏗️ Infos techniques"}</div>
        <div className="form-group">
          <label className="form-label">{"DPE"}</label>
          <div style={{display:"flex",gap:5}}>
            {DPE_OPTS.map(function(d){
              var actif = f.dpe===d;
              return (
                <button key={d} type="button" onClick={function(){set("dpe",actif?"":d);}} style={{width:32,height:32,borderRadius:8,border:"2px solid "+(actif?DPE_COL[d]:"var(--g200)"),background:actif?DPE_COL[d]+"22":"#fff",color:actif?DPE_COL[d]:"var(--g400)",fontWeight:900,fontSize:13,cursor:"pointer",fontFamily:"var(--font)"}}>
                  {d}
                </button>
              );
            })}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{"Année de construction"}</label>
          <input className="form-input" type="number" value={f.anneeConstruction} onChange={function(e){set("anneeConstruction",e.target.value);}} placeholder="Ex : 1985"/>
        </div>
        <div className="form-group">
          <label className="form-label">{"Chauffage"}</label>
          <select className="form-select" value={f.chauffage} onChange={function(e){set("chauffage",e.target.value);}}>
            <option value="">{"—"}</option>
            {CHAUFF.map(function(ch){return <option key={ch} value={ch}>{ch}</option>;})}
          </select>
        </div>

        {/* ─── PROPRIÉTAIRE ─── */}
        <div style={{gridColumn:"1/-1",fontWeight:700,color:"var(--navy)",fontSize:12,paddingTop:12,borderTop:"1px solid var(--g100)"}}>{"👤 Propriétaire"}</div>
        <div className="form-group">
          <label className="form-label">{"Nom"}</label>
          <input className="form-input" value={f.proprietaireNom} onChange={function(e){set("proprietaireNom",e.target.value);}}/>
        </div>
        <div className="form-group">
          <label className="form-label">{"Prénom"}</label>
          <input className="form-input" value={f.proprietairePrenom} onChange={function(e){set("proprietairePrenom",e.target.value);}}/>
        </div>
        <div className="form-group">
          <label className="form-label">{"Téléphone"}</label>
          <input className="form-input" value={f.proprietaireTel} onChange={function(e){set("proprietaireTel",e.target.value);}}/>
        </div>
        <div className="form-group">
          <label className="form-label">{"Email"}</label>
          <input className="form-input" type="email" value={f.proprietaireMail} onChange={function(e){set("proprietaireMail",e.target.value);}}/>
        </div>

        {/* ─── SUIVI ─── */}
        <div style={{gridColumn:"1/-1",fontWeight:700,color:"var(--navy)",fontSize:12,paddingTop:12,borderTop:"1px solid var(--g100)"}}>{"📅 Suivi"}</div>
        <div className="form-group">
          <label className="form-label">{"Statut"}</label>
          <select className="form-select" value={f.statut} onChange={function(e){set("statut",e.target.value);}}>
            <option value="mandat">{"Mandat"}</option>
            <option value="sous_offre">{"🤝 Sous offre"}</option>
            <option value="compromis">{"Compromis"}</option>
            <option value="vendu">{"Vendu"}</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{"Agent co."}</label>
          <select className="form-select" value={f.agentId} onChange={function(e){set("agentId",e.target.value);}}>
            <option value="">{"— Choisir —"}</option>
            {(agents||[]).map(function(a) { return <option key={a.id} value={a.id}>{a.nom}</option>; })}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{"Date mandat"}</label>
          <input className="form-input" type="date" value={f.dateMandat||""} onChange={function(e){set("dateMandat",e.target.value);}}/>
        </div>
        <div className="form-group">
          <label className="form-label">{"Date expiration"}</label>
          <input className="form-input" type="date" value={f.dateExpiration||""} onChange={function(e){set("dateExpiration",e.target.value);}}/>
        </div>
        {(f.statut==="sous_offre"||f.statut==="compromis"||f.statut==="vendu") && (
          <div className="form-group">
            <label className="form-label">{"Date compromis"}</label>
            <input className="form-input" type="date" value={f.dateCompromis||""} onChange={function(e){set("dateCompromis",e.target.value);}}/>
          </div>
        )}
        {(f.statut==="sous_offre"||f.statut==="compromis"||f.statut==="vendu") && (
          <div className="form-group">
            <label className="form-label">{"Signature prévisionnelle"}</label>
            <input className="form-input" type="date" value={f.dateSignature||""} onChange={function(e){set("dateSignature",e.target.value);}}/>
          </div>
        )}
        {(f.statut==="sous_offre"||f.statut==="compromis"||f.statut==="vendu") && (
          <div className="checkbox-row form-full" onClick={function(){set("clausesSuspensivesLevees",!f.clausesSuspensivesLevees);}}>
            <input type="checkbox" checked={!!f.clausesSuspensivesLevees} onChange={function(){}} style={{width:18,height:18}}/>
            <label>{"✅ Clauses suspensives levées — commission encaissable"}</label>
          </div>
        )}

        {/* ─── NOTES ─── */}
        <div className="form-group form-full">
          <label className="form-label">{"📝 Notes internes"}</label>
          <textarea className="form-input" rows={3} value={f.notes||""} onChange={function(e){set("notes",e.target.value);}} style={{resize:"vertical",fontFamily:"var(--font)"}} placeholder="Informations complémentaires, contexte vendeur..."/>
        </div>

        {/* ─── PHOTOS ─── */}
        <div className="form-group form-full">
          <label className="form-label">{"📷 Photos du bien"}</label>
          <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,border:"2px dashed var(--g200)",borderRadius:10,padding:"12px",cursor:"pointer",background:"var(--g50)"}}>
            <input type="file" accept="image/*" multiple style={{display:"none"}} onChange={function(e){
              var files = Array.from(e.target.files);
              Promise.all(files.map(function(file){ return new Promise(function(resolve){ var r=new FileReader(); r.onload=function(ev){resolve(ev.target.result);}; r.readAsDataURL(file); }); })).then(function(results){ set("photos",[...(f.photos||[]),...results]); });
            }}/>
            <span style={{fontSize:18}}>{"📷"}</span>
            <div>
              <div style={{fontWeight:700,fontSize:12,color:"var(--navy)"}}>{"Ajouter des photos"}</div>
              <div style={{fontSize:10,color:"var(--g400)",marginTop:1}}>{"Façade, intérieur, plans"}</div>
            </div>
          </label>
          {(f.photos||[]).length>0 && (
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
              {(f.photos||[]).map(function(p, i){
                return (
                  <div key={i} style={{position:"relative"}}>
                    <img src={p} alt="" style={{width:72,height:72,objectFit:"cover",borderRadius:9,border:"1px solid var(--g200)"}}/>
                    <button onClick={function(){set("photos",(f.photos||[]).filter(function(_,idx){return idx!==i;}));}} style={{position:"absolute",top:-6,right:-6,width:20,height:20,borderRadius:"50%",background:"#EF4444",border:"2px solid #fff",color:"#fff",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,lineHeight:1}}>{"×"}</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </Modal>
  );
}
