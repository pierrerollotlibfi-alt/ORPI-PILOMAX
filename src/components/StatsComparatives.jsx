import { useState, useMemo } from "react";
import { useApp } from "../App";
import { fmt, commHT } from "./Shared";

var MOIS_NOM = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

function getMoisStr(offset) {
  var d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
}

function inMois(d, m) { return d && d.slice && d.slice(0,7)===m; }

function BarChart({ data, color, maxVal, height }) {
  height = height || 80;
  return (
    <div style={{display:"flex",gap:3,alignItems:"flex-end",height:height}}>
      {data.map(function(d,i){
        var pct = maxVal > 0 ? Math.max(4, Math.round(d.val/maxVal*100)) : 4;
        var isCurrent = i===data.length-1;
        return (
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <div style={{width:"100%",background:isCurrent?color:(color+"55"),borderRadius:"3px 3px 0 0",height:pct+"%",minHeight:4,transition:"height 0.4s"}}/>
            <div style={{fontSize:8,color:"var(--g400)",fontWeight:isCurrent?800:400,whiteSpace:"nowrap"}}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function StatsComparatives() {
  var ctx = useApp();
  var me  = ctx.currentUser;
  var agenceId = me.agenceId;
  var mandats  = ctx.mandats  || [];
  var locations= ctx.locations|| [];
  var users    = ctx.users    || [];
  var prospection = ctx.prospection || [];

  var isManager = me.role==="manager"||me.role==="superadmin";
  var [filtreAgent, setFiltreAgent] = useState(isManager?"":me.id);
  var [periode,     setPeriode]     = useState(12); // 6 ou 12 mois

  var agents = users.filter(function(u){ return u.agenceId===agenceId&&u.actif&&(u.role==="agent"||u.role==="manager"); });

  // Données sur N mois
  var moisList = useMemo(function(){
    var list = [];
    for (var i=periode-1; i>=0; i--) {
      var m = getMoisStr(-i);
      list.push({ mois:m, label:MOIS_NOM[parseInt(m.split("-")[1])-1]+(i===0?" (actuel)":"") });
    }
    return list;
  }, [periode]);

  function filtrerMandats(m) {
    if (filtreAgent) return m.agentId===filtreAgent && m.agenceId===agenceId;
    return m.agenceId===agenceId;
  }

  // Séries de données
  var series = useMemo(function(){
    return moisList.map(function(ml){
      var m = ml.mois;
      var mandatsMois  = mandats.filter(function(x){ return filtrerMandats(x) && inMois(x.dateMandat,m); });
      var ventesMois   = mandats.filter(function(x){ return filtrerMandats(x) && x.statut==="vendu" && inMois(x.dateSignature||x.dateCompromis,m); });
      var comproMois   = mandats.filter(function(x){ return filtrerMandats(x) && inMois(x.dateCompromis,m); });
      var caMois       = ventesMois.reduce(function(s,x){ return s+commHT(x.commission||0,x.typeBien); },0);
      var prospecMois  = prospection.filter(function(p){ var aid=filtreAgent||null; return (!aid||p.agentId===aid) && p.agenceId===agenceId && inMois(p.dateVisite||p.date,m); }).length;
      var txCommMois   = (function(){
        var vp = ventesMois.filter(function(x){return x.prix>0&&x.commission>0;});
        return vp.length>0 ? Math.round(vp.reduce(function(s,x){return s+(x.commission/x.prix*100);},0)/vp.length*100)/100 : 0;
      })();
      return { ...ml, nbMandats:mandatsMois.length, nbVentes:ventesMois.length, nbCompromis:comproMois.length, ca:caMois, prospec:prospecMois, txComm:txCommMois };
    });
  }, [moisList, mandats, filtreAgent]);

  var maxCA      = Math.max(...series.map(function(s){return s.ca;}),1);
  var maxMandats = Math.max(...series.map(function(s){return s.nbMandats;}),1);
  var maxVentes  = Math.max(...series.map(function(s){return s.nbVentes;}),1);
  var maxProspec = Math.max(...series.map(function(s){return s.prospec;}),1);
  var maxTx      = Math.max(...series.map(function(s){return s.txComm;}),1);

  // Variation vs mois précédent
  function variation(key) {
    var cur  = series[series.length-1]?.[key]||0;
    var prev = series[series.length-2]?.[key]||0;
    if (prev===0) return null;
    return Math.round((cur-prev)/prev*100);
  }

  function VarBadge({v}) {
    if (v===null) return null;
    return <span style={{fontSize:10,fontWeight:800,color:v>=0?"var(--green)":"var(--red)",marginLeft:6}}>{v>=0?"▲":"▼"}{Math.abs(v)+"%"}</span>;
  }

  // Totaux période
  var totalCA      = series.reduce(function(s,x){return s+x.ca;},0);
  var totalVentes  = series.reduce(function(s,x){return s+x.nbVentes;},0);
  var totalMandats = series.reduce(function(s,x){return s+x.nbMandats;},0);
  var totalProspec = series.reduce(function(s,x){return s+x.prospec;},0);
  var txConvMoyen  = totalMandats>0?Math.round(totalVentes/totalMandats*100):0;

  return (
    <div>
      {/* Filtres */}
      <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:"12px 14px",marginBottom:14}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          {isManager && (
            <select className="form-select" style={{flex:1,fontSize:12}} value={filtreAgent} onChange={function(e){setFiltreAgent(e.target.value);}}>
              <option value="">{"Toute l'équipe"}</option>
              {agents.map(function(a){return <option key={a.id} value={a.id}>{a.nom}</option>;})}
            </select>
          )}
          <div style={{display:"flex",gap:6}}>
            {[6,12].map(function(p){
              return <button key={p} onClick={function(){setPeriode(p);}} style={{padding:"6px 14px",borderRadius:20,border:"2px solid "+(periode===p?"var(--navy)":"var(--g200)"),background:periode===p?"var(--navy)":"#fff",color:periode===p?"#fff":"var(--g500)",fontWeight:700,fontSize:12,cursor:"pointer"}}>{p+" mois"}</button>;
            })}
          </div>
        </div>
      </div>

      {/* KPIs résumé période */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {[
          {label:"CA total période",   val:fmt(totalCA),       color:"var(--green)",  v:variation("ca")},
          {label:"Ventes actées",      val:totalVentes,         color:"var(--red)",    v:variation("nbVentes")},
          {label:"Mandats pris",       val:totalMandats,        color:"var(--navy)",   v:variation("nbMandats")},
          {label:"Taux de conversion", val:txConvMoyen+"%",     color:"var(--amber)",  v:null},
        ].map(function(k){
          return (
            <div key={k.label} style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",borderLeft:"4px solid "+k.color,padding:"12px 14px"}}>
              <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
              <div style={{display:"flex",alignItems:"center"}}>
                <div style={{fontSize:20,fontWeight:900,color:k.color}}>{k.val}</div>
                <VarBadge v={k.v}/>
              </div>
            </div>
          );
        })}
      </div>

      {/* Graphiques */}
      {[
        {titre:"💰 CA mensuel (HT)",         key:"ca",        data:series.map(function(s){return{val:s.ca,label:s.label.slice(0,3)};}),     max:maxCA,      color:"var(--green)",  fmt:function(v){return fmt(v);}},
        {titre:"📋 Mandats pris",             key:"nbMandats", data:series.map(function(s){return{val:s.nbMandats,label:s.label.slice(0,3)};}),max:maxMandats,color:"var(--navy)",  fmt:function(v){return v;}},
        {titre:"✅ Ventes actées",            key:"nbVentes",  data:series.map(function(s){return{val:s.nbVentes,label:s.label.slice(0,3)};}), max:maxVentes,  color:"var(--red)",   fmt:function(v){return v;}},
        {titre:"🚶 Actions prospection",      key:"prospec",   data:series.map(function(s){return{val:s.prospec,label:s.label.slice(0,3)};}),  max:maxProspec, color:"var(--purple)",fmt:function(v){return v;}},
        {titre:"📐 Taux commission moyen (%)",key:"txComm",    data:series.map(function(s){return{val:s.txComm,label:s.label.slice(0,3)};}),   max:maxTx,      color:"var(--amber)", fmt:function(v){return v+"%";}},
      ].map(function(g){
        var cur = series[series.length-1]?.[g.key]||0;
        var v = variation(g.key);
        return (
          <div key={g.titre} style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:"14px",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{g.titre}</div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:900,fontSize:16,color:g.color}}>{g.fmt(cur)}</div>
                {v!==null && <div style={{fontSize:10,color:v>=0?"var(--green)":"var(--red)",fontWeight:700}}>{v>=0?"▲":"▼"}{Math.abs(v)+"% vs mois préc."}</div>}
              </div>
            </div>
            <BarChart data={g.data} color={g.color} maxVal={g.max} height={70}/>
          </div>
        );
      })}

      {/* Tableau mensuel */}
      <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden"}}>
        <div style={{background:"var(--g50)",padding:"10px 14px",borderBottom:"1px solid var(--g100)"}}>
          <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"📋 Tableau récapitulatif"}</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:400}}>
            <thead>
              <tr style={{background:"var(--g50)"}}>
                {["Mois","Mandats","Ventes","Compro.","CA HT","Prospec.","Tx comm."].map(function(h){
                  return <th key={h} style={{padding:"7px 10px",fontWeight:700,color:"var(--g500)",textAlign:h==="Mois"?"left":"right",whiteSpace:"nowrap"}}>{h}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {[...series].reverse().map(function(s,i){
                var isCurrent = i===0;
                return (
                  <tr key={s.mois} style={{borderBottom:"1px solid var(--g50)",background:isCurrent?"#F0F9FF":"#fff"}}>
                    <td style={{padding:"7px 10px",fontWeight:isCurrent?800:600,color:isCurrent?"var(--blue)":"var(--navy)"}}>{s.label}</td>
                    <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700,color:"var(--navy)"}}>{s.nbMandats}</td>
                    <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700,color:"var(--green)"}}>{s.nbVentes}</td>
                    <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700,color:"var(--amber)"}}>{s.nbCompromis}</td>
                    <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700,color:"var(--red)"}}>{fmt(s.ca)}</td>
                    <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700,color:"var(--purple)"}}>{s.prospec}</td>
                    <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700,color:s.txComm>=4?"var(--green)":s.txComm>=3?"var(--amber)":"var(--red)"}}>{s.txComm>0?s.txComm+"%":"—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
