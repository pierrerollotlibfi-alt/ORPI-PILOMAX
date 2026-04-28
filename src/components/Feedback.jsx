import { useState, useMemo } from "react";
import { useApp } from "../App";

var CATEGORIES = [
  { id:"bug",        label:"🐛 Bug / Erreur",           color:"#EF4444", bg:"#FEF2F2" },
  { id:"amelioration",label:"💡 Amélioration",           color:"#2563EB", bg:"#EFF6FF" },
  { id:"fonctionnalite",label:"✨ Nouvelle fonctionnalité",color:"#7C3AED", bg:"#F5F3FF" },
  { id:"ergonomie",  label:"📱 Ergonomie / UX",          color:"#EA580C", bg:"#FFF7ED" },
  { id:"autre",      label:"💬 Autre",                   color:"#6B7280", bg:"#F9FAFB" },
];
var PRIORITES = [
  { id:"faible",  label:"Faible",  color:"#6B7280" },
  { id:"normale", label:"Normale", color:"#2563EB" },
  { id:"haute",   label:"Haute",   color:"#EF4444" },
];
var STATUTS = [
  { id:"nouveau",    label:"Nouveau",     color:"#2563EB", bg:"#EFF6FF" },
  { id:"en_cours",   label:"En cours",    color:"#D97706", bg:"#FEF3C7" },
  { id:"planifie",   label:"Planifié",    color:"#7C3AED", bg:"#F5F3FF" },
  { id:"resolu",     label:"Résolu ✅",   color:"#059669", bg:"#F0FDF4" },
  { id:"refuse",     label:"Refusé",      color:"#EF4444", bg:"#FEF2F2" },
];
var SK_FB = "orpi_data_feedback";

function lload(k,fb){ try{var v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch(e){return fb;} }
function lsave(k,v){ try{localStorage.setItem(k,JSON.stringify(v));}catch(e){} }

export default function Feedback() {
  var ctx      = useApp();
  var me       = ctx.currentUser;
  var isManager= me.role==="manager" || me.role==="superadmin";
  var users    = ctx.users || [];

  var [feedbacks,    setFeedbacksRaw] = useState(function(){ return lload(SK_FB,[]); });
  var [showForm,     setShowForm]     = useState(false);
  var [filtreCat,    setFiltreCat]    = useState("");
  var [filtreStatut, setFiltreStatut] = useState(isManager?"":"");
  var [filtreAgent,  setFiltreAgent]  = useState("");
  var [selFb,        setSelFb]        = useState(null);

  function setFeedbacks(v) {
    var next = typeof v==="function" ? v(feedbacks) : v;
    setFeedbacksRaw(next);
    lsave(SK_FB, next);
    // Sync Supabase si dispo
    try { if(ctx.syncMode==="supabase" && window._supabaseSave) window._supabaseSave("feedback",next); } catch(e){}
  }

  // Feedbacks visibles
  var agenceId = me.agenceId;
  var visible = feedbacks.filter(function(fb){
    if (fb.agenceId !== agenceId) return false;
    if (!isManager && fb.agentId !== me.id) return false;
    if (filtreCat    && fb.categorie !== filtreCat)    return false;
    if (filtreStatut && fb.statut   !== filtreStatut)  return false;
    if (filtreAgent  && fb.agentId  !== filtreAgent)   return false;
    return true;
  }).sort(function(a,b){ return b.createdAt.localeCompare(a.createdAt); });

  var nbNouveaux = feedbacks.filter(function(fb){ return fb.agenceId===agenceId && fb.statut==="nouveau"; }).length;

  // ─── FORM ─────────────────────────────────────────────────────────────────
  function FbForm({ onClose }) {
    var [f, setF] = useState({ titre:"", categorie:"amelioration", priorite:"normale", description:"", agentId:me.id, agenceId, statut:"nouveau" });
    function set(k,v){ setF(function(p){return{...p,[k]:v};}); }
    function submit() {
      if (!f.titre.trim() || !f.description.trim()) return;
      var fb = {...f, id:"fb-"+Date.now(), createdAt:new Date().toISOString(), agentNom:me.nom, votes:[], commentaires:[] };
      setFeedbacks(function(prev){ return [fb,...prev]; });
      onClose();
    }
    var catActive = CATEGORIES.find(function(c){return c.id===f.categorie;});
    return (
      <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",padding:20,marginBottom:16}}>
        <div style={{fontWeight:800,color:"var(--navy)",fontSize:15,marginBottom:14}}>{"💡 Nouvelle suggestion / signalement"}</div>

        {/* Catégorie */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:"var(--g400)",fontWeight:700,marginBottom:6,textTransform:"uppercase"}}>{"Catégorie"}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {CATEGORIES.map(function(cat){
              var actif = f.categorie===cat.id;
              return (
                <button key={cat.id} onClick={function(){set("categorie",cat.id);}} style={{padding:"6px 12px",borderRadius:20,border:"2px solid "+(actif?cat.color:"var(--g200)"),background:actif?cat.bg:"#fff",color:actif?cat.color:"var(--g400)",fontWeight:700,fontSize:11,cursor:"pointer"}}>
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Priorité */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:"var(--g400)",fontWeight:700,marginBottom:6,textTransform:"uppercase"}}>{"Priorité selon vous"}</div>
          <div style={{display:"flex",gap:6}}>
            {PRIORITES.map(function(p){
              var actif = f.priorite===p.id;
              return (
                <button key={p.id} onClick={function(){set("priorite",p.id);}} style={{flex:1,padding:"6px",borderRadius:10,border:"2px solid "+(actif?p.color:"var(--g200)"),background:actif?p.color:"#fff",color:actif?"#fff":"var(--g400)",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Titre */}
        <div className="form-group" style={{marginBottom:10}}>
          <label className="form-label">{"Titre *"}</label>
          <input className="form-input" value={f.titre} onChange={function(e){set("titre",e.target.value);}} placeholder="Résumé en une phrase…" autoFocus/>
        </div>

        {/* Description */}
        <div className="form-group" style={{marginBottom:14}}>
          <label className="form-label">{"Description *"}</label>
          <textarea className="form-input" rows={4} value={f.description} onChange={function(e){set("description",e.target.value);}} placeholder={"Décrivez le problème ou l'idée en détail.\nContexte, cas d'usage, exemple concret…"} style={{resize:"vertical",fontFamily:"var(--font)"}}/>
        </div>

        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>{"Annuler"}</button>
          <button className="btn btn-primary" style={{flex:2,background:catActive?catActive.color:"var(--blue)",border:"none"}} onClick={submit}>{"📤 Envoyer"}</button>
        </div>
      </div>
    );
  }

  // ─── DETAIL FEEDBACK ──────────────────────────────────────────────────────
  function FbDetail({ fb, onClose }) {
    var cat  = CATEGORIES.find(function(c){return c.id===fb.categorie;}) || CATEGORIES[4];
    var stat = STATUTS.find(function(s){return s.id===fb.statut;})       || STATUTS[0];
    var prio = PRIORITES.find(function(p){return p.id===fb.priorite;})   || PRIORITES[1];
    var [newComment, setNewComment] = useState("");
    var [newStatut,  setNewStatut]  = useState(fb.statut);
    var [reponse,    setReponse]    = useState(fb.reponseManager||"");

    var aVote = (fb.votes||[]).includes(me.id);

    function vote() {
      var votes = aVote
        ? (fb.votes||[]).filter(function(id){return id!==me.id;})
        : [...(fb.votes||[]), me.id];
      updateFb({...fb, votes});
    }
    function addComment() {
      if (!newComment.trim()) return;
      var com = {id:"c-"+Date.now(), auteur:me.nom, role:me.role, texte:newComment.trim(), ts:new Date().toISOString()};
      updateFb({...fb, commentaires:[...(fb.commentaires||[]),com]});
      setNewComment("");
    }
    function saveStatut() {
      updateFb({...fb, statut:newStatut, reponseManager:reponse, reponduPar:me.nom, reponduAt:new Date().toISOString()});
    }
    function updateFb(updated) {
      setFeedbacks(function(prev){return prev.map(function(x){return x.id===fb.id?updated:x;});});
      if (selFb && selFb.id===fb.id) setSelFb(updated);
    }

    return (
      <div style={{background:"#fff",borderRadius:14,border:"2px solid "+(cat.color),overflow:"hidden",marginBottom:16}}>
        {/* Header */}
        <div style={{background:cat.bg,borderBottom:"1px solid "+cat.color+"33",padding:"14px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <span style={{background:cat.color,color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800}}>{cat.label}</span>
              <span style={{background:stat.bg,color:stat.color,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800}}>{stat.label}</span>
              <span style={{background:"#fff",color:prio.color,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800,border:"1px solid "+prio.color}}>{"Priorité : "+prio.label}</span>
            </div>
            <button onClick={onClose} style={{border:"none",background:"rgba(0,0,0,0.07)",borderRadius:8,width:28,height:28,cursor:"pointer",fontSize:14,color:"var(--g500)"}}>{"✕"}</button>
          </div>
          <div style={{fontWeight:900,color:"var(--navy)",fontSize:15,marginBottom:4}}>{fb.titre}</div>
          <div style={{fontSize:11,color:"var(--g400)"}}>{fb.agentNom+" · "+new Date(fb.createdAt).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
        </div>

        <div style={{padding:"14px 16px"}}>
          {/* Description */}
          <div style={{fontSize:13,color:"var(--g700)",lineHeight:1.7,marginBottom:14,whiteSpace:"pre-wrap"}}>{fb.description}</div>

          {/* Vote */}
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,paddingBottom:14,borderBottom:"1px solid var(--g100)"}}>
            <button onClick={vote} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:20,border:"2px solid "+(aVote?"var(--blue)":"var(--g200)"),background:aVote?"#EFF6FF":"#fff",color:aVote?"var(--blue)":"var(--g400)",fontWeight:700,fontSize:12,cursor:"pointer"}}>
              {(aVote?"👍":"👍")+" "+(fb.votes||[]).length+" vote"+(( fb.votes||[]).length!==1?"s":"")}
            </button>
            <span style={{fontSize:11,color:"var(--g400)"}}>{(fb.votes||[]).length>0?("Soutenu par "+(fb.votes||[]).length+" personne"+(( fb.votes||[]).length>1?"s":"")):"Soyez le premier à voter !"}</span>
          </div>

          {/* Réponse manager */}
          {isManager && (
            <div style={{background:"var(--g50)",borderRadius:10,padding:"12px 14px",marginBottom:14,border:"1px solid var(--g200)"}}>
              <div style={{fontWeight:700,color:"var(--navy)",fontSize:13,marginBottom:10}}>{"⚙️ Traitement manager"}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                <div>
                  <label style={{fontSize:11,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"Statut"}</label>
                  <select className="form-select" value={newStatut} onChange={function(e){setNewStatut(e.target.value);}}>
                    {STATUTS.map(function(s){return <option key={s.id} value={s.id}>{s.label}</option>;})}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{marginBottom:10}}>
                <label className="form-label">{"Réponse / commentaire manager"}</label>
                <textarea className="form-input" rows={3} value={reponse} onChange={function(e){setReponse(e.target.value);}} placeholder="Expliquez ce qui sera fait, pourquoi refusé, ou la date de planification…" style={{resize:"vertical",fontFamily:"var(--font)"}}/>
              </div>
              <button className="btn btn-primary btn-sm" onClick={saveStatut}>{"💾 Enregistrer"}</button>
            </div>
          )}

          {/* Réponse manager (vue agent) */}
          {!isManager && fb.reponseManager && (
            <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,padding:"10px 14px",marginBottom:14}}>
              <div style={{fontSize:11,color:"var(--g400)",fontWeight:700,marginBottom:4}}>{"💬 Réponse de "+fb.reponduPar}</div>
              <div style={{fontSize:13,color:"var(--navy)",lineHeight:1.6}}>{fb.reponseManager}</div>
            </div>
          )}

          {/* Commentaires */}
          <div>
            <div style={{fontWeight:700,color:"var(--navy)",fontSize:13,marginBottom:8}}>{"💬 Discussion ("+(fb.commentaires||[]).length+")"}</div>
            {(fb.commentaires||[]).map(function(com){
              var isMine = com.auteur===me.nom;
              return (
                <div key={com.id} style={{display:"flex",flexDirection:isMine?"row-reverse":"row",gap:8,alignItems:"flex-start",marginBottom:8}}>
                  <div style={{width:28,height:28,borderRadius:14,background:com.role==="manager"||com.role==="superadmin"?"#1D3557":"var(--blue)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,fontWeight:900,flexShrink:0}}>
                    {com.auteur.split(" ").map(function(n){return n[0]||"";}).join("").slice(0,2).toUpperCase()}
                  </div>
                  <div style={{background:isMine?"#EFF6FF":"var(--g50)",borderRadius:10,padding:"8px 12px",maxWidth:"80%",border:"1px solid "+(isMine?"#BFDBFE":"var(--g200)")}}>
                    <div style={{fontSize:10,color:"var(--g400)",marginBottom:3}}>{com.auteur+(com.role==="manager"||com.role==="superadmin"?" 👑":"")+" · "+new Date(com.ts).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</div>
                    <div style={{fontSize:13,color:"var(--navy)"}}>{com.texte}</div>
                  </div>
                </div>
              );
            })}
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <input className="form-input" value={newComment} onChange={function(e){setNewComment(e.target.value);}} placeholder="Ajouter un commentaire…" onKeyDown={function(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();addComment();}}} style={{flex:1}}/>
              <button className="btn btn-primary btn-sm" onClick={addComment}>{"→"}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDU PRINCIPAL ──────────────────────────────────────────────────────
  var agents = users.filter(function(u){return u.agenceId===agenceId && u.actif && u.role==="agent";});

  return (
    <div>
      {/* Header + stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:12}}>
        {STATUTS.filter(function(s){return ["nouveau","en_cours","resolu"].includes(s.id);}).concat([{id:"_total",label:"Total",color:"var(--navy)",bg:"var(--g50)"}]).map(function(s){
          var count = s.id==="_total"
            ? feedbacks.filter(function(fb){return fb.agenceId===agenceId;}).length
            : feedbacks.filter(function(fb){return fb.agenceId===agenceId && fb.statut===s.id;}).length;
          return (
            <div key={s.id} onClick={function(){setFiltreStatut(filtreStatut===s.id?"":s.id);}} style={{background:s.bg||"var(--g50)",border:"1px solid "+(s.color+"44"),borderRadius:10,padding:"10px 12px",cursor:"pointer",outline:filtreStatut===s.id?"3px solid "+s.color:"none"}}>
              <div style={{fontWeight:900,fontSize:20,color:s.color,lineHeight:1}}>{count}</div>
              <div style={{fontSize:10,color:s.color,fontWeight:600,marginTop:3}}>{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        {!showForm && (
          <button className="btn btn-primary btn-sm" onClick={function(){setShowForm(true);setSelFb(null);}}>{"+ Nouvelle suggestion"}</button>
        )}
        {/* Filtres */}
        <select className="form-select" style={{width:"auto",fontSize:12}} value={filtreCat} onChange={function(e){setFiltreCat(e.target.value);}}>
          <option value="">{"Toutes catégories"}</option>
          {CATEGORIES.map(function(c){return <option key={c.id} value={c.id}>{c.label}</option>;})}
        </select>
        {isManager && agents.length>0 && (
          <select className="form-select" style={{width:"auto",fontSize:12}} value={filtreAgent} onChange={function(e){setFiltreAgent(e.target.value);}}>
            <option value="">{"Tous les agents"}</option>
            {agents.map(function(a){return <option key={a.id} value={a.id}>{a.nom}</option>;})}
          </select>
        )}
        {(filtreCat||filtreStatut||filtreAgent) && (
          <button className="btn btn-secondary btn-sm" onClick={function(){setFiltreCat("");setFiltreStatut("");setFiltreAgent("");}}>{"✕ Effacer"}</button>
        )}
        <span style={{fontSize:12,color:"var(--g400)",alignSelf:"center",marginLeft:"auto"}}>{visible.length+" suggestion"+(visible.length>1?"s":"")}</span>
      </div>

      {/* Formulaire */}
      {showForm && <FbForm onClose={function(){setShowForm(false);}}/>}

      {/* Détail sélectionné */}
      {selFb && <FbDetail fb={selFb} onClose={function(){setSelFb(null);}}/>}

      {/* Liste */}
      {visible.map(function(fb){
        var cat  = CATEGORIES.find(function(c){return c.id===fb.categorie;}) || CATEGORIES[4];
        var stat = STATUTS.find(function(s){return s.id===fb.statut;})       || STATUTS[0];
        var prio = PRIORITES.find(function(p){return p.id===fb.priorite;})   || PRIORITES[1];
        var isSelected = selFb && selFb.id===fb.id;
        if (isSelected) return null; // affiché en détail au-dessus
        return (
          <div key={fb.id} onClick={function(){setSelFb(fb);setShowForm(false);}} style={{background:"#fff",borderRadius:12,border:"2px solid "+(isSelected?cat.color:"var(--g200)"),borderLeft:"4px solid "+cat.color,padding:"12px 14px",marginBottom:8,cursor:"pointer",transition:"border-color 0.15s"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:4}}>
                  <span style={{background:cat.bg,color:cat.color,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:800}}>{cat.label}</span>
                  <span style={{background:stat.bg,color:stat.color,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:800}}>{stat.label}</span>
                  {fb.priorite==="haute" && <span style={{background:"#FEF2F2",color:"#EF4444",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:800}}>{"🔴 Haute priorité"}</span>}
                </div>
                <div style={{fontWeight:800,color:"var(--navy)",fontSize:13,marginBottom:2}}>{fb.titre}</div>
                <div style={{fontSize:11,color:"var(--g400)"}}>{fb.agentNom+" · "+new Date(fb.createdAt).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"})}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
                {(fb.votes||[]).length>0 && <div style={{fontSize:12,fontWeight:700,color:"var(--blue)"}}>{"👍 "+(fb.votes||[]).length}</div>}
                {(fb.commentaires||[]).length>0 && <div style={{fontSize:11,color:"var(--g400)"}}>{"💬 "+(fb.commentaires||[]).length}</div>}
              </div>
            </div>
            <div style={{fontSize:12,color:"var(--g500)",lineHeight:1.5,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
              {fb.description}
            </div>
          </div>
        );
      })}

      {visible.length===0 && !showForm && (
        <div style={{textAlign:"center",padding:"40px 20px",color:"var(--g400)"}}>
          <div style={{fontSize:40,marginBottom:12}}>{"💡"}</div>
          <div style={{fontWeight:700,fontSize:15,color:"var(--navy)",marginBottom:6}}>{"Aucune suggestion"}</div>
          <div style={{fontSize:13}}>{"Partagez vos idées pour améliorer l'application !"}</div>
        </div>
      )}
    </div>
  );
}
