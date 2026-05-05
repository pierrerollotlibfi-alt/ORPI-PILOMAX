import { useState, useMemo } from "react";
import { useApp } from "../App";
import { Modal, fmt, fmtDate, avatarColor } from "./Shared";

// ─── SCORE MATCHING (simplifié pour la vue manager) ───────────────────────────
function score(recherche, bien, isOm) {
  var pts = 0;
  var raisons = [];
  var budgetMax = recherche.budgetMax || 0;
  var prix = bien.prix || bien.loyer || 0;
  if (!prix || !budgetMax) return null;

  if (prix <= budgetMax * 1.05) { pts += 40; raisons.push("✅ Budget OK"); }
  else if (prix <= budgetMax * 1.15) { pts += 20; raisons.push("⚠️ Budget limite"); }
  else return null;

  var adr = (bien.adresse||"").toLowerCase();
  if ((recherche.secteurs||[]).some(function(s){ return adr.includes(s.toLowerCase()); })) {
    pts += 25; raisons.push("✅ Secteur OK");
  }
  if (bien.surface && recherche.surfaceMin && bien.surface >= recherche.surfaceMin*0.9) {
    pts += 10; raisons.push("✅ Surface OK ("+bien.surface+"m²)");
  }
  if (recherche.nbPieces && bien.nbPieces && Number(bien.nbPieces) >= Number(recherche.nbPieces)) {
    pts += 10; raisons.push("✅ Pièces OK");
  }
  if (isOm) {
    if (bien.motivation==="Fort")  { pts += 15; raisons.push("🔥 Vendeur très motivé"); }
    if (bien.motivation==="Moyen") { pts += 7;  raisons.push("⏳ Vendeur motivé"); }
  } else if (bien.typeMandat==="exclusif") {
    pts += 5; raisons.push("⭐ Exclusif");
  }
  return pts >= 30 ? { score:Math.min(pts,100), raisons } : null;
}

export default function MatchingManager() {
  var ctx      = useApp();
  var agenceId = ctx.currentUser.agenceId;
  var users    = ctx.users || [];
  var mandats  = ctx.mandats || [];
  var locations= ctx.locations || [];
  var recherches = ctx.recherches || [];
  var offmarket  = ctx.offmarket || [];
  var leads      = ctx.leads || [];

  var [filtreSeuil, setFiltreSeuil] = useState(40);
  var [filtreType,  setFiltreType]  = useState("all"); // all | mandats | locations | offmarket | leads
  var [selMatch,    setSelMatch]    = useState(null);
  var [msgEnvoye,   setMsgEnvoye]   = useState(null);

  var agents = users.filter(function(u){ return u.agenceId===agenceId && u.actif && (u.role==="agent"||u.role==="manager"); });

  function nomAgent(id) {
    var u = users.find(function(u){ return u.id===id; });
    return u ? u.nom : "—";
  }

  // ─── CALCUL TOUS LES MATCHES ─────────────────────────────────────────────
  var allMatches = useMemo(function() {
    var results = [];
    var rechActives = recherches.filter(function(r){ return r.agenceId===agenceId && r.statut==="active"; });

    rechActives.forEach(function(r) {
      var tb = r.typeBien||"";
      var isLoc = tb.includes("louer");

      // vs Mandats
      if (!isLoc) {
        mandats.filter(function(m){ return m.statut==="mandat"; }).forEach(function(m) {
          var s = score(r, m, false);
          if (s) results.push({ type:"mandat", recherche:r, bien:m, score:s.score, raisons:s.raisons,
            agentRecherche:r.agentId, agentBien:m.agentId, prixLabel:m.prix?fmt(m.prix):"—", cross:m.agenceId!==agenceId });
        });
      }

      // vs Locations
      if (isLoc) {
        locations.filter(function(l){ return !l.locataireTrouve; }).forEach(function(l) {
          var bienLoc = {...l, prix:l.loyer};
          var s = score(r, bienLoc, false);
          if (s) results.push({ type:"location", recherche:r, bien:l, score:s.score, raisons:s.raisons,
            agentRecherche:r.agentId, agentBien:l.agentId, prixLabel:(l.loyer||0)+"€/mois", cross:false });
        });
      }

      // vs Off market (achat uniquement)
      if (!isLoc) {
        offmarket.filter(function(o){ return o.actif; }).forEach(function(o) {
          var s = score(r, o, true);
          if (s) results.push({ type:"offmarket", recherche:r, bien:o, score:s.score, raisons:s.raisons,
            agentRecherche:r.agentId, agentBien:o.agentId, prixLabel:o.prix?fmt(o.prix):"—", cross:o.agenceId!==agenceId });
        });
      }

      // vs Leads confiés (si lead a un bien associé)
      (leads||[]).filter(function(l){ return l.bienId && l.agenceId===agenceId; }).forEach(function(lead) {
        var bienLead = mandats.find(function(m){ return m.id===lead.bienId; });
        if (!bienLead) return;
        var s = score(r, bienLead, false);
        if (s) results.push({ type:"lead", recherche:r, bien:bienLead, lead, score:s.score, raisons:s.raisons,
          agentRecherche:r.agentId, agentBien:lead.agentId||bienLead.agentId, prixLabel:bienLead.prix?fmt(bienLead.prix):"—", cross:false });
      });
    });

    return results
      .filter(function(r){ return r.score >= filtreSeuil; })
      .filter(function(r){ return filtreType==="all" || r.type===filtreType; })
      .sort(function(a,b){ return b.score-a.score; });
  }, [recherches, mandats, locations, offmarket, leads, filtreSeuil, filtreType]);

  // ─── ENVOYER MESSAGE AUTOMATIQUE aux 2 agents ─────────────────────────────
  function envoyerMessage(match) {
    var agR = users.find(function(u){ return u.id===match.agentRecherche; });
    var agB = users.find(function(u){ return u.id===match.agentBien; });
    if (!agR || !agB) return;

    var typeLabels = {mandat:"mandat",location:"location",offmarket:"bien off market",lead:"lead"};
    var msg = "🎯 RAPPROCHEMENT DÉTECTÉ — Score "+match.score+"%\n\n"
      +"📋 Recherche : "+match.recherche.nom
      +" (budget : "+(match.recherche.budgetMin||0).toLocaleString("fr-FR")+"–"+(match.recherche.budgetMax||0).toLocaleString("fr-FR")
      +(match.recherche.typeBien&&match.recherche.typeBien.includes("louer")?"€/mois":"€")+")\n"
      +"Gérée par : "+agR.nom+"\n\n"
      +"🏠 Bien correspondant : "+(match.bien.ref||match.bien.id)+" — "+match.bien.adresse+"\n"
      +"Prix : "+match.prixLabel+" · Type : "+typeLabels[match.type]+"\n"
      +"Géré par : "+agB.nom+"\n\n"
      +"✅ Points communs : "+match.raisons.join(", ")+"\n\n"
      +"👉 Je vous invite à vous rapprocher pour organiser une visite ensemble !";

    // Injecter dans la messagerie (channel commun)
    var SK_MSG = "orpi_data_messages_v1";
    try {
      var msgs = JSON.parse(localStorage.getItem(SK_MSG)||"[]");
      var newMsg = {
        id:"msg-match-"+Date.now(),
        channelId:"equipe",
        senderId:ctx.currentUser.id,
        senderNom:ctx.currentUser.nom+" (Manager)",
        senderAvatar:"🎯",
        content:msg,
        ts:new Date().toISOString(),
        type:"rapprochement",
        read:[],
        mentionIds:[agR.id, agB.id],
      };
      msgs.push(newMsg);
      localStorage.setItem(SK_MSG, JSON.stringify(msgs));
      setMsgEnvoye(match.recherche.nom+" ↔ "+(match.bien.ref||"Bien"));
      setTimeout(function(){ setMsgEnvoye(null); }, 4000);
    } catch(e) {
      alert("Erreur lors de l'envoi du message");
    }
  }

  var typeColors = { mandat:"#1D3557", location:"#FF9800", offmarket:"#7C3AED", lead:"#2196F3" };
  var typeBgs    = { mandat:"#EFF6FF", location:"#FFF7ED", offmarket:"#F5F3FF", lead:"#EFF6FF" };
  var typeEmoji  = { mandat:"🏠", location:"🔑", offmarket:"🔒", lead:"📥" };

  return (
    <div>
      {/* Message de confirmation */}
      {msgEnvoye && (
        <div style={{background:"#F0FDF4",border:"1px solid #A7F3D0",borderRadius:10,padding:"10px 14px",marginBottom:12,fontWeight:700,color:"#065F46",fontSize:13}}>
          {"✅ Message privé envoyé à : "+msgEnvoye+" (visible dans leur messagerie)"}
        </div>
      )}

      {/* Filtres */}
      <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:"12px 14px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"🎯 Rapprochements détectés"}</span>
          <span style={{background:"var(--g100)",borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:700}}>{allMatches.length+" match"+(allMatches.length>1?"s":"")}</span>
        </div>

        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
          {[["all","Tous"],["mandat","🏠 Mandats"],["location","🔑 Locations"],["offmarket","🔒 Off market"],["lead","📥 Leads"]].map(function(f){
            return <button key={f[0]} onClick={function(){setFiltreType(f[0]);}} style={{padding:"4px 12px",borderRadius:20,border:"2px solid "+(filtreType===f[0]?"var(--navy)":"var(--g200)"),background:filtreType===f[0]?"var(--navy)":"#fff",color:filtreType===f[0]?"#fff":"var(--g500)",fontWeight:700,fontSize:11,cursor:"pointer"}}>{f[1]}</button>;
          })}
        </div>

        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:11,color:"var(--g400)",fontWeight:600,whiteSpace:"nowrap"}}>{"Score min :"}</span>
          <input type="range" min="20" max="80" step="5" value={filtreSeuil} onChange={function(e){setFiltreSeuil(Number(e.target.value));}} style={{flex:1,accentColor:"var(--navy)"}}/>
          <span style={{fontWeight:800,color:"var(--navy)",fontSize:13,minWidth:36}}>{filtreSeuil+"%"}</span>
        </div>
      </div>

      {/* Modal détail match */}
      {selMatch && (
        <Modal title={"🎯 Rapprochement — "+selMatch.score+"%"} onClose={function(){setSelMatch(null);}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            {/* Recherche */}
            <div style={{background:"#EFF6FF",borderRadius:10,padding:"12px"}}>
              <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,textTransform:"uppercase",marginBottom:6}}>{"📋 Recherche"}</div>
              <div style={{fontWeight:800,color:"var(--navy)",fontSize:14,marginBottom:4}}>{selMatch.recherche.nom}</div>
              <div style={{fontSize:11,color:"var(--g600)"}}>{(selMatch.recherche.budgetMin||0).toLocaleString("fr-FR")+"€ — "+(selMatch.recherche.budgetMax||0).toLocaleString("fr-FR")+"€"}</div>
              {selMatch.recherche.surfaceMin && <div style={{fontSize:11,color:"var(--g600)"}}>{selMatch.recherche.surfaceMin+"m² min"}</div>}
              <div style={{marginTop:8,fontWeight:700,color:"var(--blue)",fontSize:12}}>{"Agent : "+nomAgent(selMatch.agentRecherche)}</div>
            </div>
            {/* Bien */}
            <div style={{background:typeBgs[selMatch.type]||"var(--g50)",borderRadius:10,padding:"12px"}}>
              <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,textTransform:"uppercase",marginBottom:6}}>{typeEmoji[selMatch.type]+" "+(selMatch.type==="offmarket"?"Off market":selMatch.type.charAt(0).toUpperCase()+selMatch.type.slice(1))}</div>
              <div style={{fontWeight:800,color:"var(--navy)",fontSize:13,marginBottom:4}}>{selMatch.bien.ref||selMatch.bien.adresse}</div>
              <div style={{fontSize:11,color:"var(--g600)"}}>{selMatch.bien.adresse}</div>
              <div style={{fontSize:12,fontWeight:800,color:typeColors[selMatch.type]||"var(--navy)",marginTop:4}}>{selMatch.prixLabel}</div>
              {selMatch.type==="offmarket" && selMatch.bien.motivation && <div style={{fontSize:11,color:"#7C3AED",fontWeight:700,marginTop:2}}>{"Motivation : "+selMatch.bien.motivation}</div>}
              <div style={{marginTop:8,fontWeight:700,color:"var(--blue)",fontSize:12}}>{"Agent : "+nomAgent(selMatch.agentBien)}</div>
            </div>
          </div>

          {/* Points communs */}
          <div style={{background:"var(--g50)",borderRadius:10,padding:"12px",marginBottom:14}}>
            <div style={{fontWeight:700,color:"var(--navy)",fontSize:12,marginBottom:8}}>{"Points communs"}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {selMatch.raisons.map(function(r,i){ return <span key={i} style={{background:"#fff",border:"1px solid var(--g200)",borderRadius:8,padding:"3px 10px",fontSize:12}}>{r}</span>; })}
            </div>
          </div>

          {/* Message pré-rédigé */}
          <div style={{background:"#F0FDF4",border:"1px solid #A7F3D0",borderRadius:10,padding:"12px",marginBottom:14}}>
            <div style={{fontWeight:700,color:"#065F46",fontSize:12,marginBottom:6}}>{"💬 Message privé envoyé séparément à chaque agent"+(selMatch.agentRecherche===selMatch.agentBien?" (même agent)":"")}</div>
            <div style={{fontSize:11,color:"#047857",lineHeight:1.6,fontFamily:"monospace",whiteSpace:"pre-wrap"}}>
              {"🎯 RAPPROCHEMENT — Score "+selMatch.score+"%\n"
              +"Recherche : "+selMatch.recherche.nom+" → "+selMatch.bien.adresse+"\n"
              +"Agent recherche : "+nomAgent(selMatch.agentRecherche)+"\n"
              +"Agent bien : "+nomAgent(selMatch.agentBien)+"\n"
              +"Points communs : "+selMatch.raisons.join(", ")}
            </div>
          </div>

          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-secondary" style={{flex:1}} onClick={function(){setSelMatch(null);}}>{"Fermer"}</button>
            {selMatch.agentRecherche !== selMatch.agentBien ? (
              <button className="btn btn-primary" style={{flex:2,background:"#059669",border:"none"}} onClick={function(){ envoyerMessage(selMatch); setSelMatch(null); }}>
                {"📨 Envoyer aux 2 agents"}
              </button>
            ) : (
              <button className="btn btn-primary" style={{flex:2}} onClick={function(){ envoyerMessage(selMatch); setSelMatch(null); }}>
                {"📨 Notifier l'agent"}
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Liste des matches */}
      {allMatches.length===0 && (
        <div style={{textAlign:"center",padding:"40px 20px",color:"var(--g400)"}}>
          <div style={{fontSize:40,marginBottom:12}}>{"🎯"}</div>
          <div style={{fontWeight:700,fontSize:15,color:"var(--navy)"}}>{"Aucun rapprochement détecté"}</div>
          <div style={{fontSize:12,marginTop:6}}>{"Abaissez le score minimum ou ajoutez des recherches acheteurs."}</div>
        </div>
      )}

      {allMatches.map(function(match, i) {
        var scoreColor = match.score>=80?"var(--green)":match.score>=60?"var(--amber)":"var(--g400)";
        var memeAgent  = match.agentRecherche===match.agentBien;
        return (
          <div key={i} style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",borderLeft:"4px solid "+scoreColor,padding:"12px 14px",marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4}}>
                  <span style={{background:typeBgs[match.type],color:typeColors[match.type],borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:800}}>{typeEmoji[match.type]+" "+match.type}</span>
                  {match.cross && <span style={{background:"#FEF3C7",color:"#92400E",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:800}}>{"🌐 Cross-agence"}</span>}
                  {memeAgent && <span style={{background:"#F0FDF4",color:"#059669",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:800}}>{"👤 Même agent"}</span>}
                </div>
                <div style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{match.recherche.nom+" → "+match.bien.adresse.split(",")[0]}</div>
                <div style={{fontSize:11,color:"var(--g500)",marginTop:2}}>
                  {match.prixLabel+" · Agent R: "+nomAgent(match.agentRecherche)+(memeAgent?"":" · Agent B: "+nomAgent(match.agentBien))}
                </div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>
                  {match.raisons.slice(0,3).map(function(r,ri){ return <span key={ri} style={{fontSize:9,background:"var(--g50)",border:"1px solid var(--g100)",borderRadius:6,padding:"1px 6px"}}>{r}</span>; })}
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:10,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                <div style={{fontWeight:900,fontSize:20,color:scoreColor,lineHeight:1}}>{match.score+"%"}</div>
                <button onClick={function(){setSelMatch(match);}} style={{background:"var(--navy)",color:"#fff",border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{"Voir →"}</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
