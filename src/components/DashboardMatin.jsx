import { useState } from "react";
import { useApp } from "../App";
import { fmt, fmtDate } from "./Shared";

export default function DashboardMatin({ onNavigate }) {
  var ctx      = useApp();
  var agenceId = ctx.currentUser.agenceId;
  var users    = ctx.users || [];
  var mandats  = (ctx.mandats||[]).filter(function(m){ return m.agenceId===agenceId; });
  var gestion  = (ctx.gestion||[]).filter(function(g){ return g.agenceId===agenceId && g.actif; });
  var offmarket= (ctx.offmarket||[]).filter(function(o){ return o.agenceId===agenceId && o.actif; });
  var recherches=(ctx.recherches||[]).filter(function(r){ return r.agenceId===agenceId && r.statut==="active"; });
  var tasks    = (ctx.tasks||[]).filter(function(t){ return t.agenceId===agenceId && t.statut!=="terminee"; });
  var today    = new Date();
  var todayStr = today.toISOString().slice(0,10);

  function diffDays(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  }

  // ─── ALERTES MANDATS ─────────────────────────────────────────────────────────
  var mandatsActifs = mandats.filter(function(m){ return m.statut==="mandat"; });
  var expirantBientot = mandatsActifs.filter(function(m){
    var j = diffDays(todayStr, m.dateExpiration);
    return m.dateExpiration && j >= 0 && j <= 30;
  }).sort(function(a,b){ return new Date(a.dateExpiration)-new Date(b.dateExpiration); });

  var expiresAujourd = mandatsActifs.filter(function(m){
    return m.dateExpiration && m.dateExpiration === todayStr;
  });

  // Mandats anciens (> 90 jours sans compromis)
  var mandatsAnciens = mandatsActifs.filter(function(m){
    return m.dateMandat && diffDays(m.dateMandat, todayStr) > 90;
  });

  // Délai moyen mandat → vente
  var vendus = mandats.filter(function(m){ return m.statut==="vendu" && m.dateMandat && m.dateSignature; });
  var delaiMoyen = vendus.length > 0
    ? Math.round(vendus.reduce(function(s,m){ return s + diffDays(m.dateMandat, m.dateSignature); }, 0) / vendus.length)
    : null;

  // ─── LOYERS IMPAYÉS ──────────────────────────────────────────────────────────
  var moisActuel = today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0");
  var impayes = gestion.filter(function(g){
    var loyers = g.loyers || [];
    var lMois  = loyers.find(function(l){ return l.mois===moisActuel; });
    return !lMois || lMois.statut !== "paye";
  });

  // ─── OFF MARKET SANS RELANCE ─────────────────────────────────────────────────
  var offSansRelance = offmarket.filter(function(o){
    var jours = Math.round((today - new Date(o.dateContact||today)) / 86400000);
    return jours > 60;
  });

  // ─── SIGNATURES CETTE SEMAINE ────────────────────────────────────────────────
  var sigCetteSemaine = mandats.filter(function(m){
    if (!m.dateSignature) return false;
    var j = diffDays(todayStr, m.dateSignature);
    return j >= 0 && j <= 7;
  }).sort(function(a,b){ return new Date(a.dateSignature)-new Date(b.dateSignature); });

  // ─── TÂCHES DU JOUR ──────────────────────────────────────────────────────────
  var tachesJour = tasks.filter(function(t){
    return t.echeance && t.echeance <= todayStr;
  }).sort(function(a,b){ return a.echeance.localeCompare(b.echeance); });

  // ─── STOCK 8 SEMAINES (pour courbe) ─────────────────────────────────────────
  var stockActuel = mandatsActifs.length;
  var stockParSemaine = [];
  for (var wi = 7; wi >= 0; wi--) {
    var dateRef = new Date(today - wi*7*86400000).toISOString().slice(0,10);
    var nb = mandats.filter(function(m) {
      var debut  = m.dateMandat && m.dateMandat <= dateRef;
      var encoreActif = m.statut === "mandat" || (m.dateCompromis && m.dateCompromis > dateRef) || (m.dateSignature && m.dateSignature > dateRef);
      return debut && encoreActif;
    }).length;
    var label = wi === 0 ? "Auj." : (wi === 1 ? "S-1" : "S-"+wi);
    stockParSemaine.push({ label, nb, dateRef });
  }
  var il7j = new Date(today - 7*86400000).toISOString().slice(0,10);
  var stockIl7j = stockParSemaine[stockParSemaine.length - 2].nb;
  var tendance = stockActuel - stockIl7j;

  // ─── RENDU ───────────────────────────────────────────────────────────────────
  var heure = today.getHours();
  var salut = heure < 12 ? "Bonjour" : heure < 18 ? "Bon après-midi" : "Bonsoir";
  var totalAlertes = expirantBientot.length + impayes.length + offSansRelance.length + tachesJour.length;

  return (
    <div>
      {/* Header salutation */}
      <div style={{background:"linear-gradient(135deg,#1D3557,#2a4a7a)",borderRadius:14,padding:"18px 20px",marginBottom:16,color:"#fff"}}>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.65)",marginBottom:4}}>
          {today.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
        </div>
        <div style={{fontSize:20,fontWeight:900,marginBottom:6}}>
          {salut+" "+ctx.currentUser.nom.split(" ")[0]+" 👋"}
        </div>
        <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.75)"}}>{"📦 "+stockActuel+" mandats actifs"+(tendance!==0?" ("+( tendance>0?"+"+(tendance):tendance)+" vs semaine dernière)":"")}</div>
          {delaiMoyen && <div style={{fontSize:12,color:"rgba(255,255,255,0.75)"}}>{"⏱ Délai moyen vente : "+delaiMoyen+" jours"}</div>}
        </div>
        {/* Courbe stock 8 semaines */}
        {(function(){
          var vals = stockParSemaine.map(function(s){return s.nb;});
          var maxV = Math.max.apply(null, vals) || 1;
          var minV = Math.min.apply(null, vals);
          var W = 280; var H = 56; var pad = 4;
          var pts = vals.map(function(v, i){
            var x = pad + i * (W - pad*2) / (vals.length-1);
            var y = H - pad - (v - minV) / (maxV - minV || 1) * (H - pad*2);
            return [x, y];
          });
          var d = pts.map(function(p,i){ return (i===0?"M":"L")+p[0].toFixed(1)+","+p[1].toFixed(1); }).join(" ");
          var areaD = d + " L"+pts[pts.length-1][0].toFixed(1)+","+(H-pad)+" L"+pts[0][0].toFixed(1)+","+(H-pad)+" Z";
          return (
            <div style={{marginTop:12}}>
              <svg viewBox={"0 0 "+W+" "+H} style={{width:"100%",height:H,display:"block"}}>
                <defs>
                  <linearGradient id="sgrd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.3)"/>
                    <stop offset="100%" stopColor="rgba(255,255,255,0.02)"/>
                  </linearGradient>
                </defs>
                <path d={areaD} fill="url(#sgrd)"/>
                <path d={d} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinejoin="round"/>
                {pts.map(function(p, i){
                  return <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#fff" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/>;
                })}
                {stockParSemaine.map(function(s, i){
                  var x = pad + i * (W - pad*2) / (vals.length-1);
                  return <text key={i} x={x} y={H} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.5)">{s.label}</text>;
                })}
              </svg>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",textAlign:"center",marginTop:2}}>{"Évolution du stock sur 8 semaines"}</div>
            </div>
          );
        })()}
      </div>

      {/* Score alertes */}
      {totalAlertes > 0 && (
        <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,padding:"10px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>{"🚨"}</span>
          <span style={{fontWeight:800,color:"#991B1B",fontSize:14}}>{totalAlertes+" action"+(totalAlertes>1?"s":""+" à traiter aujourd'hui")}</span>
        </div>
      )}

      {/* ─── MANDATS EXPIRANT ─── */}
      {expirantBientot.length > 0 && (
        <Section icon="⏳" title={"Mandats expirant dans moins de 30 jours ("+expirantBientot.length+")"} color="#D97706" bg="#FFFBEB">
          {expirantBientot.map(function(m) {
            var agent = users.find(function(u){ return u.id===m.agentId; });
            var j = diffDays(todayStr, m.dateExpiration);
            return (
              <div key={m.id} style={{padding:"10px 0",borderBottom:"1px solid #FDE68A",display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{m.ref+" — "+m.adresse.split(",")[0]}</div>
                  <div style={{fontSize:11,color:"var(--g500)",marginTop:2}}>{fmt(m.prix)+(agent?" · "+agent.nom:"")}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontWeight:900,fontSize:14,color:j<=7?"#EF4444":"#D97706"}}>{"J-"+j}</div>
                  <div style={{fontSize:10,color:"var(--g400)"}}>{fmtDate(m.dateExpiration)}</div>
                </div>
                {agent && agent.telephone && (
                  <a href={"tel:"+agent.telephone.replace(/\s/g,"")} style={{background:"#059669",color:"#fff",borderRadius:8,padding:"6px 10px",fontSize:11,fontWeight:800,textDecoration:"none",flexShrink:0}}>{"📞"}</a>
                )}
                <button onClick={function(){if(onNavigate)onNavigate("mandats");}} style={{background:"var(--navy)",color:"#fff",border:"none",borderRadius:8,padding:"6px 10px",fontSize:11,fontWeight:800,cursor:"pointer",flexShrink:0}}>{"Voir"}</button>
              </div>
            );
          })}
        </Section>
      )}
      {/* ─── SIGNATURES CETTE SEMAINE ─── */}
      {sigCetteSemaine.length > 0 && (
        <Section icon="🎉" title={"Signatures cette semaine ("+sigCetteSemaine.length+")"} color="#059669" bg="#F0FDF4">
          {sigCetteSemaine.map(function(m) {
            var agent = users.find(function(u){ return u.id===m.agentId; });
            var j = diffDays(todayStr, m.dateSignature);
            return (
              <div key={m.id} style={{padding:"10px 0",borderBottom:"1px solid #A7F3D0",display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:"var(--navy)",fontSize:13}}>{m.ref+" — "+m.adresse.split(",")[0]}</div>
                  <div style={{fontSize:11,color:"var(--g500)",marginTop:2}}>{fmt(m.commission)+(agent?" · "+agent.nom:"")}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontWeight:900,fontSize:13,color:"#059669"}}>{"J-"+j}</div>
                  <div style={{fontSize:10,color:"var(--g400)"}}>{fmtDate(m.dateSignature)}</div>
                </div>
              </div>
            );
          })}
        </Section>
      )}

      {/* ─── OFF MARKET SANS RELANCE ─── */}
      {offSansRelance.length > 0 && (
        <Section icon="🔒" title={"Off market sans relance depuis 60j ("+offSansRelance.length+")"} color="#7C3AED" bg="#F5F3FF">
          {offSansRelance.map(function(o) {
            return (
              <div key={o.id} style={{padding:"10px 0",borderBottom:"1px solid #DDD6FE",display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:"var(--navy)",fontSize:13}}>{o.ref+" — "+o.adresse.split(",")[0]}</div>
                  <div style={{fontSize:11,color:"var(--g500)",marginTop:2}}>{o.proprietairePrenom+" "+o.proprietaireNom+" · "+fmt(o.prix)}</div>
                </div>
                {o.proprietaireTel && (
                  <a href={"tel:"+o.proprietaireTel.replace(/\s/g,"")} style={{background:"#7C3AED",color:"#fff",borderRadius:8,padding:"6px 10px",fontSize:11,fontWeight:800,textDecoration:"none",flexShrink:0}}>{"📞"}</a>
                )}
                <button onClick={function(){if(onNavigate)onNavigate("offmarket");}} style={{background:"var(--navy)",color:"#fff",border:"none",borderRadius:8,padding:"6px 10px",fontSize:11,fontWeight:800,cursor:"pointer",flexShrink:0}}>{"Voir"}</button>
              </div>
            );
          })}
        </Section>
      )}

      {/* ─── TÂCHES EN RETARD ─── */}
      {tachesJour.length > 0 && (
        <Section icon="✅" title={"Tâches à traiter ("+tachesJour.length+")"} color="#2563EB" bg="#EFF6FF">
          {tachesJour.map(function(t) {
            var agent = users.find(function(u){ return u.id===t.agentId; });
            var enRetard = t.echeance < todayStr;
            return (
              <div key={t.id} style={{padding:"10px 0",borderBottom:"1px solid #BFDBFE",display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:"var(--navy)",fontSize:13}}>{t.titre}</div>
                  <div style={{fontSize:11,color:"var(--g500)",marginTop:2}}>{(agent?agent.nom+" · ":"")+(enRetard?"⚠️ En retard":"📅 Aujourd'hui")}</div>
                </div>
                <button onClick={function(){if(onNavigate)onNavigate("taches");}} style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:8,padding:"6px 10px",fontSize:11,fontWeight:800,cursor:"pointer",flexShrink:0}}>{"Traiter"}</button>
              </div>
            );
          })}
        </Section>
      )}

      {/* ─── MANDATS ANCIENS ─── */}
      {mandatsAnciens.length > 0 && (
        <Section icon="📆" title={"Mandats > 90 jours sans compromis ("+mandatsAnciens.length+")"} color="#EA580C" bg="#FFF7ED">
          {mandatsAnciens.slice(0,5).map(function(m) {
            var agent = users.find(function(u){ return u.id===m.agentId; });
            var age   = diffDays(m.dateMandat, todayStr);
            return (
              <div key={m.id} style={{padding:"10px 0",borderBottom:"1px solid #FED7AA",display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:"var(--navy)",fontSize:13}}>{m.ref+" — "+m.adresse.split(",")[0]}</div>
                  <div style={{fontSize:11,color:"var(--g500)",marginTop:2}}>{fmt(m.prix)+(agent?" · "+agent.nom:"")+" · "+age+" jours"}</div>
                </div>
                <button onClick={function(){if(onNavigate)onNavigate("mandats");}} style={{background:"#EA580C",color:"#fff",border:"none",borderRadius:8,padding:"6px 10px",fontSize:11,fontWeight:800,cursor:"pointer",flexShrink:0}}>{"Voir"}</button>
              </div>
            );
          })}
        </Section>
      )}

      {/* ─── TOUT OK ─── */}
      {totalAlertes===0 && expirantBientot.length===0 && mandatsAnciens.length===0 && sigCetteSemaine.length===0 && (
        <div style={{textAlign:"center",padding:"40px 20px",color:"var(--g400)"}}>
          <div style={{fontSize:48,marginBottom:12}}>{"✨"}</div>
          <div style={{fontWeight:800,fontSize:16,color:"var(--navy)",marginBottom:6}}>{"Tout est sous contrôle !"}</div>
          <div style={{fontSize:13}}>{"Aucune alerte pour aujourd'hui. Bonne journée !"}</div>
        </div>
      )}
    </div>
  );
}

function Section({ icon, title, color, bg, children }) {
  var [open, setOpen] = useState(true);
  return (
    <div style={{background:bg||"#fff",borderRadius:12,border:"1px solid "+color+"33",overflow:"hidden",marginBottom:12}}>
      <div onClick={function(){setOpen(function(p){return !p;});}} style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:8,cursor:"pointer",background:color+"11"}}>
        <span style={{fontSize:16}}>{icon}</span>
        <span style={{fontWeight:800,color:color,fontSize:13,flex:1}}>{title}</span>
        <span style={{color:color,fontWeight:700,fontSize:14}}>{open?"▲":"▼"}</span>
      </div>
      {open && <div style={{padding:"0 14px"}}>{children}</div>}
    </div>
  );
}