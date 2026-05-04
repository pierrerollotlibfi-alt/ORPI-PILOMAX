import { useState } from "react";
import { useApp } from "../App";
import { fmt, fmtDate, avatarColor, canSeeContact, masquer, masquerTel } from "./Shared";

var MOTIVATIONS = ["Fort","Moyen","Faible"];
var TYPES = ["appartement","maison","studio","local commercial","terrain","parking"];

export default function OffMarket() {
  var ctx = useApp();
  var agenceId = ctx.currentUser.agenceId;
  var role     = ctx.currentUser.role;
  var users    = ctx.users || [];
  var offmarket = (ctx.offmarket||[]).filter(function(o){ return o.agenceId===agenceId && o.actif; });
  var setOffMarket = ctx.setOffMarket;
  var addJournal   = ctx.addJournal;

  var [showForm,    setShowForm]    = useState(false);
  var [editingBien, setEditingBien] = useState(null);
  var [selecId,     setSelecId]     = useState(null);
  var [filtreMotiv, setFiltreMotiv] = useState("");
  var [filtreAgent, setFiltreAgent] = useState("");

  var agents = users.filter(function(u){ return (u.role==="agent"||u.role==="manager") && u.agenceId===agenceId && u.actif; });
  var biensFiltres = offmarket.filter(function(o){
    return (!filtreMotiv || o.motivation===filtreMotiv) && (!filtreAgent || o.agentId===filtreAgent);
  });
  var bienSelec = offmarket.find(function(o){ return o.id===selecId; });

  // ─── KPIs ─────────────────────────────────────────────────────────────────────
  var nbFort  = offmarket.filter(function(o){ return o.motivation==="Fort"; }).length;
  var nbMoyen = offmarket.filter(function(o){ return o.motivation==="Moyen"; }).length;
  var nbFaible= offmarket.filter(function(o){ return o.motivation==="Faible"; }).length;
  var prixTotal = offmarket.reduce(function(s,o){ return s+(o.prix||0); },0);

  // ─── FORM ─────────────────────────────────────────────────────────────────────
  function OffForm({ initial, onSave, onCancel }) {
    var init = initial || {};
    var [f, setF] = useState({
      ref: init.ref||"OFF-"+(offmarket.length+1).toString().padStart(3,"0"),
      adresse: init.adresse||"", typeLogement: init.typeLogement||"maison",
      surface: init.surface||"", nbPieces: init.nbPieces||"",
      prix: init.prix||"", motivation: init.motivation||"Moyen",
      proprietaireNom: init.proprietaireNom||"", proprietairePrenom: init.proprietairePrenom||"",
      proprietaireTel: init.proprietaireTel||"", proprietaireMail: init.proprietaireMail||"",
      agentId: init.agentId||ctx.currentUser.id, notes: init.notes||"",
    });
    function set(k,v){ setF(function(p){ return {...p,[k]:v}; }); }
    var motivColors = {Fort:"#D1FAE5",Moyen:"#FEF3C7",Faible:"#FEE2E2"};
    var motivText   = {Fort:"#065F46",Moyen:"#92400E",Faible:"#991B1B"};
    return (
      <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",padding:20,marginBottom:16}}>
        <div style={{fontWeight:800,color:"var(--navy)",fontSize:15,marginBottom:16}}>{initial?"✏️ Modifier bien off market":"🔒 Nouveau bien off market"}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="form-group"><label className="form-label">{"Référence"}</label><input className="form-input" value={f.ref} onChange={function(e){set("ref",e.target.value);}}/></div>
          <div className="form-group"><label className="form-label">{"Type de bien"}</label>
            <select className="form-select" value={f.typeLogement} onChange={function(e){set("typeLogement",e.target.value);}}>
              {TYPES.map(function(t){ return <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>; })}
            </select>
          </div>
          <div className="form-group" style={{gridColumn:"1/-1"}}><label className="form-label">{"Adresse"}</label><input className="form-input" value={f.adresse} onChange={function(e){set("adresse",e.target.value);}}/></div>
          <div className="form-group"><label className="form-label">{"Surface (m²)"}</label><input className="form-input" type="number" value={f.surface} onChange={function(e){set("surface",e.target.value);}}/></div>
          <div className="form-group"><label className="form-label">{"Nb pièces"}</label><input className="form-input" type="number" value={f.nbPieces} onChange={function(e){set("nbPieces",e.target.value);}}/></div>
          <div className="form-group"><label className="form-label">{"Prix estimé (€)"}</label><input className="form-input" type="number" value={f.prix} onChange={function(e){set("prix",Number(e.target.value));}}/></div>
          <div className="form-group"><label className="form-label">{"Motivation vendeur"}</label>
            <select className="form-select" value={f.motivation} style={{background:motivColors[f.motivation],color:motivText[f.motivation],fontWeight:700}} onChange={function(e){set("motivation",e.target.value);}}>
              {MOTIVATIONS.map(function(m){ return <option key={m} value={m}>{m}</option>; })}
            </select>
          </div>

          <div style={{gridColumn:"1/-1",fontWeight:700,color:"var(--navy)",fontSize:12,marginTop:4,paddingTop:12,borderTop:"1px solid var(--g100)"}}>{"👤 Propriétaire / Contact"}</div>
          <div className="form-group"><label className="form-label">{"Nom"}</label><input className="form-input" value={f.proprietaireNom} onChange={function(e){set("proprietaireNom",e.target.value);}}/></div>
          <div className="form-group"><label className="form-label">{"Prénom"}</label><input className="form-input" value={f.proprietairePrenom} onChange={function(e){set("proprietairePrenom",e.target.value);}}/></div>
          <div className="form-group"><label className="form-label">{"Téléphone"}</label><input className="form-input" value={f.proprietaireTel} onChange={function(e){set("proprietaireTel",e.target.value);}}/></div>
          <div className="form-group"><label className="form-label">{"Email"}</label><input className="form-input" type="email" value={f.proprietaireMail} onChange={function(e){set("proprietaireMail",e.target.value);}}/></div>
          <div className="form-group"><label className="form-label">{"Agent en charge"}</label>
            <select className="form-select" value={f.agentId} onChange={function(e){set("agentId",e.target.value);}}>
              {agents.map(function(a){ return <option key={a.id} value={a.id}>{a.nom}</option>; })}
            </select>
          </div>
          <div className="form-group" style={{gridColumn:"1/-1"}}><label className="form-label">{"Notes confidentielles"}</label><textarea className="form-input" rows={3} value={f.notes} onChange={function(e){set("notes",e.target.value);}}/></div>
        </div>
        <div style={{display:"flex",gap:8,marginTop:16}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onCancel}>{"Annuler"}</button>
          <button className="btn btn-primary" style={{flex:2}} onClick={function(){onSave(f);}}>{"💾 Enregistrer"}</button>
        </div>
      </div>
    );
  }

  function saveBien(form) {
    var isNew = !editingBien;
    var data = {...form, id:isNew?"om-"+Date.now():editingBien.id, agenceId, actif:true, dateContact:editingBien?editingBien.dateContact:new Date().toISOString().slice(0,10)};
    setOffMarket(function(prev){ var ex=prev.find(function(o){return o.id===data.id;}); return ex?prev.map(function(o){return o.id===data.id?data:o;}):[...prev,data]; });
    if(addJournal) addJournal({type:isNew?"creation":"modification",description:(isNew?"Bien off market ajouté : ":"Bien off market modifié : ")+data.ref+" — "+data.adresse,cible:"offmarket",cibleId:data.id});
    setShowForm(false); setEditingBien(null);
  }
  function convertirMandat(bien) {
    if(!window.confirm("Convertir "+bien.ref+" en mandat ? Il sera retiré de l'off market.")) return;
    setOffMarket(function(prev){ return prev.map(function(o){ return o.id===bien.id?{...o,actif:false}:o; }); });
    var newMandat = {
      id:"m-"+Date.now(), ref:"MAN-OM-"+bien.ref, typeMandat:"exclusif",
      adresse:bien.adresse, prix:bien.prix, commission:Math.round(bien.prix*0.03),
      statut:"mandat", agentId:bien.agentId, agenceId,
      dateMandat:new Date().toISOString().slice(0,10),
      dateExpiration:new Date(Date.now()+90*86400000).toISOString().slice(0,10),
      dateCompromis:null, dateSignature:null, clausesSuspensivesLevees:false,
    };
    ctx.setMandats(function(prev){ return [...prev, newMandat]; });
    if(addJournal) addJournal({type:"conversion",description:"Off market converti en mandat : "+bien.ref,cible:"mandat",cibleId:newMandat.id});
    setSelecId(null);
  }
  function archiverBien(id) {
    if(!window.confirm("Archiver ce bien off market ?")) return;
    setOffMarket(function(prev){ return prev.map(function(o){ return o.id===id?{...o,actif:false}:o; }); });
    if(selecId===id) setSelecId(null);
  }

  // ─── COULEURS MOTIVATION ──────────────────────────────────────────────────────
  var motivBg   = {Fort:"#D1FAE5",Moyen:"#FEF3C7",Faible:"#FEE2E2"};
  var motivCol  = {Fort:"#059669",Moyen:"#D97706",Faible:"#EF4444"};

  return (
    <div>
      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:12}}>
        <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",borderLeft:"4px solid var(--navy)",padding:"12px 14px"}}>
          <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,textTransform:"uppercase"}}>{"🔒 Biens off market"}</div>
          <div style={{fontSize:22,fontWeight:900,color:"var(--navy)",marginTop:4}}>{offmarket.length}</div>
        </div>
        <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",borderLeft:"4px solid var(--green)",padding:"12px 14px"}}>
          <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,textTransform:"uppercase"}}>{"💰 Valeur totale"}</div>
          <div style={{fontSize:22,fontWeight:900,color:"var(--green)",marginTop:4}}>{fmt(prixTotal)}</div>
        </div>
        <div style={{background:"#fff",borderRadius:12,border:"1px solid #D1FAE5",borderLeft:"4px solid #059669",padding:"12px 14px"}}>
          <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,textTransform:"uppercase"}}>{"🔥 Motivation forte"}</div>
          <div style={{fontSize:22,fontWeight:900,color:"#059669",marginTop:4}}>{nbFort}</div>
        </div>
        <div style={{background:"#fff",borderRadius:12,border:"1px solid #FEF3C7",borderLeft:"4px solid #D97706",padding:"12px 14px"}}>
          <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,textTransform:"uppercase"}}>{"⏳ Motivation moyenne"}</div>
          <div style={{fontSize:22,fontWeight:900,color:"#D97706",marginTop:4}}>{nbMoyen}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <button className="btn btn-primary btn-sm" onClick={function(){setEditingBien(null);setShowForm(true);setSelecId(null);}}>{"+ Nouveau bien"}</button>
        <select className="form-select" style={{width:"auto",fontSize:12}} value={filtreMotiv} onChange={function(e){setFiltreMotiv(e.target.value);}}>
          <option value="">{"Toutes motivations"}</option>
          {MOTIVATIONS.map(function(m){ return <option key={m} value={m}>{m}</option>; })}
        </select>
        <select className="form-select" style={{width:"auto",fontSize:12}} value={filtreAgent} onChange={function(e){setFiltreAgent(e.target.value);}}>
          <option value="">{"Tous les agents"}</option>
          {agents.map(function(a){ return <option key={a.id} value={a.id}>{a.nom}</option>; })}
        </select>
        <span style={{fontSize:12,color:"var(--g400)",alignSelf:"center"}}>{biensFiltres.length+" bien(s)"}</span>
      </div>

      {/* Formulaire */}
      {showForm && <OffForm initial={editingBien} onSave={saveBien} onCancel={function(){setShowForm(false);setEditingBien(null);}}/>}

      {/* Fiche sélectionnée */}
      {bienSelec && (
        <div style={{background:"#fff",borderRadius:14,border:"2px solid var(--navy)",overflow:"hidden",marginBottom:16}}>
          <div style={{background:"linear-gradient(135deg,#1D3557,#2a4a7a)",padding:"16px 20px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                  <span style={{color:"rgba(255,255,255,0.5)",fontSize:11}}>{bienSelec.ref}</span>
                  <span style={{background:motivBg[bienSelec.motivation],color:motivCol[bienSelec.motivation],borderRadius:20,padding:"2px 10px",fontSize:10,fontWeight:800}}>{"🔥 "+bienSelec.motivation}</span>
                </div>
                <div style={{color:"#fff",fontWeight:800,fontSize:15}}>{bienSelec.adresse}</div>
                <div style={{color:"rgba(255,255,255,0.65)",fontSize:12,marginTop:3}}>
                  {(bienSelec.typeLogement||"Bien").charAt(0).toUpperCase()+(bienSelec.typeLogement||"").slice(1)}
                  {bienSelec.surface?" · "+bienSelec.surface+"m²":""}
                  {bienSelec.nbPieces?" · "+bienSelec.nbPieces+"P":""}
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{color:"#6EE7B7",fontWeight:900,fontSize:20}}>{fmt(bienSelec.prix)}</div>
                <div style={{color:"rgba(255,255,255,0.5)",fontSize:11,marginTop:2}}>{"Hon. estimées : "+fmt(Math.round((bienSelec.prix||0)*0.03))}</div>
              </div>
            </div>
          </div>
          <div style={{padding:"16px 20px"}}>
            {/* Contact */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              {[
                ["📞 Téléphone", (function(){ var ok=canSeeContact(ctx.currentUser,bienSelec.agentId,null); return ok && bienSelec.proprietaireTel ? <a href={"tel:"+bienSelec.proprietaireTel.replace(/\s/g,"")} style={{color:"#059669",fontWeight:800,textDecoration:"none"}}>{bienSelec.proprietaireTel}</a> : masquerTel(bienSelec.proprietaireTel,ok); })()],
                ["✉️ Email",      bienSelec.proprietaireMail||"—"],
                ["👤 Contact", (function(){ var ok=canSeeContact(ctx.currentUser,bienSelec.agentId,null); return masquer(bienSelec.proprietairePrenom+" "+bienSelec.proprietaireNom,ok); })()],
                ["📅 Contact le", bienSelec.dateContact?fmtDate(bienSelec.dateContact):"—"],
              ].map(function(row){
                return (
                  <div key={row[0]} style={{background:"var(--g50)",borderRadius:9,padding:"10px 12px"}}>
                    <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,marginBottom:2}}>{row[0]}</div>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--navy)"}}>{row[1]}</div>
                  </div>
                );
              })}
            </div>
            {bienSelec.notes && (
              <div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:9,padding:"10px 12px",fontSize:12,color:"#92400E",marginBottom:14,fontStyle:"italic"}}>
                {"🔒 "+bienSelec.notes}
              </div>
            )}
            {/* Actions */}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button className="btn btn-sm" style={{background:"#D1FAE5",color:"#065F46",border:"none",fontWeight:800}} onClick={function(){convertirMandat(bienSelec);}}>{"📋 Convertir en mandat"}</button>
              <button className="btn btn-secondary btn-sm" onClick={function(){setEditingBien(bienSelec);setShowForm(true);setSelecId(null);}}>{"✏️ Modifier"}</button>
              <button className="btn btn-sm" style={{background:"#FEF2F2",color:"var(--red)",border:"none"}} onClick={function(){archiverBien(bienSelec.id);}}>{"🗑 Archiver"}</button>
              <button className="btn btn-secondary btn-sm" style={{marginLeft:"auto"}} onClick={function(){setSelecId(null);}}>{"✕ Fermer"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Liste */}
      {biensFiltres.map(function(o) {
        var agent = users.find(function(u){ return u.id===o.agentId; });
        var isSelected = selecId===o.id;
        var joursDepuis = Math.round((new Date()-new Date(o.dateContact||new Date()))/86400000);
        return (
          <div key={o.id} onClick={function(){setSelecId(isSelected?null:o.id);setShowForm(false);}} style={{background:"#fff",borderRadius:12,border:"2px solid "+(isSelected?"var(--navy)":"var(--g200)"),padding:"14px 16px",marginBottom:10,cursor:"pointer",transition:"border-color 0.15s"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                  <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{o.ref}</span>
                  <span style={{background:motivBg[o.motivation],color:motivCol[o.motivation],borderRadius:20,padding:"1px 10px",fontSize:10,fontWeight:800}}>{o.motivation}</span>
                  {o.typeLogement && <span style={{background:"var(--g100)",color:"var(--g500)",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700,textTransform:"capitalize"}}>{o.typeLogement}</span>}
                  {joursDepuis > 60 && <span style={{background:"#FEE2E2",color:"#EF4444",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:800}}>{"⏱ "+joursDepuis+"j sans relance"}</span>}
                </div>
                <div style={{fontSize:13,color:"var(--g600)",marginBottom:2}}>{o.adresse}</div>
                <div style={{fontSize:11,color:"var(--g400)"}}>{o.proprietairePrenom+" "+o.proprietaireNom+(o.surface?" · "+o.surface+"m²":"")+(o.nbPieces?" · "+o.nbPieces+"P":"")}</div>
                {agent && <div style={{fontSize:11,color:"var(--g400)",marginTop:2}}>{"Agent : "+agent.nom}</div>}
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
                <div style={{fontWeight:900,fontSize:16,color:"var(--navy)"}}>{fmt(o.prix)}</div>
                <div style={{fontSize:11,color:"var(--g400)",marginTop:2}}>{"Contact : "+(o.dateContact?fmtDate(o.dateContact):"—")}  </div>
              </div>
            </div>
          </div>
        );
      })}

      {biensFiltres.length===0 && !showForm && (
        <div style={{textAlign:"center",padding:"40px 20px",color:"var(--g400)"}}>
          <div style={{fontSize:40,marginBottom:12}}>{"🔒"}</div>
          <div style={{fontWeight:700,fontSize:15}}>{"Aucun bien off market"}</div>
          <div style={{fontSize:13,marginTop:6}}>{"Ajoutez vos contacts vendeurs confidentiels"}</div>
        </div>
      )}
    </div>
  );
}
