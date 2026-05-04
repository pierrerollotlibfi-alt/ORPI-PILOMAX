import { useState, useMemo, useRef, useEffect } from "react";
import ManagerApp from "./ManagerApp";
import { useApp } from "../App";
import { AppShell, fmt, fmtDate, avatarColor } from "./Shared";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
var NOW = new Date();
var NOW_STR = NOW.toISOString().slice(0,10);
function diffDays(a, b) { return Math.round((new Date(b)-new Date(a))/86400000); }
function inMoisCourant(d) {
  if (!d) return false;
  var dt = new Date(d);
  return dt.getFullYear()===NOW.getFullYear() && dt.getMonth()===NOW.getMonth();
}
function KpiCard({ label, value, sub, color, icon }) {
  return (
    <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",borderLeft:"4px solid "+(color||"var(--navy)"),padding:"14px 16px"}}>
      <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>{icon+" "+label}</div>
      <div style={{fontSize:22,fontWeight:900,color:color||"var(--navy)",lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:11,color:"var(--g400)",marginTop:4}}>{sub}</div>}
    </div>
  );
}

// ─── PLACEHOLDER (évite erreur si FormCreationAgence référencé avant définition) ─
// (composant défini inline dans SuperAdminApp)
function Badge({ text, color, bg }) {
  return <span style={{background:bg||"var(--g100)",color:color||"var(--g500)",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700,display:"inline-block"}}>{text}</span>;
}

// ─── COORDONNÉES AGENCES ──────────────────────────────────────────────────────
var AGENCE_COORDS = {
  "agence-1": [49.894, 2.296],   // Amiens
  "agence-2": [50.152, 2.341],   // Doullens
  "agence-3": [49.877, 2.514],   // Corbie
};
var AGENCE_COLORS = ["#E63946","#2196F3","#4CAF50","#FF9800","#9C27B0","#00BCD4"];

export default function SuperAdminApp() {
  var ctx = useApp();
  var { currentUser, users, agences, mandats, locations, gestion, objectifs, offmarket, handleLogout, changerMotDePasse, setAgences, setUsers, setObjectifs } = ctx;

  var [tab, _setTabRaw] = useState(function(){ try{ return localStorage.getItem("orpi_tab_superadmin")||"groupe"; }catch(e){ return "groupe"; } });
  function setTab(v){ try{ localStorage.setItem("orpi_tab_superadmin",v); }catch(e){} _setTabRaw(v); }
  var [agenceSelectee, setAgenceSelectee] = useState(null); // null = vue groupe
  var [agenceMode, setAgenceMode] = useState(null); // null = vue groupe, sinon agenceId de la vue manager
  var [periode, setPeriode] = useState("mois"); // mois | trim | annee | tout
  var [showCreateAgence, setShowCreateAgence] = useState(false);
  var [createMsg, setCreateMsg] = useState(null);

  var agencesActives = agences.filter(function(a){ return a.actif; });

  // ─── FILTRAGE PAR PÉRIODE ─────────────────────────────────────────────────
  function inPeriode(d) {
    if (!d) return false;
    var dt = new Date(d);
    var now = NOW;
    if (periode === "mois")  return dt.getFullYear()===now.getFullYear() && dt.getMonth()===now.getMonth();
    if (periode === "trim")  return dt >= new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1);
    if (periode === "annee") return dt.getFullYear()===now.getFullYear();
    return true;
  }

  // ─── STATS PAR AGENCE ────────────────────────────────────────────────────
  var statsParAgence = useMemo(function() {
    return agencesActives.map(function(ag) {
      var m   = mandats.filter(function(x){ return x.agenceId===ag.id; });
      var l   = locations.filter(function(x){ return x.agenceId===ag.id; });
      var g   = gestion.filter(function(x){ return x.agenceId===ag.id && x.actif; });
      var om  = (offmarket||[]).filter(function(x){ return x.agenceId===ag.id && x.actif; });
      var agts= users.filter(function(u){ return u.agenceId===ag.id && u.actif && u.role==="agent"; });
      var mgrs= users.filter(function(u){ return u.agenceId===ag.id && u.actif && (u.role==="manager"); });

      var actifs    = m.filter(function(x){ return x.statut==="mandat"; });
      var compromis = m.filter(function(x){ return x.statut==="compromis"; });
      var vendus    = m.filter(function(x){ return x.statut==="vendu"; });

      var caStock   = actifs.reduce(function(s,x){return s+(x.commission||0);},0);
      var caSigne   = compromis.reduce(function(s,x){return s+(x.commission||0);},0);
      var caRealise = vendus.reduce(function(s,x){return s+(x.commission||0);},0);
      var caLoc     = l.filter(function(x){return x.locataireTrouve;}).reduce(function(s,x){return s+(x.commission||0);},0);
      var caGestion = g.reduce(function(s,x){return s+(x.commissionMensuelle||0);},0);
      var caTotal   = caRealise + caLoc;

      var vendusP   = m.filter(function(x){ return x.statut==="vendu" && inPeriode(x.dateSignature||x.dateCompromis); });
      var offresP   = m.filter(function(x){ return inPeriode(x.dateCompromis); });
      var caP       = vendusP.reduce(function(s,x){return s+(x.commission||0);},0);

      var expirants = actifs.filter(function(x){ return x.dateExpiration && diffDays(NOW_STR,x.dateExpiration)<=30 && diffDays(NOW_STR,x.dateExpiration)>=0; });

      // Délai moyen
      var vendusAvecDates = m.filter(function(x){ return x.statut==="vendu" && x.dateMandat && x.dateSignature; });
      var delaiMoyen = vendusAvecDates.length > 0
        ? Math.round(vendusAvecDates.reduce(function(s,x){return s+diffDays(x.dateMandat,x.dateSignature);},0)/vendusAvecDates.length)
        : null;

      return {
        agence: ag,
        agents: agts, managers: mgrs,
        nbMandats: actifs.length, nbCompromis: compromis.length, nbVendus: vendus.length,
        nbLocations: l.length, nbGestion: g.length, nbOffmarket: om.length,
        caStock, caSigne, caRealise, caLoc, caGestion, caTotal,
        caP, vendusP, offresP,
        expirants, delaiMoyen,
        txExclusif: actifs.length > 0 ? Math.round(actifs.filter(function(x){return x.typeMandat==="exclusif";}).length/actifs.length*100) : 0,
      };
    });
  }, [agencesActives, mandats, locations, gestion, offmarket, users, periode]);

  // ─── STATS CONSOLIDÉES ───────────────────────────────────────────────────
  var consolide = useMemo(function() {
    return {
      caStock:   statsParAgence.reduce(function(s,a){return s+a.caStock;},0),
      caSigne:   statsParAgence.reduce(function(s,a){return s+a.caSigne;},0),
      caRealise: statsParAgence.reduce(function(s,a){return s+a.caRealise;},0),
      caGestion: statsParAgence.reduce(function(s,a){return s+a.caGestion;},0),
      caP:       statsParAgence.reduce(function(s,a){return s+a.caP;},0),
      nbMandats: statsParAgence.reduce(function(s,a){return s+a.nbMandats;},0),
      nbCompromis:statsParAgence.reduce(function(s,a){return s+a.nbCompromis;},0),
      nbVendus:  statsParAgence.reduce(function(s,a){return s+a.nbVendus;},0),
      nbAgents:  statsParAgence.reduce(function(s,a){return s+a.agents.length;},0),
      nbExpirants:statsParAgence.reduce(function(s,a){return s+a.expirants.length;},0),
    };
  }, [statsParAgence]);


  // ─── CRÉER UNE NOUVELLE AGENCE (clone structure Amiens) ──────────────────
  function creerAgence(form) {
    var newId = "agence-" + Date.now();
    var newAgence = {
      id: newId,
      nom: form.nom,
      ville: form.ville,
      adresse: form.adresse,
      telephone: form.telephone,
      email: form.email,
      actif: true,
      createdAt: new Date().toISOString().slice(0,10),
    };
    setAgences(function(prev){ return [...prev, newAgence]; });

    // Créer le manager de la nouvelle agence si email fourni
    if (form.managerNom && form.managerEmail) {
      var newManager = {
        id: "manager-" + Date.now(),
        nom: form.managerNom,
        email: form.managerEmail.toLowerCase(),
        password: form.managerPwd || "ORPI2026",
        role: "manager",
        agenceId: newId,
        actif: true,
        createdAt: new Date().toISOString().slice(0,10),
        avatar: form.managerNom.split(" ").map(function(n){return n[0]||"";}).join("").slice(0,2).toUpperCase(),
        premierAcces: false,
        invitationAcceptee: true,
      };
      setUsers(function(prev){ return [...prev, newManager]; });
    }

    setShowCreateAgence(false);
    setCreateMsg("✅ Agence " + form.nom + " créée — elle apparaît maintenant dans la liste.");
    setTimeout(function(){ setCreateMsg(null); }, 5000);
  }


  // ─── FORMULAIRE CRÉATION AGENCE ──────────────────────────────────────────
  function FormCreationAgence({ onSave, onClose }) {
    var [f, setF] = useState({
      nom:"", ville:"", adresse:"", telephone:"", email:"",
      managerNom:"", managerEmail:"", managerPwd:"ORPI2026",
    });
    function set(k,v){ setF(function(p){return{...p,[k]:v};}); }
    function valid(){ return f.nom.trim() && f.ville.trim(); }

    return (
      <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
        <div style={{background:"#fff",borderRadius:16,padding:24,width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto"}} onClick={function(e){e.stopPropagation();}}>
          <div style={{fontWeight:900,color:"var(--navy)",fontSize:16,marginBottom:16}}>{"🏢 Créer une nouvelle agence"}</div>

          <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#1D4ED8"}}>
            {"La nouvelle agence démarrera vide. Elle partagera la même application que l'agence d'Amiens mais avec ses propres données (mandats, agents, etc.)."}
          </div>

          <div style={{fontWeight:700,color:"var(--navy)",fontSize:12,marginBottom:8,textTransform:"uppercase",letterSpacing:.6}}>{"🏢 Informations agence"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            <div className="form-group" style={{gridColumn:"1/-1"}}>
              <label className="form-label">{"Nom de l'agence *"}</label>
              <input className="form-input" value={f.nom} onChange={function(e){set("nom",e.target.value);}} placeholder="Ex: ORPI Pro Abbeville" autoFocus/>
            </div>
            <div className="form-group">
              <label className="form-label">{"Ville *"}</label>
              <input className="form-input" value={f.ville} onChange={function(e){set("ville",e.target.value);}} placeholder="Ex: Abbeville"/>
            </div>
            <div className="form-group">
              <label className="form-label">{"Téléphone"}</label>
              <input className="form-input" value={f.telephone} onChange={function(e){set("telephone",e.target.value);}} placeholder="03 22 ..."/>
            </div>
            <div className="form-group" style={{gridColumn:"1/-1"}}>
              <label className="form-label">{"Adresse"}</label>
              <input className="form-input" value={f.adresse} onChange={function(e){set("adresse",e.target.value);}} placeholder="5 Rue de la République, 80100 Abbeville"/>
            </div>
            <div className="form-group" style={{gridColumn:"1/-1"}}>
              <label className="form-label">{"Email agence"}</label>
              <input className="form-input" type="email" value={f.email} onChange={function(e){set("email",e.target.value);}} placeholder="contact@orpi-abbeville.fr"/>
            </div>
          </div>

          <div style={{fontWeight:700,color:"var(--navy)",fontSize:12,marginBottom:8,textTransform:"uppercase",letterSpacing:.6}}>{"👤 Manager de l'agence (optionnel)"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
            <div className="form-group">
              <label className="form-label">{"Nom complet"}</label>
              <input className="form-input" value={f.managerNom} onChange={function(e){set("managerNom",e.target.value);}} placeholder="Prénom Nom"/>
            </div>
            <div className="form-group">
              <label className="form-label">{"Email de connexion"}</label>
              <input className="form-input" type="email" value={f.managerEmail} onChange={function(e){set("managerEmail",e.target.value);}} placeholder="prenom.nom@orpi.com"/>
            </div>
            <div className="form-group" style={{gridColumn:"1/-1"}}>
              <label className="form-label">{"Mot de passe temporaire"}</label>
              <div style={{display:"flex",gap:8}}>
                <input className="form-input" value={f.managerPwd} onChange={function(e){set("managerPwd",e.target.value);}} style={{flex:1}}/>
                <button type="button" className="btn btn-secondary btn-sm" onClick={function(){set("managerPwd","ORPI"+Math.floor(1000+Math.random()*9000));}}>{"🎲"}</button>
              </div>
            </div>
          </div>

          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>{"Annuler"}</button>
            <button className="btn btn-primary" style={{flex:2,opacity:valid()?1:0.5}} onClick={function(){if(valid())onSave(f);}}>{"🏢 Créer l'agence"}</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── MODE VUE MANAGER D'UNE AGENCE ──────────────────────────────────────────
  if (agenceMode) {
    return (
      <ManagerApp
        agenceIdOverride={agenceMode}
        onRetourGroupe={function(){ setAgenceMode(null); }}
      />
    );
  }

  var navItems = [
    {id:"groupe",   icon:"🌐", label:"Vue Groupe",    shortLabel:"Groupe",   active:tab==="groupe",   onClick:function(){setTab("groupe");setAgenceSelectee(null);}},
    {id:"agences",  icon:"🏢", label:"Par agence",    shortLabel:"Agences",  active:tab==="agences",  onClick:function(){setTab("agences");}},
    {id:"mandats",  icon:"📋", label:"Tous mandats",  shortLabel:"Mandats",  active:tab==="mandats",  onClick:function(){setTab("mandats");}},
    {id:"classement",icon:"🏆",label:"Classement",    shortLabel:"Classe",   active:tab==="classement",onClick:function(){setTab("classement");}},
    {id:"profil",   icon:"👤", label:"Mon profil",    shortLabel:"Profil",   active:tab==="profil",   onClick:function(){setTab("profil");}},
  ];

  var title = tab==="groupe"?"🌐 Vue Groupe":tab==="agences"?(agenceSelectee?"🏢 "+agenceSelectee.nom:"🏢 Par agence"):tab==="mandats"?"📋 Tous mandats":tab==="classement"?"🏆 Classement agences":"👤 Mon profil";

  return (
    <AppShell navItems={navItems} title={title} onLogout={handleLogout} currentUser={currentUser} syncMode={ctx.syncMode} saveMsg={ctx.saveMsg}>

      {/* ─── VUE GROUPE ─── */}
      {tab==="groupe" && (
        <div>
          {/* Header groupe */}
          <div style={{background:"linear-gradient(135deg,#1D3557,#2a4a7a)",borderRadius:14,padding:"18px 20px",marginBottom:16,color:"#fff"}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginBottom:4}}>{"RÉSEAU ORPI DÉCLIC IMMO — SUPER ADMIN"}</div>
            <div style={{fontSize:20,fontWeight:900,marginBottom:8}}>{"Bonjour "+currentUser.nom.split(" ")[0]+" 👋"}</div>
            <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
              {agencesActives.map(function(ag,i){
                return <span key={ag.id} style={{fontSize:12,color:"rgba(255,255,255,0.8)",background:"rgba(255,255,255,0.1)",borderRadius:20,padding:"2px 10px"}}>{"📍 "+ag.ville}</span>;
              })}
            </div>
          </div>

          {/* Sélecteur période */}
          <div style={{display:"flex",gap:6,marginBottom:14}}>
            {[["mois","Ce mois"],["trim","Ce trimestre"],["annee","Cette année"],["tout","Tout"]].map(function(p){
              return <button key={p[0]} onClick={function(){setPeriode(p[0]);}} style={{padding:"5px 14px",borderRadius:20,border:"2px solid "+(periode===p[0]?"var(--navy)":"var(--g200)"),background:periode===p[0]?"var(--navy)":"#fff",color:periode===p[0]?"#fff":"var(--g400)",fontWeight:700,fontSize:12,cursor:"pointer"}}>{p[1]}</button>;
            })}
          </div>

          {/* KPIs consolidés */}
          <div style={{marginBottom:6,fontSize:11,color:"var(--g400)",fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>{"📊 Consolidé réseau"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            <KpiCard label="CA Stock total" value={fmt(consolide.caStock)} color="var(--purple)" icon="📦" sub={consolide.nbMandats+" mandats actifs"}/>
            <KpiCard label="CA Signé total" value={fmt(consolide.caSigne)} color="var(--amber)" icon="✍️" sub={consolide.nbCompromis+" compromis"}/>
            <KpiCard label={"CA Période"} value={fmt(consolide.caP)} color="var(--green)" icon="💰" sub={statsParAgence.reduce(function(s,a){return s+a.vendusP.length;},0)+" ventes"}/>
            <KpiCard label="Gestion locative" value={fmt(consolide.caGestion)+"/mois"} color="var(--navy)" icon="🔑" sub={"Réseau complet"}/>
          </div>

          {/* Carte des agences miniature */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:8}}>
            <div style={{background:"var(--g50)",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,marginBottom:4}}>{"👥 Total collaborateurs"}</div>
              <div style={{fontSize:22,fontWeight:900,color:"var(--navy)"}}>{consolide.nbAgents}</div>
            </div>
            <div style={{background:consolide.nbExpirants>0?"#FEF3C7":"var(--g50)",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,marginBottom:4}}>{"⏳ Mandats expirant <30j"}</div>
              <div style={{fontSize:22,fontWeight:900,color:consolide.nbExpirants>0?"var(--amber)":"var(--navy)"}}>{consolide.nbExpirants}</div>
            </div>
          </div>

          {/* Cartes par agence */}
          <div style={{marginBottom:6,fontSize:11,color:"var(--g400)",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginTop:16}}>{"🏢 Par agence"}</div>
          {statsParAgence.map(function(s, i) {
            var col = AGENCE_COLORS[i % AGENCE_COLORS.length];
            var pctTotal = consolide.caP > 0 ? Math.round(s.caP/consolide.caP*100) : 0;
            return (
              <div key={s.agence.id} onClick={function(){setAgenceMode(s.agence.id);}} style={{background:"#fff",borderRadius:12,border:"2px solid var(--g200)",borderLeft:"5px solid "+col,padding:"14px 16px",marginBottom:10,cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <div style={{fontWeight:900,color:"var(--navy)",fontSize:15}}>{s.agence.nom}</div>
                    <div style={{fontSize:11,color:"var(--g400)",marginTop:2}}>{"📍 "+s.agence.ville+" · "+s.agents.length+" agent"+(s.agents.length>1?"s":"")+(s.managers.length?" · "+s.managers.length+" manager"+(s.managers.length>1?"s":""):"")}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:900,fontSize:18,color:col}}>{fmt(s.caP)}</div>
                    <div style={{fontSize:11,color:"var(--g400)"}}>{pctTotal+"% du réseau"}</div>
                  </div>
                </div>
                {/* Barre de progression */}
                <div style={{height:6,background:"var(--g100)",borderRadius:3,marginBottom:10,overflow:"hidden"}}>
                  <div style={{height:"100%",width:pctTotal+"%",background:col,borderRadius:3,transition:"width 0.5s"}}></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                  {[
                    {label:"Mandats",val:s.nbMandats,color:"var(--navy)"},
                    {label:"Compromis",val:s.nbCompromis,color:"var(--amber)"},
                    {label:"Vendus",val:s.nbVendus,color:"var(--green)"},
                    {label:"Gestion",val:s.nbGestion,color:"var(--purple)"},
                  ].map(function(k){
                    return (
                      <div key={k.label} style={{background:"var(--g50)",borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
                        <div style={{fontWeight:900,fontSize:16,color:k.color}}>{k.val}</div>
                        <div style={{fontSize:9,color:"var(--g400)",fontWeight:700}}>{k.label}</div>
                      </div>
                    );
                  })}
                </div>
                {s.expirants.length > 0 && (
                  <div style={{marginTop:8,background:"#FEF3C7",borderRadius:8,padding:"5px 10px",fontSize:11,color:"#92400E",fontWeight:700}}>
                    {"⚠️ "+s.expirants.length+" mandat"+(s.expirants.length>1?"s":"")+" expirant bientôt"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── PAR AGENCE ─── */}
      {tab==="agences" && (
        <div>
          {createMsg && <div style={{background:"#F0FDF4",border:"1px solid #A7F3D0",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#065F46",fontWeight:600}}>{createMsg}</div>}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontSize:13,color:"var(--g400)"}}>{"Sélectionnez une agence pour accéder à son espace manager complet."}</span>
            <button className="btn btn-primary btn-sm" onClick={function(){setShowCreateAgence(true);}}>{"+ Nouvelle agence"}</button>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            {agencesActives.map(function(ag, i){
              var col = AGENCE_COLORS[i%AGENCE_COLORS.length];
              return (
                <button key={ag.id} onClick={function(){setAgenceMode(ag.id);}} style={{padding:"10px 20px",borderRadius:12,border:"2px solid "+col,background:col+"18",color:col,fontWeight:800,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
                  {"🏢 "+ag.nom+" →"}
                </button>
              );
            })}
          </div>
          <div style={{background:"var(--g50)",borderRadius:12,padding:"14px",fontSize:12,color:"var(--g500)"}}>{"Vous accéderez à l'interface manager complète de l'agence, avec tous les onglets (mandats, agents, classement, etc.). Utilisez le bouton ← Vue groupe pour revenir ici."}</div>

        </div>
      )}

      {/* ─── TOUS MANDATS ─── */}
      {tab==="mandats" && (
        <div>
          <div style={{marginBottom:12,fontSize:12,color:"var(--g400)"}}>{"Tous les mandats de toutes les agences · "+mandats.length+" au total"}</div>
          {agencesActives.map(function(ag, i) {
            var col = AGENCE_COLORS[i%AGENCE_COLORS.length];
            var agM = mandats.filter(function(m){return m.agenceId===ag.id && m.statut==="mandat";});
            if (agM.length===0) return null;
            return (
              <div key={ag.id} style={{marginBottom:20}}>
                <div style={{fontWeight:800,color:col,fontSize:14,marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:10,height:10,borderRadius:5,background:col}}></div>
                  {ag.nom+" — "+agM.length+" mandat"+(agM.length>1?"s":"")}
                </div>
                {agM.map(function(m) {
                  var ag2 = users.find(function(u){return u.id===m.agentId;});
                  return (
                    <div key={m.id} style={{background:"#fff",borderRadius:10,border:"1px solid var(--g200)",borderLeft:"4px solid "+col,padding:"10px 14px",marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <div>
                          <div style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{m.ref+" · "+(m.typeBien||"bien")}</div>
                          <div style={{fontSize:12,color:"var(--g500)",marginTop:2}}>{m.adresse}</div>
                          {ag2 && <div style={{fontSize:11,color:"var(--g400)",marginTop:1}}>{"Agent : "+ag2.nom}</div>}
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontWeight:900,color:"var(--green)",fontSize:14}}>{fmt(m.prix)}</div>
                          <div style={{fontSize:11,color:"var(--g400)"}}>{fmt(m.commission)+" comm."}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── CLASSEMENT AGENCES ─── */}
      {tab==="classement" && (
        <div>
          <div style={{marginBottom:6,fontSize:11,color:"var(--g400)",fontWeight:700,textTransform:"uppercase"}}>{"Sélecteur période"}</div>
          <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
            {[["mois","Ce mois"],["trim","Ce trimestre"],["annee","Cette année"],["tout","Tout"]].map(function(p){
              return <button key={p[0]} onClick={function(){setPeriode(p[0]);}} style={{padding:"5px 14px",borderRadius:20,border:"2px solid "+(periode===p[0]?"var(--navy)":"var(--g200)"),background:periode===p[0]?"var(--navy)":"#fff",color:periode===p[0]?"#fff":"var(--g400)",fontWeight:700,fontSize:12,cursor:"pointer"}}>{p[1]}</button>;
            })}
          </div>

          {/* Podium */}
          <div style={{background:"linear-gradient(135deg,#1D3557,#2a4a7a)",borderRadius:14,padding:"16px",marginBottom:16}}>
            <div style={{color:"rgba(255,255,255,0.6)",fontSize:11,fontWeight:700,textTransform:"uppercase",marginBottom:12}}>{"🏆 Classement CA période"}</div>
            {[...statsParAgence].sort(function(a,b){return b.caP-a.caP;}).map(function(s,i){
              var medals = ["🥇","🥈","🥉"];
              var col = AGENCE_COLORS[agencesActives.findIndex(function(a){return a.id===s.agence.id;})%AGENCE_COLORS.length];
              var pct = consolide.caP > 0 ? Math.round(s.caP/consolide.caP*100) : 0;
              return (
                <div key={s.agence.id} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:18}}>{medals[i]||"  "}</span>
                      <span style={{color:"#fff",fontWeight:800,fontSize:14}}>{s.agence.ville}</span>
                      <span style={{color:"rgba(255,255,255,0.5)",fontSize:11}}>{s.vendusP.length+" vente"+(s.vendusP.length>1?"s":"")}</span>
                    </div>
                    <span style={{color:col,fontWeight:900,fontSize:16}}>{fmt(s.caP)}</span>
                  </div>
                  <div style={{height:8,background:"rgba(255,255,255,0.1)",borderRadius:4,overflow:"hidden"}}>
                    <div style={{height:"100%",width:pct+"%",background:col,borderRadius:4,transition:"width 0.5s"}}></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tableau comparatif */}
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden"}}>
            <div style={{background:"var(--g50)",padding:"10px 14px",borderBottom:"1px solid var(--g100)"}}>
              <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"📊 Comparatif détaillé"}</span>
            </div>
            {statsParAgence.map(function(s, i) {
              var col = AGENCE_COLORS[i%AGENCE_COLORS.length];
              return (
                <div key={s.agence.id} style={{padding:"12px 14px",borderBottom:"1px solid var(--g50)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:12,height:12,borderRadius:6,background:col,flexShrink:0}}></div>
                      <span style={{fontWeight:800,color:"var(--navy)",fontSize:14}}>{s.agence.nom}</span>
                    </div>
                    <span style={{fontSize:11,color:"var(--g400)"}}>{s.agents.length+" agents"}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                    {[
                      ["CA stock",fmt(s.caStock),"var(--purple)"],
                      ["CA signé",fmt(s.caSigne),"var(--amber)"],
                      ["CA réalisé",fmt(s.caRealise),"var(--green)"],
                      ["Mandats",s.nbMandats,"var(--navy)"],
                      ["Exclu. "+s.txExclusif+"%","",""],
                      ["Délai moy.",s.delaiMoyen?s.delaiMoyen+"j":"—","var(--g400)"],
                    ].filter(function(r){return r[0];}).map(function(r){
                      return (
                        <div key={r[0]} style={{background:"var(--g50)",borderRadius:8,padding:"6px 10px"}}>
                          <div style={{fontSize:9,color:"var(--g400)",fontWeight:700}}>{r[0]}</div>
                          <div style={{fontSize:13,fontWeight:800,color:r[2]||"var(--navy)"}}>{r[1]||s.txExclusif+"%"}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── PROFIL SUPER ADMIN ─── */}
      {tab==="profil" && <ProfilSuperAdmin currentUser={currentUser} users={users} changerMotDePasse={changerMotDePasse}/>}

    </AppShell>
  );
}

// ─── CARTE MULTI-AGENCES ──────────────────────────────────────────────────────
function CarteGroupe({ agences, mandats, locations, offmarket, users }) {
  var mapRef  = useRef(null);
  var mapObj  = useRef(null);
  var [ready, setReady] = useState(false);

  var COORDS = {"agence-1":[49.894,2.296],"agence-2":[50.152,2.341],"agence-3":[49.877,2.514]};

  useEffect(function() {
    if (!mapRef.current || mapObj.current) return;
    function init() {
      if (!window.L || !mapRef.current) return;
      var L = window.L;
      var map = L.map(mapRef.current).setView([49.98, 2.38], 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap",maxZoom:19}).addTo(map);

      // Marqueurs agences
      agences.forEach(function(ag, i) {
        var c = COORDS[ag.id] || [49.894,2.296];
        var col = AGENCE_COLORS[i%AGENCE_COLORS.length];
        var icon = L.divIcon({
          className:"",
          html:'<div style="background:'+col+';color:#fff;border:3px solid #fff;border-radius:12px;padding:4px 10px;font-weight:900;font-size:12px;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.3);">🏢 '+ag.ville+'</div>',
          iconAnchor:[0,0]
        });
        L.marker(c, {icon}).addTo(map).bindTooltip(ag.nom+" · "+mandats.filter(function(m){return m.agenceId===ag.id&&m.statut==="mandat";}).length+" mandats actifs",{direction:"top"});
      });

      // Mandats (quelques-uns par agence avec coords approchées)
      mandats.filter(function(m){return m.statut==="mandat";}).forEach(function(m) {
        var agIdx = agences.findIndex(function(a){return a.id===m.agenceId;});
        var base = COORDS[m.agenceId] || [49.894,2.296];
        var lat = base[0] + (Math.random()-0.5)*0.03;
        var lng = base[1] + (Math.random()-0.5)*0.05;
        var col = AGENCE_COLORS[agIdx%AGENCE_COLORS.length];
        var icon = L.divIcon({
          className:"",
          html:'<div style="width:18px;height:18px;background:'+col+';border:2px solid #fff;border-radius:9px;box-shadow:0 2px 6px rgba(0,0,0,0.3);" title="'+m.ref+'"></div>',
          iconSize:[18,18],iconAnchor:[9,9]
        });
        L.marker([lat,lng],{icon}).addTo(map).bindTooltip(m.ref+" — "+m.adresse.split(",")[0]+"<br>"+m.prix.toLocaleString("fr-FR")+"€",{direction:"top"});
      });

      mapObj.current = map;
      setReady(true);
    }
    if (window.L) { init(); return; }
    if (!document.querySelector('link[href*="leaflet"]')) {
      var l=document.createElement("link");l.rel="stylesheet";l.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(l);
    }
    var s=document.createElement("script");s.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";s.onload=init;document.head.appendChild(s);
  }, []);

  return (
    <div>
      <div style={{marginBottom:10,display:"flex",gap:8,flexWrap:"wrap"}}>
        {agences.map(function(ag,i){
          return <span key={ag.id} style={{background:AGENCE_COLORS[i%AGENCE_COLORS.length]+"22",color:AGENCE_COLORS[i%AGENCE_COLORS.length],borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:800}}>{"🏢 "+ag.ville}</span>;
        })}
      </div>
      <div style={{borderRadius:12,overflow:"hidden",border:"1px solid var(--g200)",position:"relative"}}>
        <div ref={mapRef} className="carte-map-container"/>
        {!ready && (
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#F0F4F8"}}>
            <div style={{fontSize:13,color:"var(--g400)"}}>{"🗺️ Chargement de la carte…"}</div>
          </div>
        )}
      </div>
      <div style={{marginTop:8,fontSize:11,color:"var(--g400)",textAlign:"center"}}>{"Les gros badges = agences · Les petits points = mandats actifs"}</div>
    </div>
  );
}

// ─── PROFIL SUPER ADMIN ───────────────────────────────────────────────────────
function ProfilSuperAdmin({ currentUser, users, changerMotDePasse }) {
  var [ancien,  setAncien]  = useState("");
  var [nouveau, setNouveau] = useState("");
  var [confirm, setConfirm] = useState("");
  var [msg,     setMsg]     = useState(null);

  function sauvegarder() {
    var userReel = (users||[]).find(function(u){return u.id===currentUser.id;}) || currentUser;
    if (!ancien)                         { setMsg({type:"err",text:"Saisissez votre mot de passe actuel"}); return; }
    if (ancien !== userReel.password)    { setMsg({type:"err",text:"Mot de passe actuel incorrect"}); return; }
    if (nouveau.length < 4)             { setMsg({type:"err",text:"Le nouveau mot de passe doit faire au moins 4 caractères"}); return; }
    if (nouveau !== confirm)             { setMsg({type:"err",text:"Les mots de passe ne correspondent pas"}); return; }
    changerMotDePasse(currentUser.id, nouveau);
    setMsg({type:"ok",text:"✅ Mot de passe modifié !"});
    setAncien(""); setNouveau(""); setConfirm("");
  }

  return (
    <div>
      <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",padding:20,marginBottom:16,display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:56,height:56,borderRadius:28,background:"#1D3557",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:20}}>
          {currentUser.avatar}
        </div>
        <div>
          <div style={{fontWeight:900,fontSize:17,color:"var(--navy)"}}>{currentUser.nom}</div>
          <div style={{fontSize:13,color:"var(--g400)",marginTop:2}}>{currentUser.email}</div>
          <div style={{fontSize:11,marginTop:4,background:"#FEF3C7",borderRadius:20,padding:"2px 10px",display:"inline-block",color:"#92400E",fontWeight:700}}>{"⭐ Super Admin"}</div>
        </div>
      </div>
      <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",padding:20}}>
        <div style={{fontWeight:800,color:"var(--navy)",fontSize:14,marginBottom:16}}>{"🔑 Changer mon mot de passe"}</div>
        {msg && <div style={{background:msg.type==="ok"?"#F0FDF4":"#FEF2F2",border:"1px solid "+(msg.type==="ok"?"#A7F3D0":"#FECACA"),borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,color:msg.type==="ok"?"#065F46":"#DC2626",fontWeight:600}}>{msg.text}</div>}
        <div className="form-group" style={{marginBottom:12}}><label className="form-label">{"Mot de passe actuel"}</label><input type="password" className="form-input" value={ancien} onChange={function(e){setAncien(e.target.value);setMsg(null);}}/></div>
        <div className="form-group" style={{marginBottom:12}}><label className="form-label">{"Nouveau mot de passe"}</label><input type="password" className="form-input" value={nouveau} onChange={function(e){setNouveau(e.target.value);setMsg(null);}}/></div>
        <div className="form-group" style={{marginBottom:16}}><label className="form-label">{"Confirmer"}</label><input type="password" className="form-input" value={confirm} onChange={function(e){setConfirm(e.target.value);setMsg(null);}}/></div>
        <button className="btn btn-primary" style={{width:"100%"}} onClick={sauvegarder}>{"💾 Enregistrer"}</button>
      </div>
    </div>
  );
}
