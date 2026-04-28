import { useState, useEffect, useRef } from "react";
import { useApp } from "../App";
import { avatarColor } from "./Shared";

var SK_MSG = "orpi_data_messages_v1";

function loadMessages() {
  try { var v = localStorage.getItem(SK_MSG); return v ? JSON.parse(v) : []; } catch(e) { return []; }
}
function saveMessages(msgs) {
  try { localStorage.setItem(SK_MSG, JSON.stringify(msgs)); } catch(e) {}
}

function initDemoMessages(users) {
  var demo = [
    { id:"m1", channelId:"equipe", senderId:"agent-1", senderNom:"Sophie Martin", senderAvatar:"SM", content:"Nouveau mandat exclusif rue Faidherbe — 285k€ 👋", ts:new Date(Date.now()-7200000).toISOString(), type:"text", read:[] },
    { id:"m2", channelId:"equipe", senderId:"agent-2", senderNom:"Thomas Dupont", senderAvatar:"TD", content:"J'ai un acquéreur intéressé, budget 290k 😊", ts:new Date(Date.now()-5400000).toISOString(), type:"text", read:[] },
    { id:"m3", channelId:"equipe", senderId:"manager-1", senderNom:"Pierre Rollot", senderAvatar:"PR", content:"Super Thomas ! Je vous mets en contact 👍", ts:new Date(Date.now()-3600000).toISOString(), type:"text", read:[] },
    { id:"m4", channelId:"equipe", senderId:"system", senderNom:"Système", senderAvatar:"🔔", content:"Lead attribué à Sophie Martin — Marc Dubois · 06 44 55 66 77 · Site web · 🔴 PRIORITÉ HAUTE", ts:new Date(Date.now()-1800000).toISOString(), type:"system", read:[] },
    { id:"m5", channelId:"equipe", senderId:"agent-3", senderNom:"Amélie Bertrand", senderAvatar:"AB", content:"RDV visite MAN-003 confirmé pour samedi ✅", ts:new Date(Date.now()-900000).toISOString(), type:"text", read:[] },
    { id:"m6", channelId:"priv-manager-1-agent-1", senderId:"agent-1", senderNom:"Sophie Martin", senderAvatar:"SM", content:"OK pour la visite de demain ✓✓", ts:new Date(Date.now()-600000).toISOString(), type:"text", read:[] },
    { id:"m7", channelId:"priv-manager-1-agent-2", senderId:"agent-2", senderNom:"Thomas Dupont", senderAvatar:"TD", content:"J'ai un acquéreur potentiel pour le MAN-009...", ts:new Date(Date.now()-300000).toISOString(), type:"text", read:[] },
  ];
  return demo;
}

export default function Messagerie() {
  var ctx = useApp();
  var currentUser = ctx.currentUser;
  var users = ctx.users;
  var agents = users.filter(function(u){ return u.role==="agent" && u.actif; });
  var isManager = currentUser.role === "manager";

  var [messages, setMessages] = useState(function() {
    var stored = loadMessages();
    if (stored.length === 0) {
      var demo = initDemoMessages(users);
      saveMessages(demo);
      return demo;
    }
    return stored;
  });
  var [activeChannel, setActiveChannel] = useState("equipe");
  var [input, setInput] = useState("");
  var [search, setSearch] = useState("");
  var bottomRef = useRef(null);

  useEffect(function() {
    if (bottomRef.current) bottomRef.current.scrollIntoView({behavior:"smooth"});
  }, [messages, activeChannel]);

  var channels = [
    { id:"equipe", nom:"Équipe", icon:"👥", subtitle:"Canal général de l'agence", type:"group" },
  ];
  agents.forEach(function(a) {
    var chanId = "priv-"+(isManager?"manager-1":"agent-"+currentUser.id.replace("agent-",""))+"-"+a.id;
    channels.push({ id:chanId, nom:a.nom, icon:a.avatar, subtitle:"Conversation privée", type:"private", agentId:a.id, color:avatarColor(a.nom) });
  });

  function getChannelMessages(chanId) {
    return messages.filter(function(m){ return m.channelId===chanId; }).sort(function(a,b){ return a.ts.localeCompare(b.ts); });
  }

  function getNonLus(chanId) {
    return getChannelMessages(chanId).filter(function(m){ return m.senderId!==currentUser.id && !(m.read||[]).includes(currentUser.id); }).length;
  }

  function sendMessage() {
    if (!input.trim()) return;
    var msg = {
      id: "msg-"+Date.now(),
      channelId: activeChannel,
      senderId: currentUser.id,
      senderNom: currentUser.nom,
      senderAvatar: currentUser.avatar || currentUser.nom.substring(0,2).toUpperCase(),
      content: input.trim(),
      ts: new Date().toISOString(),
      type: "text",
      read: [currentUser.id],
    };
    var updated = [...messages, msg];
    setMessages(updated);
    saveMessages(updated);
    setInput("");
  }

  function markRead(chanId) {
    var updated = messages.map(function(m) {
      if (m.channelId!==chanId || (m.read||[]).includes(currentUser.id)) return m;
      return {...m, read:[...(m.read||[]), currentUser.id]};
    });
    setMessages(updated);
    saveMessages(updated);
  }

  function switchChannel(chanId) {
    setActiveChannel(chanId);
    markRead(chanId);
  }

  var activeChan = channels.find(function(c){ return c.id===activeChannel; }) || channels[0];
  var chanMessages = getChannelMessages(activeChannel);
  var totalNonLus = channels.reduce(function(s,c){ return s + getNonLus(c.id); }, 0);

  function fmtTime(ts) {
    var d = new Date(ts);
    var now = new Date();
    var diff = now - d;
    if (diff < 86400000) return d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    return d.toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"});
  }

  var filteredChannels = channels.filter(function(c) {
    if (!search) return true;
    return c.nom.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div style={{background:"#fff",borderRadius:"var(--r)",border:"1px solid var(--g200)",overflow:"hidden",display:"flex",height:"calc(100vh - 120px)",minHeight:480}}>
      {/* Sidebar channels */}
      <div style={{width:220,borderRight:"1px solid var(--g200)",display:"flex",flexDirection:"column",background:"var(--g50)",flexShrink:0}}>
        <div style={{padding:"10px 12px",borderBottom:"1px solid var(--g200)"}}>
          <div style={{fontWeight:800,color:"var(--navy)",fontSize:13,marginBottom:7,display:"flex",alignItems:"center",gap:7}}>
            {"💬 Messages"}
            {totalNonLus>0 && <span style={{background:"var(--red)",color:"#fff",borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:800}}>{totalNonLus}</span>}
          </div>
          <input value={search} onChange={function(e){setSearch(e.target.value);}} placeholder={"Rechercher…"} style={{width:"100%",border:"1px solid var(--g200)",borderRadius:7,padding:"6px 9px",fontSize:12,outline:"none",background:"#fff"}}/>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"6px 6px"}}>
          <div style={{fontSize:9,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:1.2,padding:"5px 4px 3px"}}>{"Canaux"}</div>
          {filteredChannels.filter(function(c){return c.type==="group";}).map(function(c) {
            var nl = getNonLus(c.id);
            var lastMsg = getChannelMessages(c.id).slice(-1)[0];
            var isActive = activeChannel===c.id;
            return (
              <button key={c.id} onClick={function(){switchChannel(c.id);}} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 9px",width:"100%",border:"none",background:isActive?"#EFF6FF":"transparent",borderRadius:8,cursor:"pointer",textAlign:"left",marginBottom:2,borderLeft:isActive?"3px solid var(--red)":"3px solid transparent"}}>
                <div style={{width:32,height:32,borderRadius:16,background:"var(--red)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{c.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:isActive?800:700,fontSize:12,color:"var(--navy)"}}>{c.nom}</div>
                  {lastMsg && <div style={{fontSize:10,color:"var(--g400)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lastMsg.senderNom.split(" ")[0]+": "+lastMsg.content.slice(0,24)}</div>}
                </div>
                {nl>0 && <span style={{background:"var(--red)",color:"#fff",borderRadius:10,width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,flexShrink:0}}>{nl}</span>}
              </button>
            );
          })}
          <div style={{fontSize:9,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:1.2,padding:"8px 4px 3px"}}>{"Privés"}</div>
          {filteredChannels.filter(function(c){return c.type==="private";}).map(function(c) {
            var nl = getNonLus(c.id);
            var lastMsg = getChannelMessages(c.id).slice(-1)[0];
            var isActive = activeChannel===c.id;
            return (
              <button key={c.id} onClick={function(){switchChannel(c.id);}} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 9px",width:"100%",border:"none",background:isActive?"#EFF6FF":"transparent",borderRadius:8,cursor:"pointer",textAlign:"left",marginBottom:2,borderLeft:isActive?"3px solid var(--red)":"3px solid transparent"}}>
                <div style={{width:32,height:32,borderRadius:16,background:c.color||"var(--navy)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:11,flexShrink:0}}>{c.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:isActive?800:700,fontSize:12,color:"var(--navy)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.nom}</div>
                  {lastMsg && <div style={{fontSize:10,color:"var(--g400)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lastMsg.content.slice(0,28)}</div>}
                </div>
                {nl>0 && <span style={{background:"var(--red)",color:"#fff",borderRadius:10,width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,flexShrink:0}}>{nl}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Zone messages */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        {/* Header */}
        <div style={{padding:"10px 16px",borderBottom:"1px solid var(--g200)",display:"flex",alignItems:"center",gap:10,background:"#fff",flexShrink:0}}>
          <div style={{width:34,height:34,borderRadius:17,background:activeChan.type==="group"?"var(--red)":(activeChan.color||"var(--navy)"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:activeChan.type==="group"?16:13,color:"#fff",fontWeight:800,flexShrink:0}}>{activeChan.icon}</div>
          <div>
            <div style={{fontWeight:800,color:"var(--navy)",fontSize:14}}>{activeChan.nom}</div>
            <div style={{fontSize:11,color:"var(--g400)"}}>{activeChan.subtitle+" · "+chanMessages.length+" message(s)"}</div>
          </div>
        </div>

        {/* Messages */}
        <div style={{flex:1,overflowY:"auto",padding:"14px 16px",background:"#FAFBFC",display:"flex",flexDirection:"column",gap:10}}>
          {chanMessages.length===0 && (
            <div style={{textAlign:"center",padding:"40px 20px",color:"var(--g400)"}}>
              <div style={{fontSize:36,marginBottom:10}}>💬</div>
              <div style={{fontWeight:700,fontSize:14,color:"var(--navy)"}}>{"Aucun message"}</div>
              <div style={{fontSize:12,marginTop:4}}>{"Soyez le premier à écrire !"}</div>
            </div>
          )}
          {chanMessages.map(function(msg) {
            var isMine = msg.senderId === currentUser.id;
            var isSystem = msg.type === "system";
            if (isSystem) {
              return (
                <div key={msg.id} style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,padding:"9px 12px",fontSize:12,color:"#1D4ED8",fontWeight:600,alignSelf:"center",maxWidth:"80%",textAlign:"center"}}>
                  {"🔔 "+msg.content}
                  <div style={{fontSize:10,color:"#60A5FA",marginTop:3}}>{fmtTime(msg.ts)}</div>
                </div>
              );
            }
            return (
              <div key={msg.id} style={{display:"flex",flexDirection:isMine?"row-reverse":"row",gap:8,alignItems:"flex-end"}}>
                {!isMine && (
                  <div style={{width:26,height:26,borderRadius:13,background:avatarColor(msg.senderNom),display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:9,flexShrink:0}}>{msg.senderAvatar||msg.senderNom.substring(0,2).toUpperCase()}</div>
                )}
                <div style={{maxWidth:"70%"}}>
                  {!isMine && <div style={{fontSize:10,color:"var(--g400)",marginBottom:3}}>{msg.senderNom+" · "+fmtTime(msg.ts)}</div>}
                  <div style={{background:isMine?"var(--red)":"#fff",border:isMine?"none":"1px solid var(--g200)",borderRadius:isMine?"14px 14px 3px 14px":"14px 14px 14px 3px",padding:"9px 13px",fontSize:13,color:isMine?"#fff":"var(--navy)",lineHeight:1.5}}>
                    {msg.content}
                  </div>
                  {isMine && <div style={{fontSize:9,color:"var(--g400)",marginTop:2,textAlign:"right"}}>{fmtTime(msg.ts)+" ✓✓"}</div>}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef}></div>
        </div>

        {/* Input */}
        <div style={{padding:"10px 14px",borderTop:"1px solid var(--g200)",background:"#fff",display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
          <input value={input} onChange={function(e){setInput(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}} placeholder={"Écrire un message…"} style={{flex:1,background:"var(--g50)",border:"1px solid var(--g200)",borderRadius:20,padding:"9px 16px",fontSize:13,outline:"none",fontFamily:"var(--font)"}}/>
          <button onClick={sendMessage} disabled={!input.trim()} style={{width:38,height:38,borderRadius:19,background:input.trim()?"var(--red)":"var(--g200)",border:"none",color:"#fff",fontSize:17,cursor:input.trim()?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{"➤"}</button>
        </div>
      </div>
    </div>
  );
}
