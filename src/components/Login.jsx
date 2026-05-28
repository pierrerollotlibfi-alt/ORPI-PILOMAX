import { useState, useEffect } from "react";
import { useApp } from "../App";
import PwaInstallButton from "./PwaInstallButton";

// PWA install prompt — capturé globalement
if (typeof window !== "undefined" && !window._pwaListenerAdded) {
  window._pwaListenerAdded = true;
  window._pwaInstallPrompt = null;
  window.addEventListener("beforeinstallprompt", function(e) {
    e.preventDefault();
    window._pwaInstallPrompt = e;
    try{ sessionStorage.setItem("pwa_installable","1"); }catch(ex){}
    window.dispatchEvent(new Event("pwa_installable"));
  });
}

export default function Login({ onLogin }) {
  var ctx = useApp();
  var [email,      setEmail]      = useState("");
  var [pwd,        setPwd]        = useState("");
  var [error,      setError]      = useState("");
  var [loading,    setLoading]    = useState(false);
  var [vue,        setVue]        = useState("login");
  var [canInstall, setCanInstall] = useState(function(){
    try{ return !!(window._pwaInstallPrompt || sessionStorage.getItem("pwa_installable")); }catch(e){ return false; }
  });

  useEffect(function(){
    function handler(){ setCanInstall(true); }
    window.addEventListener("pwa_installable", handler);
    return function(){ window.removeEventListener("pwa_installable", handler); };
  }, []);

  function installApp() {
    if (window._pwaInstallPrompt) {
      window._pwaInstallPrompt.prompt();
      window._pwaInstallPrompt.userChoice.then(function(r){
        if (r.outcome==="accepted"){ setCanInstall(false); window._pwaInstallPrompt=null; }
      });
    }
  }

  function submit() {
    if (!email.trim()) { setError("Saisissez votre email"); return; }
    if (!pwd)          { setError("Saisissez votre mot de passe"); return; }
    setLoading(true); setError("");
    setTimeout(function() {
      var err = onLogin(email.trim(), pwd);
      if (err) { setError(err); setLoading(false); }
    }, 200);
  }

  function demanderReset() {
    var e = email.trim().toLowerCase();
    if (!e) { setError("Saisissez votre email d'abord"); return; }
    var u = (ctx.users||[]).find(function(x){ return x.email.toLowerCase()===e && x.actif; });
    if (!u) { setError("Email non reconnu"); return; }
    ctx.demanderResetMdp(u.id);
    setVue("oubliOk");
    setError("");
  }

  if (vue === "oubliOk") return (
    <div style={{minHeight:"100vh",background:"linear-gradient(145deg,#1D3557 0%,#2a4a7a 50%,#E63946 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:"var(--font)"}}>
      <div style={{background:"#fff",borderRadius:22,padding:"40px 34px",width:"100%",maxWidth:400,boxShadow:"0 40px 100px rgba(0,0,0,0.25)",textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:16}}>{"✅"}</div>
        <h2 style={{color:"#1D3557",fontWeight:800,marginBottom:12}}>{"Demande envoyée"}</h2>
        <p style={{color:"#64748B",fontSize:14,lineHeight:1.6,marginBottom:24}}>
          {"Votre manager a reçu votre demande de réinitialisation. Il va vous communiquer un nouveau mot de passe très prochainement."}
        </p>
        <button className="btn btn-secondary" style={{width:"100%"}} onClick={function(){setVue("login");}}>
          {"← Retour à la connexion"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(145deg,#1D3557 0%,#2a4a7a 50%,#E63946 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:"var(--font)"}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{background:"#fff",borderRadius:22,padding:"40px 34px",boxShadow:"0 40px 100px rgba(0,0,0,0.25)",marginBottom:16}}>

          <div style={{display:"flex",justifyContent:"center",marginBottom:24}}>
            <div style={{background:"#E63946",borderRadius:14,padding:"12px 26px"}}>
              <div style={{color:"#fff",fontWeight:900,fontSize:18,letterSpacing:1}}>{"ORPI"}</div>
              <div style={{color:"rgba(255,255,255,0.7)",fontSize:9,letterSpacing:3}}>{"DÉCLIC IMMO"}</div>
            </div>
          </div>

          <h1 style={{textAlign:"center",fontSize:19,fontWeight:800,color:"#1D3557",marginBottom:4}}>{"Pilotage Commercial"}</h1>
          <p style={{textAlign:"center",color:"#94A3B8",fontSize:12,marginBottom:24}}>{"ORPI Pro Amiens"}</p>

          {error && (
            <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#DC2626",fontWeight:600}}>
              {"⚠️ "+error}
            </div>
          )}

          <div className="form-group" style={{marginBottom:14}}>
            <label className="form-label">{"Email"}</label>
            <input type="email" className="form-input"
              placeholder="votre@email.fr"
              value={email}
              onChange={function(e){setEmail(e.target.value);setError("");}}
              onKeyDown={function(e){if(e.key==="Enter")submit();}}
              autoComplete="email" autoFocus/>
          </div>

          <div className="form-group" style={{marginBottom:8}}>
            <label className="form-label">{"Mot de passe"}</label>
            <input type="password" className="form-input"
              placeholder="••••••••"
              value={pwd}
              onChange={function(e){setPwd(e.target.value);setError("");}}
              onKeyDown={function(e){if(e.key==="Enter")submit();}}
              autoComplete="current-password"/>
          </div>

          <div style={{textAlign:"right",marginBottom:20}}>
            <button onClick={demanderReset} style={{background:"none",border:"none",color:"#E63946",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"var(--font)",textDecoration:"underline"}}>
              {"Mot de passe oublié ?"}
            </button>
          </div>

          <button className="btn btn-primary"
            style={{width:"100%",padding:14,fontSize:15,justifyContent:"center",boxShadow:"0 4px 16px rgba(230,57,70,0.3)"}}
            onClick={submit} disabled={loading}>
            {loading ? "Connexion…" : "Se connecter →"}
          </button>

          <div style={{marginTop:20,background:"#F8FAFC",borderRadius:10,padding:"12px 14px",fontSize:12,color:"#64748B",border:"1px solid #E2E8F0"}}>
            <div style={{fontWeight:700,color:"#334155",marginBottom:4}}>{"🔑 Première connexion ?"}</div>
            <div>{"Votre manager vous a communiqué un mot de passe temporaire. Utilisez-le pour vous connecter, puis changez-le depuis Mon Profil."}</div>
          </div>
        </div>

                {/* Bouton PWA install multi-navigateur */}
        <PwaInstallButton canInstall={canInstall} installApp={installApp}/>        )}
      </div>

      {/* ─── COPYRIGHT ─── */}
      <div style={{textAlign:"center",padding:"16px 20px 24px",marginTop:"auto"}}>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",lineHeight:1.6}}>
          {"© "+new Date().getFullYear()+" ORPI PILOMAX"}
        </div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2}}>
          {"Propriété exclusive de Pierre ROLLOT — Tous droits réservés"}
        </div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:1}}>
          {"Application développée et conçue par Pierre ROLLOT"}
        </div>
      </div>
    </div>
  );
}
