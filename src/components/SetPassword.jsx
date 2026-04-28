import { useState } from "react";
import { useApp } from "../App";

export default function SetPassword({ token, onSuccess }) {
  var ctx = useApp();
  var [pwd,    setPwd]    = useState("");
  var [pwd2,   setPwd2]   = useState("");
  var [error,  setError]  = useState("");
  var [done,   setDone]   = useState(false);

  var [submitting, setSubmitting] = useState(false);
  async function submit() {
    if (pwd.length < 6) { setError("Mot de passe trop court (6 caractères min.)"); return; }
    if (pwd !== pwd2)   { setError("Les mots de passe ne correspondent pas"); return; }
    setSubmitting(true);
    // Utilise la version async si disponible (Supabase) sinon la version sync
    var fn = ctx.activerCompteAsync || ctx.activerCompte;
    var err = await fn(token, pwd, ctx.invUserId, ctx.invAgenceId);
    setSubmitting(false);
    if (err) { setError(err); return; }
    setDone(true);
    setTimeout(onSuccess, 2000);
  }

  if (done) return (
    <div style={{minHeight:"100vh",background:"var(--navy)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:20,padding:"40px 32px",maxWidth:400,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:50,marginBottom:14}}>{"✅"}</div>
        <h2 style={{color:"var(--navy)",marginBottom:8}}>{"Compte activé !"}</h2>
        <p style={{color:"#64748B"}}>{"Redirection vers la connexion…"}</p>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"var(--navy)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:20,padding:"38px 32px",width:"100%",maxWidth:420,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:40,marginBottom:10}}>{"🔐"}</div>
          <h2 style={{color:"var(--navy)",fontWeight:800}}>{"Créer votre mot de passe"}</h2>
          <p style={{color:"#64748B",fontSize:13,marginTop:6}}>{"Choisissez un mot de passe sécurisé pour votre compte."}</p>
          {!token && <div style={{background:"#FEF2F2",color:"#DC2626",borderRadius:8,padding:"8px 12px",fontSize:12,marginTop:8,fontWeight:600}}>{"⚠️ Lien incomplet — retournez sur le lien reçu par email et cliquez dessus en entier."}</div>}
        </div>
        {error && <div className="alert alert-danger" style={{marginBottom:14}}>{"⚠️ "+error}</div>}
        <div className="form-group" style={{marginBottom:12}}>
          <label className="form-label">{"Mot de passe"}</label>
          <input type="password" className="form-input" placeholder="Minimum 6 caractères" value={pwd} onChange={function(e){setPwd(e.target.value);setError("");}}/>
        </div>
        <div className="form-group" style={{marginBottom:20}}>
          <label className="form-label">{"Confirmer le mot de passe"}</label>
          <input type="password" className="form-input" placeholder="Répétez votre mot de passe" value={pwd2} onChange={function(e){setPwd2(e.target.value);setError("");}} onKeyDown={function(e){if(e.key==="Enter")submit();}}/>
        </div>
        <button className="btn btn-primary" style={{width:"100%",padding:13,justifyContent:"center"}} onClick={submit} disabled={submitting}>
          {submitting ? "⏳ Vérification en cours…" : "Activer mon compte →"}
        </button>
      </div>
    </div>
  );
}
