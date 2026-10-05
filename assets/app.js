/* ==== JAH global read-aloud controller (one per page): no stacked voices, no orphan audio ==== */
(function(){
if(window.__JAHREAD)return;
var R={audios:[],lastTap:0,lastLabel:""};
R.stopAll=function(){
 try{if(window.speechSynthesis)window.speechSynthesis.cancel();}catch(e){}
 try{if(window.responsiveVoice&&window.responsiveVoice.cancel)window.responsiveVoice.cancel();}catch(e){}
 var i,a;
 for(i=0;i<R.audios.length;i++){a=R.audios[i];try{a.pause();}catch(e){}try{a.removeAttribute("src");}catch(e){}try{a.load();}catch(e){}}
 R.audios.length=0;
 var els=document.querySelectorAll("audio");
 for(i=0;i<els.length;i++){try{els[i].pause();}catch(e){}}
};
R.reg=function(a){if(a&&R.audios.indexOf(a)<0)R.audios.push(a);return a;};
R.playGuard=function(label){
 var now=Date.now();
 if(now-R.lastTap<450&&label===R.lastLabel){R.lastTap=0;R.lastLabel="";R.stopAll();return false;}
 R.lastTap=now;R.lastLabel=String(label||"");
 R.stopAll();return true;
};
try{
 var NativeAudio=window.Audio;
 window.Audio=function(src){var a=src===undefined?new NativeAudio():new NativeAudio(src);R.reg(a);return a;};
 window.Audio.prototype=NativeAudio.prototype;
}catch(e){}
window.__JAHREAD=R;
})();
/* The Signature Mr Fix-It — app.js */
(function(){
"use strict";
var BASE="https://justinahiggins614-cmyk.github.io/signature-fixit/";
var MALL="https://justinahiggins614-cmyk.github.io/signature-cyber-mega-mall/";
var DB={api:null,idx:[],fixes:null,fields:[]};
var myUpFile=null;

/* JAHProfile-aware storage: public = plain localStorage, signed-in = per-profile namespace
   (mirrors the PS adapter on index.html / browse.html; typeof guard keeps public behavior byte-identical) */
var PS=(typeof JAHProfile!=='undefined')?JAHProfile.store:localStorage;
function psGet(k){try{return (typeof PS.get==="function")?PS.get(k):PS.getItem(k);}catch(e){return null;}}
function psSet(k,v){try{if(typeof PS.set==="function")PS.set(k,v);else PS.setItem(k,v);}catch(e){}}
function psDel(k){try{if(typeof PS.remove==="function")PS.remove(k);else PS.removeItem(k);}catch(e){}}

/* ---------- utilities ---------- */
function $(id){return document.getElementById(id);}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function tokens(s){return (s||"").toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(function(w){return w.length>2;});}
function store(k,v){try{if(v===undefined)return JSON.parse(psGet(k)||"null");psSet(k,JSON.stringify(v));}
catch(e){if(e&&/QuotaExceeded/i.test(e.name||"")){window.STORE_FULL=true;showStoreWarn();}return null;}}
function showStoreWarn(){var w=$("storeWarn");if(w)w.classList.remove("hidden");}
function dl(name,text,type){var b=new Blob([text],{type:type||"text/plain"});var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},800);}

/* ---------- theme ---------- */
$("themeBtn").addEventListener("click",function(){
  var d=document.documentElement.getAttribute("data-theme")==="dark";
  psSet("jah-theme",d?"light":"dark");
  document.documentElement.setAttribute("data-theme",d?"":"dark");
});

/* ---------- tabs ---------- */
var tabs={};
document.querySelectorAll(".tab").forEach(function(t){
  tabs[t.dataset.tab]=t;
  t.addEventListener("click",function(){showTab(t.dataset.tab);});
});
function showTab(name){
  /* archive tab moved 2026-10-05: the full Fix Archive A–Z lives on browse.html */
  if(name==="archive"){location.href="browse.html";return;}
  document.querySelectorAll(".tab").forEach(function(t){t.setAttribute("aria-selected",t.dataset.tab===name?"true":"false");});
  ["finder","cam","ask","mine"].forEach(function(s){var el=$("sec-"+s);if(el)el.classList.toggle("hidden",s!==name);});
  var rec=$("sec-record");if(rec)rec.classList.add("hidden");
  if(name==="mine")renderMine();
}
var bb=$("backBtn");if(bb)bb.addEventListener("click",function(){location.href="browse.html";});

/* ---------- tiered TTS: speechSynthesis -> Google TTS hosts ---------- */
var TTS={speaking:false,
  chunk:function(t){var out=[],s=String(t);while(s.length>200){var i=s.lastIndexOf(". ",200);if(i<0)i=s.lastIndexOf(" ",200);if(i<0)i=200;out.push(s.slice(0,i+1));s=s.slice(i+1);}if(s.trim())out.push(s);return out;},
  speak:function(text,onend){
    if(window.__JAHREAD&&!window.__JAHREAD.playGuard("speak"))return false;
    this.stop();
    var chunks=this.chunk(text),self=this,ci=0;
    self.speaking=true;
    function done(){ci++;if(ci<chunks.length&&self.speaking){play();}else{self.speaking=false;if(onend)onend();}}
    function play(){
      var u=new SpeechSynthesisUtterance(chunks[ci]);
      u.lang="en-US";u.rate=1;
      try{
        var vs=speechSynthesis.getVoices().filter(function(v){return v.lang&&v.lang.toLowerCase().indexOf("en-us")===0;});
        var fem=vs.filter(function(v){return /female|samantha|zira|aria|jenny/i.test(v.name);});
        if(fem.length)u.voice=fem[0];else if(vs.length)u.voice=vs[0];
      }catch(e){}
      var played=false;
      u.onend=function(){played=true;done();};
      u.onerror=function(){if(!played)gTTS();};
      try{speechSynthesis.speak(u);}catch(e){gTTS();return;}
      setTimeout(function(){if(!played&&self.speaking){try{speechSynthesis.cancel();}catch(e){} gTTS();}},4000);
    }
    var hosts=["https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=",
               "https://translate.google.co.uk/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q="];
    var hi=0,aud=null;
    function gTTS(){
      if(hi>=hosts.length){self.speaking=false;if(onend)onend();return;}
      try{if(aud){aud.pause();} }catch(e){}
      aud=new Audio(hosts[hi]+encodeURIComponent(chunks[ci]));
      aud.onended=done;aud.onerror=function(){hi++;gTTS();};
      var p=aud.play();if(p&&p.catch)p.catch(function(){hi++;gTTS();});
    }
    play();
    return true;
  },
  stop:function(){try{if(window.__JAHREAD)window.__JAHREAD.stopAll();}catch(e){}this.speaking=false;try{speechSynthesis.cancel();}catch(e){}}
};
function readAloud(text){if(window.__JAHREAD&&!window.__JAHREAD.playGuard("readAloud"))return;TTS.speak(text);}
/* One global audio controller for read-aloud buttons: play() stops current audio
   first; the button shows Reading... then Stop, and restores its label when done. */
function wireSpeak(btn,textFn){
  var B=typeof btn==="string"?$(btn):btn;if(!B||!B.addEventListener)return;
  var orig=B.textContent;
  B.addEventListener("click",function(){
    var wasSpeaking=TTS.speaking;
    TTS.stop(); /* one controller: play() always stops current audio first */
    B.textContent=orig;
    if(wasSpeaking)return; /* toggle off */
    B.textContent="Reading\u2026";
    var ok=false;
    try{ok=TTS.speak(textFn(),function(){B.textContent=orig;});}catch(e){ok=false;}
    B.textContent=ok?"\u23F9 Stop":orig;
  });
}

/* ---------- data loading ---------- */
function gz(url,cb){
  fetch(url).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.arrayBuffer();})
  .then(function(buf){
    if(window.DecompressionStream){
      var ds=new DecompressionStream("gzip");
      var w=ds.writable.getWriter();w.write(buf);w.close();
      return new Response(ds.readable).text();
    }
    throw new Error("no gzip support");
  }).then(cb).catch(function(e){cb(null,e);});
}
function loadAll(cb){
  fetch("api.json").then(function(r){return r.json();}).then(function(api){
    DB.api=api;DB.fields=api.fields||[];
    $("stFixes").textContent=(api.total_fixes||0).toLocaleString();
    $("stFields").textContent=DB.fields.length;
    $("stUpd").textContent=api.updated||"—";
    var sel=$("fieldOverride");
    DB.fields.forEach(function(f){var o=document.createElement("option");o.value=f.name;o.textContent=f.name+" ("+f.count+")";sel.appendChild(o);});
    var chips=$("fieldChips");
    if(chips){
    var all=document.createElement("button");all.className="fchip";all.innerHTML="<b>All fields</b>";
    all.addEventListener("click",function(){location.href="browse.html";});
    chips.appendChild(all);
    DB.fields.forEach(function(f){var b=document.createElement("button");b.className="fchip";b.innerHTML="<b>"+esc(f.name)+"</b><small>"+f.count+" fixes</small>";
      b.addEventListener("click",function(){location.href="browse.html?field="+encodeURIComponent(f.name);});chips.appendChild(b);});
    }
    gz("data/index/fixes.idx.json.gz",function(txt,err){
      if(txt){DB.idx=txt.split("\n").filter(Boolean).map(function(l){try{return JSON.parse(l);}catch(e){return null;}}).filter(Boolean);}
      fetch("data/fixes.jsonl").then(function(r){return r.text();}).then(function(t){
        DB.fixes=t.split("\n").filter(Boolean).map(function(l){try{return JSON.parse(l);}catch(e){return null;}}).filter(Boolean);
        if(cb)cb();
      }).catch(function(){if(cb)cb();});
    });
  }).catch(function(){if(cb)cb();});
}
function fixById(id){if(!DB.fixes)return null;for(var i=0;i<DB.fixes.length;i++)if(DB.fixes[i].id===id)return DB.fixes[i];return null;}

/* ---------- field detection ---------- */
var FIELD_KW={
"Plumbing":["faucet","drip","leak","toilet","drain","clog","pipe","sink","shower","flush","sewer","sump","water heater","spigot","plumb","gurgle"],
"Electrical":["outlet","breaker","switch","wire","wiring","gfci","fuse","voltage","dimmer","doorbell","electrical","sparking","socket","circuit"],
"Heating & Cooling":["furnace","ac ","air conditioner","thermostat","heat pump"," hvac","vents","pilot light","condensate","air filter"],
"Appliances":["fridge","refrigerator","washer","dryer","dishwasher","oven","microwave","freezer","stove","ice maker","range hood","appliance"],
"Automotive":["car ","battery","tire","brakes","engine","headlight","wiper","key fob","transmission","alternator","radiator","oil "],
"Computers & Cyber":["computer","laptop","pc ","wifi","printer","malware","virus","monitor","keyboard","boot","blue screen","hard drive","browser","email hacked","software"],
"Phones & Tablets":["phone","tablet","screen cracked","charger","battery drain","touchscreen","iphone","android","signal bars","speaker"],
"Home Repair":["drywall","door ","window","paint","floor","cabinet","drawer","gutter","deck","fence","lock ","tile","caulk"],
"Vintage Electronics":["vcr","vhs","crt","turntable","cassette","radio","tube amp","betamax","laserdisc","tracking"],
"Chips & Circuit Boards":["capacitor","solder","pcb","circuit board","chip ","voltage regulator","trace ","oscillator","microcontroller","resistor"],
"Small Engines & Tools":["chainsaw","mower","drill","compressor","generator","pressure washer","trimmer","nail gun","sander"],
"Lawn & Outdoor":["sprinkler","hose","grill","pavers","lawn","leaf blower","fence gate","wheelbarrow","pruning"]
};
function detectField(text){
  var t=" "+text.toLowerCase()+" ",scores={};
  Object.keys(FIELD_KW).forEach(function(f){scores[f]=0;FIELD_KW[f].forEach(function(k){if(t.indexOf(k.toLowerCase())>=0)scores[f]++;});});
  var best="",bv=0,tot=0;
  Object.keys(scores).forEach(function(f){tot+=scores[f];if(scores[f]>bv){bv=scores[f];best=f;}});
  return {field:best,score:bv,conf:tot>0?Math.round(100*bv/tot):0};
}
var probEl=$("probText");
probEl.addEventListener("input",function(){
  var d=detectField(probEl.value);
  $("fieldDetect").innerHTML=d.score>0
    ?"Detected field: <b>"+esc(d.field)+"</b> · confidence "+d.conf+"% · <span class='note'>override with the dropdown if wrong</span>"
    :"Field detection runs when you type.";
  probEl._det=d;
});

/* ---------- matching ---------- */
function scoreFix(text,rec){
  var wt=tokens(text),hay=(rec.title+" "+rec.symptoms.join(" ")+" "+rec.diagnosis.join(" ")).toLowerCase();
  var s=0;wt.forEach(function(w){if(hay.indexOf(w)>=0)s+=w.length>5?2:1;});
  return s;
}
function findFixes(text,n){
  if(!DB.fixes)return [];
  return DB.fixes.map(function(r){return{r:r,s:scoreFix(text,r)};})
    .filter(function(x){return x.s>0;}).sort(function(a,b){return b.s-a.s;}).slice(0,n||3).map(function(x){return x.r;});
}

/* ---------- SVG flow diagram (client-side generated) ---------- */
function flowSVG(rec){
  var steps=["Problem",rec.title];
  var boxes=[["PROBLEM",rec.title],["DIAGNOSE",rec.diagnosis.length+" checks"],["FIX",rec.solutions[0].title],["VERIFY","Test & confirm"]];
  var W=760,bw=160,bh=64,gap=26,x0=10,y=20,svg="";
  boxes.forEach(function(b,i){
    var x=x0+i*(bw+gap);
    var col=i===0?"#ff8c1a":i===3?"#37c978":"#2c3542";
    svg+='<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+bh+'" rx="10" fill="#141920" stroke="'+col+'" stroke-width="2"/>';
    svg+='<text x="'+(x+bw/2)+'" y="'+(y+22)+'" fill="'+col+'" font-size="11" font-weight="bold" text-anchor="middle">'+esc(b[0])+"</text>";
    var label=b[1].length>26?b[1].slice(0,25)+"…":b[1];
    svg+='<text x="'+(x+bw/2)+'" y="'+(y+44)+'" fill="#f2f4f7" font-size="11" text-anchor="middle">'+esc(label)+"</text>";
    if(i<boxes.length-1)svg+='<line x1="'+(x+bw)+'" y1="'+(y+bh/2)+'" x2="'+(x+bw+gap)+'" y2="'+(y+bh/2)+'" stroke="#ff8c1a" stroke-width="2" marker-end="url(#ah)"/>';
  });
  return '<div class="diagram" role="img" aria-label="Fix flow diagram"><svg width="'+(x0+4*(bw+gap))+'" height="110" viewBox="0 0 '+(x0+4*(bw+gap))+' 110"><defs><marker id="ah" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="#ff8c1a" stroke-width="2"/></marker></defs>'+svg+"</svg></div>";
}

/* ---------- safety banner ---------- */
function safetyHTML(rec){
  var cls=rec.safety==="HIGH"?"high":rec.safety==="MEDIUM"?"med":"low";
  var head=rec.safety==="HIGH"?"⚠ HIGH SAFETY — READ BEFORE YOU TOUCH ANYTHING":rec.safety==="MEDIUM"?"⚠ MEDIUM SAFETY":"✓ LOW SAFETY";
  var h='<div class="safety '+cls+'" role="alert"><b>'+head+"</b><ul>";
  rec.warnings.forEach(function(w){h+="<li>"+esc(w)+"</li>";});
  h+="</ul>";
  if(rec.safety==="HIGH")h+="<p><b>When in doubt, call a licensed professional.</b> This guide is generated guidance, not certified advice.</p>";
  return h+"</div>";
}
function badges(rec){
  return '<span class="badge b-'+rec.safety.toLowerCase()+'">'+rec.safety+" SAFETY</span>"+
    '<span class="badge b-diy">'+esc(rec.difficulty).toUpperCase()+"</span>"+
    '<span class="badge b-pro">'+esc(rec.field).toUpperCase()+"</span>";
}

/* ---------- finder ---------- */
/* ---------- upload validation: human-readable, never silent ---------- */
var MAX_UPLOAD_MB=100;
function validateUpload(f){
  if(!f)return{ok:false,msg:"No file was chosen."};
  var mb=f.size/1048576;
  if(f.size>MAX_UPLOAD_MB*1048576)
    return{ok:false,msg:"That file is "+mb.toFixed(0)+" MB — too large to preview on this device (limit "+MAX_UPLOAD_MB+" MB). Try a shorter video or a smaller photo."};
  var t=f.type||"";
  if(t&&t.indexOf("image/")!==0&&t.indexOf("video/")!==0)
    return{ok:false,msg:"“"+f.name+"” isn't a photo or video ("+(t||"unknown type")+") — only image and video files can be attached."};
  return{ok:true,msg:""};
}
$("upFile").addEventListener("change",function(e){
  var f=e.target.files[0];myUpFile=null;
  var st=$("upStatus"),pv=$("upPreview");pv.innerHTML="";
  if(!f){st.textContent="No file attached.";return;}
  var chk=validateUpload(f);
  if(!chk.ok){st.textContent="⚠ "+chk.msg;$("upFile").value="";return;}
  myUpFile=f;
  var mb=(f.size/1048576).toFixed(1);
  st.textContent="Attached: "+f.name+" · "+(f.type||"file")+" · "+mb+" MB — stored on your device only, never uploaded.";
  function badPrev(){st.textContent="⚠ That file looks damaged — the preview couldn't load it. The file may be corrupted; try a different photo or video.";pv.innerHTML="";myUpFile=null;$("upFile").value="";}
  if(f.type.indexOf("image/")===0){var im=document.createElement("img");im.style.maxWidth="100%";im.style.borderRadius="8px";im.alt="Uploaded problem photo";im.onerror=badPrev;im.src=URL.createObjectURL(f);pv.appendChild(im);}
  else if(f.type.indexOf("video/")===0){var v=document.createElement("video");v.style.maxWidth="100%";v.controls=true;v.onerror=badPrev;v.src=URL.createObjectURL(f);pv.appendChild(v);}
  else{st.textContent+=" (no preview available for this file type — describe it in the box above.)";}
});
function aiReviewNote(){
  if(!myUpFile)return "";
  var mb=(myUpFile.size/1048576).toFixed(1);
  return '<div class="detect"><b>AI review note:</b> you attached <b>'+esc(myUpFile.name)+'</b> ('+esc(myUpFile.type||"unknown type")+'). '+
    "On-device analysis only — describe what the photo/video shows (colors, damage, location) in the box above for the most accurate match. The file never leaves your device.</div>";
}
$("goFix").addEventListener("click",function(){
  var text=probEl.value.trim();
  if(text.length<4){$("fixResult").innerHTML='<div class="card"><p>Describe the problem first — a few words is enough.</p></div>';return;}
  var det=probEl._det||detectField(text);
  var field=$("fieldOverride").value||det.field;
  var matches=findFixes(text,3).filter(function(r){return !field||r.field===field;});
  var html='<div class="card"><h2>Your fix plan</h2>';
  html+='<p>Detected field: <b>'+esc(field||"General")+"</b>"+(det.score>0&&!$("fieldOverride").value?" · confidence "+det.conf+"%":"")+"</p>";
  html+=aiReviewNote();
  if(matches.length){
    var rec=matches[0];
    html+='<p><span class="badge b-diy">ARCHIVE RECORD</span> Best match: <a href="'+rec.canonical_url+'"><b>'+esc(rec.title)+"</b></a> ("+rec.id+")</p>";
    html+=safetyHTML(rec)+badges(rec);
    html+=flowSVG(rec);
    html+=solutionsHTML(rec,true);
    if(matches.length>1){html+="<h3>Also relevant</h3><ul>";matches.slice(1).forEach(function(r){html+='<li><a href="'+r.canonical_url+'">'+esc(r.title)+"</a> ("+r.id+")</li>";});html+="</ul>";}
    markAttempt(rec.id);
    html+='<div class="toolbar"><button class="btn ghost small" onclick="openFix(\''+rec.id+'\')">Open full record</button>'+
      '<button class="btn ghost small" onclick="loadCamSteps(\''+rec.id+'\')">🎥 Walk me through with Live Fix Cam</button></div>';
  }else{
    html+='<p><span class="badge b-med">GENERATED GUIDANCE</span> No archived record matches closely — this is general guidance for <b>'+esc(field||"general repair")+"</b>, not an archive record.</p>";
    html+=genericGuide(field);
    html+='<p class="note">Tip: try the Archive tab — '+DB.fixes.length+' records and counting. Or use the web search below.</p>';
    html+='<div class="toolbar"><button class="btn ghost small" onclick="webSearch(\''+esc(text.replace(/'/g,""))+'\')">🌐 Search the web for this fix</button></div>';
  }
  html+='<p class="note">Fix records below are generated guidance, not certified professional advice — check the safety banner on each record.</p>';
  html+="</div>";
  $("fixResult").innerHTML=html;
  $("fixResult").scrollIntoView({behavior:"smooth",block:"start"});
});
function genericGuide(field){
  return '<div class="sol"><b>1 · Diagnose safely</b><ol><li>Write down exactly what happens and when.</li><li>Check the simplest causes first (power, connections, settings, clogs).</li><li>Look up the model number before ordering parts.</li></ol></div>'+
  '<div class="sol"><b>2 · Best options, ranked</b><ol><li><b>DIY fix</b> — cheapest if you have the tools and the safety level is LOW.</li><li><b>Professional repair</b> — for MEDIUM/HIGH safety or special tools.</li><li><b>Replace</b> — when repair costs approach replacement.</li><li><b>Mall</b> — check the <a href="'+MALL+'">Signature Cyber Mega-Mall</a> free catalog for a replacement.</li></ol></div>'+
  safetyHTML({safety:"MEDIUM",warnings:["If this involves electricity, gas, or structural work, stop and call a licensed professional."]});
}
function solutionsHTML(rec,compact){
  var h="";
  var kinds={"DIY_FIX":["b-diy","🔧"],"PRO_REPAIR":["b-pro","👷"],"REPLACE":["b-rep","🔁"],"MALL":["b-mall","🎁 FREE"]};
  rec.solutions.forEach(function(s){
    var k=kinds[s.kind]||["b-diy","🔧"];
    h+='<div class="sol rank'+s.rank+'"><span class="badge '+k[0]+'">'+k[1]+" OPTION "+s.rank+" · "+s.kind.replace(/_/g," ")+"</span> <b>"+esc(s.title)+"</b>";
    if(s.steps){h+="<ol>";s.steps.forEach(function(st){h+="<li>"+esc(st)+"</li>";});h+="</ol>";}
    if(s.note)h+='<p class="note">'+esc(s.note)+"</p>";
    if(s.kind==="DIY_FIX")h+='<p class="note">Difficulty '+esc(s.difficulty)+" · "+esc(s.time)+" · "+esc(s.cost)+"</p>";
    if(s.kind==="DIY_FIX"&&(s.tools||[]).length)h+='<p class="note"><b>Tools:</b> '+esc(s.tools.join(", "))+"</p>";
    if(s.kind==="DIY_FIX"&&(s.parts||[]).length)h+='<p class="note"><b>Parts:</b> '+esc(s.parts.join(", "))+"</p>";
    if(s.url)h+='<p><a class="btn small" href="'+esc(s.url)+'" target="_blank" rel="noopener">🎁 Open in the Mega-Mall (free catalog)</a></p>';
    h+="</div>";
  });
  return h;
}
function webSearch(q){window.open("https://www.google.com/search?q="+encodeURIComponent(q+" fix how to repair"),"_blank");}
$("goCam").addEventListener("click",function(){showTab("cam");});

/* ---------- record view ---------- */
function openFix(id){
  var r=fixById(id);if(!r)return;
  showTab("finder");
  ["finder","cam","ask","mine"].forEach(function(s){var el=$("sec-"+s);if(el)el.classList.add("hidden");});
  document.querySelectorAll(".tab").forEach(function(t){t.setAttribute("aria-selected","false");});
  var sec=$("sec-record");sec.classList.remove("hidden");
  var prog=store("fixit_my")||{};var mine=prog[id]||{steps:{}};
  var h='<div class="card"><span class="fid" style="color:var(--acc);font-weight:700">'+r.id+'</span> '+badges(r);
  h+="<h2>"+esc(r.title)+"</h2>";
  h+=safetyHTML(r);
  h+='<dl class="kv"><dt>Field</dt><dd>'+esc(r.field)+" ("+r.field_id+")</dd><dt>Version</dt><dd>v"+r.version+" · "+r.status+'</dt><dt>Content hash</dt><dd><code style="font-size:.75rem">'+r.content_hash.slice(0,20)+"…</code></dd><dt>Canonical URL</dt><dd><a href='"+r.canonical_url+"'>"+r.id+"</a></dd></dl>";
  h+="<h3>Symptoms</h3><ul>";r.symptoms.forEach(function(s){h+="<li>"+esc(s)+"</li>";});h+="</ul>";
  h+="<h3>Diagnosis — check these in order</h3><ol class='steps'>";
  r.diagnosis.forEach(function(s,i){var done=mine.steps["d"+i]?"done":"";h+='<li class="'+done+'"><input type="checkbox" class="stepchk" data-k="d'+i+'" '+(done?"checked":"")+' aria-label="Mark diagnosis step '+(i+1)+' done">'+esc(s)+"</li>";});
  h+="</ol>"+flowSVG(r);
  h+="<h3>Solutions — best option first</h3>"+solutionsHTML(r);
  h+="<h3>Ask the Fix-It AI about this fix</h3><p class='note'>Grounded in this record. It never invents fixes.</p>";
  h+='<div class="toolbar"><button class="btn small" id="rcRead">🔊 Read aloud</button><button class="btn ghost small" id="rcCopy">⧉ Copy record</button><button class="btn ghost small" id="rcJson">⬇ JSON</button><button class="btn ghost small" id="rcTxt">⬇ TXT</button><button class="btn ghost small" id="rcDone">✓ Mark fixed</button></div>';
  h+='<details class="guide"><summary>Raw JSON record</summary><pre class="json">'+esc(JSON.stringify(r,null,1))+"</pre></details>";
  h+="</div>";
  $("recordBody").innerHTML=h;
  try{history.replaceState(null,"","?fix="+id);}catch(e){}
  $("recordBody").querySelectorAll(".stepchk").forEach(function(c){
    c.addEventListener("change",function(){
      var p=store("fixit_my")||{};p[id]=p[id]||{steps:{},status:"attempted",updated:Date.now()};
      p[id].steps[c.dataset.k]=c.checked;p[id].status="attempted";
      store("fixit_my",p);c.closest("li").classList.toggle("done",c.checked);
    });
  });
  wireSpeak($("rcRead"),function(){return recordSpeech(r);});
  $("rcCopy").addEventListener("click",function(){navigator.clipboard.writeText(recordText(r)).then(function(){alert("Record copied.");});});
  $("rcJson").addEventListener("click",function(){dl(r.id+".json",JSON.stringify(r,null,1),"application/json");});
  $("rcTxt").addEventListener("click",function(){dl(r.id+".txt",recordText(r));});
  $("rcDone").addEventListener("click",function(){markDone(id);alert("Marked as fixed. Nice work! 🔧");});
  sec.scrollIntoView({behavior:"smooth"});
  markAttempt(id);
}
function recordText(r){
  var t="THE SIGNATURE MR FIX-IT — "+r.id+"\n"+r.title+"\nField: "+r.field+" | Safety: "+r.safety+" | Difficulty: "+r.difficulty+"\n\nSYMPTOMS:\n- "+r.symptoms.join("\n- ")+"\n\nDIAGNOSIS:\n";
  r.diagnosis.forEach(function(s,i){t+=(i+1)+". "+s+"\n";});
  t+="\nSOLUTIONS (best first):\n";
  r.solutions.forEach(function(s){t+="\n["+s.kind+"] "+s.title+"\n";(s.steps||[]).forEach(function(st,i){t+="  "+(i+1)+". "+st+"\n";});if(s.url)t+="  Link: "+s.url+"\n";});
  t+="\nSAFETY: "+r.safety+"\n- "+r.warnings.join("\n- ")+"\n\n"+r.canonical_url;
  return t;
}
function recordSpeech(r){
  return r.title+". Field: "+r.field+". Safety level "+r.safety+". Symptoms: "+r.symptoms.join(". ")+
   ". Diagnosis: "+r.diagnosis.join(". ")+". Recommended fix: "+r.solutions[0].title+". "+r.solutions[0].steps.join(". ")+
   ". Safety warnings: "+r.warnings.join(". ");
}
function markAttempt(id){var p=store("fixit_my")||{};if(!p[id]){p[id]={status:"attempted",steps:{},updated:Date.now()};store("fixit_my",p);}}
function markDone(id){var p=store("fixit_my")||{};p[id]=p[id]||{steps:{}};p[id].status="completed";p[id].updated=Date.now();store("fixit_my",p);}

/* ---------- live fix cam ---------- */
var camStream=null;
function camErrMsg(e){
  var n=(e&&(e.name||""))||"";
  if(n==="NotAllowedError"||n==="SecurityError")
    return "Camera permission was denied — the Fix-It can't see anything. Tap your browser's site settings (lock icon in the address bar) and allow the camera, then try again.";
  if(n==="NotFoundError"||n==="OverconstrainedError")
    return "No camera was found on this device. You can still use the Fix Finder — describe the problem or upload a photo instead.";
  if(n==="NotReadableError"||n==="AbortError")
    return "The camera is busy in another app or temporarily unavailable. Close other camera apps and try again.";
  return "Camera couldn't start ("+n+"). Check your browser's camera permission and try again.";
}
$("camStart").addEventListener("click",function(){
  var v=$("camVideo");
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){$("camStatus").textContent="Camera not supported in this browser. You can still use the Fix Finder — describe the problem or upload a photo instead.";return;}
  navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false}).then(function(s){
    camStream=s;v.srcObject=s;v.play();$("camStatus").textContent="Live — feed stays on this device, nothing is recorded or uploaded.";
  }).catch(function(e){$("camStatus").textContent=camErrMsg(e);});
});
$("camStop").addEventListener("click",function(){
  if(camStream){camStream.getTracks().forEach(function(t){t.stop();});camStream=null;$("camVideo").srcObject=null;}
  $("camStatus").textContent="Camera off.";
});
function loadCamSteps(id){
  var r=fixById(id);if(!r)return;
  showTab("cam");
  var h="<h4>"+esc(r.title)+" <span class='note'>"+r.id+"</span></h4><ol class='steps'>";
  r.diagnosis.concat(r.solutions[0].steps).forEach(function(s,i){h+="<li>"+esc(s)+"</li>";});
  h+="</ol>";
  $("camSteps").innerHTML=h;
}

/* ---------- Ask the Fix-It AI (grounded) ---------- */
function aiAnswer(q){
  /* v2.1: social + ecosystem chat goes through the conversational engine
     (with memory). Fix questions stay 100% on the archive path below —
     the AI never invents a fix. */
  var qt = ' ' + String(q || '').toLowerCase() + ' ';
  var fixy = /(fix|repair|broken|broke|not working|won't |wont |leak|clog|replace|install|toilet|faucet|sink|wire|wiring|engine|motor|screen|crack|battery|charge|overheat|noise|rattle|smell|smoke|stain|dent|door|window|lock|hinge|pipe|drain|pump|fan|belt|blade|filter|screw|nail|paint|tile|roof|gutter)/.test(qt);
  if (!fixy && typeof JAHtalk !== 'undefined'){
    try{
      var FP = {name: 'Mr Fix-It AI', id: 'JAH-FIX-AI',
        description: 'The Mr Fix-It AI. I find fixes in the fix archive and walk you through them step by step.',
        abilities: ['Find fixes in the fix archive', 'Walk through repairs step by step', 'Track your fix progress on this device', 'Point you around the JAH network'],
        domain: 'repair and fixing', kind: 'domain'};
      var fr = JAHtalk.chatFor(FP, 'fixit-ask').reply(q);
      if (fr) return '<div class="msg a">' + esc(fr) + '<span class="src">Source: on-device chat</span></div>';
    }catch(e){}
  }
  var hits=findFixes(q,3);
  var p=store("fixit_my")||{};
  var done=Object.keys(p).filter(function(k){return p[k].status==="completed";}).length;
  var progNote=done>0?" You have completed "+done+" fix"+(done>1?"es":"")+" on this device.":"";
  if(hits.length){
    var r=hits[0],h='<div class="msg a"><b>ARCHIVE RECORD — '+r.id+"</b><br>"+esc(r.title)+
      "<br><b>Fix:</b> "+esc(r.solutions[0].title)+" — "+esc(r.solutions[0].steps[0])+
      "<br><b>Safety:</b> "+r.safety+". <b>Difficulty:</b> "+esc(r.difficulty)+"."+
      "<br><a href='"+r.canonical_url+"'>Open the full record</a>."+esc(progNote)+
      "<span class='src'>Source: fix archive · "+r.id+" · v"+r.version+"</span></div>";
    if(hits.length>1)h+='<div class="msg a">Also in the archive: '+hits.slice(1).map(function(x){return '<a href="'+x.canonical_url+'">'+esc(x.title)+"</a>";}).join(" · ")+'<span class="src">Source: fix archive</span></div>';
    return h;
  }
  return '<div class="msg a"><b>NOT FOUND</b> — no archived fix matches that closely.'+esc(progNote)+
    '<br>Try the Archive tab, or use <b>🌐 Search the web</b> below — web findings are labeled <span class="online-tag">ONLINE RESULT</span>.'+
    '<span class="src">Source: none in archive</span></div>';
}
$("chatSend").addEventListener("click",function(){
  var q=$("chatIn").value.trim();if(!q)return;
  $("chatLog").innerHTML+='<div class="msg u">'+esc(q)+"</div>";
  $("chatLog").innerHTML+=aiAnswer(q);
  $("chatIn").value="";$("chatLog").scrollTop=$("chatLog").scrollHeight;
});
$("chatIn").addEventListener("keydown",function(e){if(e.key==="Enter")$("chatSend").click();});
$("webSearchBtn").addEventListener("click",function(){
  var q=$("chatIn").value.trim()||"home repair";
  window.open("https://www.google.com/search?q="+encodeURIComponent(q+" fix how to repair"),"_blank");
  $("chatLog").innerHTML+='<div class="msg a"><span class="online-tag">ONLINE RESULT</span> Web search opened in a new tab. Paste anything useful you find back here and I will treat it as an <span class="online-tag">ONLINE RESULT</span> — separate from archive records.<span class="src">Source: web search (user-provided)</span></div>';
});

/* ---------- My Fixes ---------- */
function renderMine(){
  var p=store("fixit_my")||{},ids=Object.keys(p).sort(function(a,b){return(p[b].updated||0)-(p[a].updated||0);});
  var el=$("myList");
  if(!ids.length){el.innerHTML='<p class="note">No fixes yet. Open any fix record and work through its steps — your progress saves here automatically.</p>';return;}
  var h="<ul>";
  ids.forEach(function(id){
    var r=fixById(id),t=r?r.title:"(record not loaded)";
    var st=p[id].status==="completed"?"✓ Completed":"● Attempted";
    h+='<li>'+st+' — <a href="'+(r?r.canonical_url:"#")+'">'+esc(t)+"</a> <span class='note'>"+id+"</span></li>";
  });
  el.innerHTML=h+"</ul>";
}
$("expMy").addEventListener("click",function(){dl("fixit-my-data.json",JSON.stringify(store("fixit_my")||{},null,1),"application/json");});
$("clrMy").addEventListener("click",function(){if(confirm("Clear all local fix progress on this device?")){psDel("fixit_my");renderMine();}});
$("impBtn").addEventListener("click",function(){$("impFile").click();});
$("impFile").addEventListener("change",function(e){
  var f=e.target.files[0];if(!f)return;
  var rd=new FileReader();
  rd.onload=function(){
    try{
      var data=JSON.parse(rd.result);
      if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("not an object");
      var ids=Object.keys(data).filter(function(k){return/^JAH-FIX-\d+$/.test(k);});
      if(!ids.length)throw new Error("no JAH-FIX records found");
      var p=store("fixit_my")||{};
      ids.forEach(function(k){p[k]=data[k];});
      store("fixit_my",p);renderMine();
      alert("Imported "+ids.length+" fix record"+(ids.length>1?"s":"")+" into My Fixes.");
    }catch(err){alert("Couldn't import that file — it doesn't look like a Mr Fix-It backup ("+err.message+"). Export creates a valid one.");}
    $("impFile").value="";
  };
  rd.onerror=function(){alert("Couldn't read that file — it may be damaged. Try exporting a fresh backup first.");};
  rd.readAsText(f);
});

/* ---------- TOUR: centered welcome overlay (no auto-scroll, no spotlight). localStorage jah-tour-seen-fixit ----------
   Null-safe wiring: a missing element must never kill the other buttons. */
function tourSeen(){return psGet("jah-tour-seen-fixit")==="1";}
function tourMark(){psSet("jah-tour-seen-fixit","1");}
function tourOpen(){var o=$("tourOver");if(!o)return;o.classList.add("open");o.setAttribute("aria-hidden","false");}
function tourClose(){var o=$("tourOver");if(o){o.classList.remove("open");o.setAttribute("aria-hidden","true");}tourMark();}
function wireT(id,fn){var b=$(id);if(b&&fn)b.addEventListener("click",fn);}
wireT("tourOk",tourClose);
wireT("tourHelp",function(){tourClose();var g=$("guidePanel");if(g)g.classList.remove("hidden");});
(function(){var o=$("tourOver");if(o)o.addEventListener("click",function(e){if(e.target===o)tourClose();});})();
document.addEventListener("keydown",function(e){var o=$("tourOver");if(e.key==="Escape"&&o&&o.classList.contains("open"))tourClose();});
/* ? Guide button re-opens the welcome guide */
wireT("guideBtn",function(){var g=$("guidePanel");if(g)g.classList.add("hidden");tourOpen();});
wireT("replayTour",function(){var g=$("guidePanel");if(g)g.classList.add("hidden");tourOpen();});
/* first visit: welcome overlay */
setTimeout(function(){if(!tourSeen())tourOpen();},900);

/* ---------- init / deep links ---------- */
window.openFix=openFix;window.loadCamSteps=loadCamSteps;window.webSearch=webSearch;
loadAll(function(){
  var m=/[?&]fix=(JAH-FIX-\d+)/i.exec(location.search);
  if(m&&m[1]){openFix(m[1].toUpperCase());}
  else{var qm=/[?&]q=([^&]+)/.exec(location.search);if(qm){location.href="browse.html?q="+encodeURIComponent(decodeURIComponent(qm[1]));}}
});
})();
