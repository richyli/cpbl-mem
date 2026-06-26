/* ============================================================
   中職會員 Conjoint — 前端邏輯（含七條品質檢核）
   SoT：wiki/conjoint_webform_quality_checks.md
   - 屬性順序：受訪者間隨機、受訪者內固定（attrOrder）
   - 水準：每輪兩卡各屬性即時隨機；避免支配組合 + 完全相同 + 同質媒體
   - 呈現序列：8 正式輪 + 1 trap（第1輪後）+ 1 repeat（鏡像，避開第1輪）
   - 記錄：rtMs / leftRatio / trap_pass / rep_consistent
   - 呈現的 profile 直接寫入資料 → 記錄與呈現天然一致
   ============================================================ */

const A = CONFIG.attributes;          // 6 屬性
const NROUND = CONFIG.ROUNDS;         // 8 正式輪
const MEDIA_KEY = "media";
const state = {
  s1:null, team:null,
  attrOrder:null,        // 本受訪者屬性顯示順序（A 的 index 陣列）
  seq:[],                // 呈現序列：{type:'cbc'|'trap'|'rep', ...}
  pos:0,                 // 目前在 seq 的位置
  scales:{}, marker:null, demo:{},
  leftCount:0, trialCount:0, abCount:0,
  startTs:Date.now(), qStartTs:0,
  gateEnd:0, gateTimer:null,   // 每題最短秒數倒數鎖
};

/* ---------- 工具 ---------- */
function go(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
}
function shuffle(arr){
  const a=arr.slice();
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function randLevel(i){ return Math.floor(Math.random()*A[i].levels.length); }
// 量表文字把「這支球隊」代入受訪者選的隊名
function teamize(txt){ return state.team ? txt.replace(/這支球隊/g, state.team) : txt; }
const mediaIdx = A.findIndex(a=>a.key===MEDIA_KEY);
const priceIdx = A.findIndex(a=>a.key==='price');

/* 有「無」水準的屬性（index 0 = 無 X）：折扣/購票/贈品/主場。
   價格無「無」；media 的 index 0 是「賽後戰報」非「無」→ 皆排除。 */
const noneAttrs = A.map((_,i)=>i).filter(i=>/^無/.test(A[i].levels[0].label));

/* 產生一輪兩 profile（level index 陣列）。
   核心規則（強制 trade-off）：每張卡恰好一個屬性是「無」水準，
   且左右兩卡的「無」落在不同屬性 → 兩卡各有一弱點、互有優劣，避免一卡全面較好。
   其餘屬性抽非「無」水準（index ≥1；media 維持全 0~3）。 */
function pickProfile(noneIdx){
  return A.map((_,i)=>{
    if(i===noneIdx) return 0;                 // 指定屬性 = 無
    if(i===priceIdx) return randLevel(i);     // 價格全水準隨機
    if(i===mediaIdx) return randLevel(i);     // media 全水準隨機（含 baseline）
    if(noneAttrs.includes(i)) return 1+Math.floor(Math.random()*(A[i].levels.length-1)); // 其餘有「無」屬性 → 抽非無
    return randLevel(i);
  });
}
function genPair(){
  const domAttrs = A.map((_,i)=>i).filter(i=>i!==mediaIdx);
  for(let t=0;t<60;t++){
    // 左右各指定一個「無」屬性，且兩者不同
    const shuffled=shuffle(noneAttrs);
    const noneA=shuffled[0], noneB=shuffled[1];
    const pA=pickProfile(noneA), pB=pickProfile(noneB);
    if(pA.every((v,i)=>v===pB[i])) continue;            // 完全相同 → 重抽
    const aGE=domAttrs.every(i=>pA[i]>=pB[i]);
    const bGE=domAttrs.every(i=>pB[i]>=pA[i]);
    if(aGE||bGE) continue;                              // 一卡支配 → 重抽（理論上已不會發生，保險）
    return {A:pA,B:pB};
  }
  // 保底
  const sh=shuffle(noneAttrs);
  return {A:pickProfile(sh[0]), B:pickProfile(sh[1])};
}

/* 建構呈現序列 */
function buildSeq(){
  const cbc=[];
  for(let i=0;i<NROUND;i++) cbc.push({type:'cbc', idx:i, pair:genPair(), pick:null, dual:null, rtMs:null});

  // trap：插在第 1 輪之後（pos = TRAP_AFTER）
  const trap={type:'trap', side:CONFIG.TRAP_SIDE, pair:genPair(), pick:null, pass:null, rtMs:null};

  // repeat：取第 REP_SRC_IDX 輪，左右鏡像於來源 +2 後重現；記 srcIdx
  const src=cbc[CONFIG.REP_SRC_IDX];
  const rep={type:'rep', srcIdx:CONFIG.REP_SRC_IDX,
             pair:{A:src.pair.B.slice(), B:src.pair.A.slice()}, // 鏡像對調
             pick:null, dual:null, rtMs:null};

  // 組裝：第1輪, trap, 第2..N輪；repeat 插在 (來源題之後約2題)
  const seq=[];
  seq.push(cbc[0]);
  seq.push(trap);
  for(let i=1;i<NROUND;i++){
    seq.push(cbc[i]);
    if(i===CONFIG.REP_SRC_IDX+2) seq.push(rep); // 來源+2 後插鏡像重複
  }
  if(!seq.includes(rep)) seq.push(rep); // 保底
  state.seq=seq;
}

/* ---------- 球隊選擇 ---------- */
function buildS2(){
  const row=document.getElementById('s2row'); row.innerHTML='';
  CONFIG.teams.forEach(t=>{
    const d=document.createElement('div'); d.className='chip team-chip';
    // 隊色圓徽（官方 logo 字母 B/U/R/G/W/T）+ 隊名
    const mark=t.logo || t.zh.slice(-1);
    const fg=isLight(t.ui)?'#1a1306':'#fff';
    d.innerHTML=`<span class="team-logo" style="background:${t.ui};color:${fg}">${mark}</span><span class="team-name">${t.zh}</span>`;
    d.onclick=()=>{document.querySelectorAll('#s2row .chip').forEach(c=>c.classList.remove('sel'));
      d.classList.add('sel'); state.team=t.zh; state.teamObj=t; checkScreen();};
    row.appendChild(d);
  });
}
function checkScreen(){
  document.getElementById('screenNext').disabled=!state.team;
}
function startCBC(){
  if(!state.team){ document.getElementById('screenErr').textContent='請選擇一支球隊'; return; }
  applyTeamTheme();                     // 依選的隊套主視覺色調
  state.attrOrder=shuffle(A.map((_,i)=>i));
  buildSeq();
  state.pos=0;
  document.getElementById('teamName').textContent=state.team;
  document.getElementById('teamName2').textContent=state.team;
  // CBC 頂部大型英文隊名
  const tt=document.getElementById('teamTitleEn');
  if(tt) tt.textContent=state.teamObj ? state.teamObj.en : '';
  buildExplain();          // 建屬性說明頁
  go('s-explain');         // 先進說明頁，再由按鈕進 CBC
}

// 由說明頁進入 CBC：render 第一題並重啟計時（不把說明頁停留算進 rtMs）
function enterCBC(){
  go('s-cbc');
  renderItem();            // renderItem 內會重啟 qStartTs 與秒數鎖
}

// 屬性說明頁：逐屬性列出意義 + 水準白話解釋（特別解釋順位）
function buildExplain(){
  const wrap=document.getElementById('explainWrap'); wrap.innerHTML='';
  const notes={
    price:"加入會員一整年（一個賽季）需付的費用。",
    media:"球團提供的會員專屬影音內容，類型不同（一般戰報、深度專訪、休息室幕後、二軍養成紀錄）。",
    ticket:"球票開賣時，會員可比一般人「更早搶票」。順位越前面＝越早能買、越搶得到好位子（第二順位＞第三順位＞第四順位，每場都能買 4 張）。",
    interact:"會員專屬的互動機會。見面會採「抽選」制（報名後抽中才能參加），分球員見面會與啦啦隊見面會。",
    freetix:"加入會員直接贈送的免費球票張數（可自用或送人）。",
    gift:"加入會員贈送的實體紀念品。",
  };
  A.forEach(a=>{
    const item=document.createElement('div'); item.className='explain-item';
    const lv=a.levels.map(l=>l.label).join('、');
    item.innerHTML=`<div class="ex-head"><span class="ex-ic">${a.icon}</span><b>${a.name}</b></div>
      <div class="ex-note">${notes[a.key]||''}</div>
      <div class="ex-lv">細分：${lv}</div>`;
    wrap.appendChild(item);
  });
}

// 依球隊主視覺色覆寫 CSS 變數（標題、選中態、卡面邊隨隊變色）
function applyTeamTheme(){
  if(!state.teamObj) return;
  const ui=state.teamObj.ui||state.teamObj.color;   // 深底 UI 用提亮色
  const card=state.teamObj.color;                    // 卡面漸層用官方色
  const root=document.documentElement.style;
  root.setProperty('--team', ui);
  root.setProperty('--team-card', card);
  root.setProperty('--team-glow', hexA(ui,0.16));
  root.setProperty('--team-line', hexA(ui,0.5));
  // 依提亮隊色亮度自動選字色：亮底(如中信黃)用深字、暗底(如富邦藍)用白字
  root.setProperty('--chip-fg', isLight(ui) ? '#1a1306' : '#ffffff');
  root.setProperty('--chip-sh', isLight(ui) ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.55)');
}
// 相對亮度判斷（>0.55 視為亮色，需深字）
function isLight(hex){
  const m=hex.replace('#','');
  const r=parseInt(m.substring(0,2),16),g=parseInt(m.substring(2,4),16),b=parseInt(m.substring(4,6),16);
  const a=[r,g,b].map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});
  return (0.2126*a[0]+0.7152*a[1]+0.0722*a[2])>0.5;
}
// hex → rgba 字串
function hexA(hex,a){
  const m=hex.replace('#','');
  const r=parseInt(m.substring(0,2),16),g=parseInt(m.substring(2,4),16),b=parseInt(m.substring(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ---------- 渲染序列中的一題 ---------- */
function totalShown(){ return state.seq.length; }
function renderItem(){
  const it=state.seq[state.pos];
  const total=totalShown();
  document.getElementById('progBar').style.width=((state.pos)/total*100)+'%';
  document.getElementById('progLab').textContent=`第 ${state.pos+1} / ${total} 題`;
  state.qStartTs=Date.now();

  const isTrap=(it.type==='trap');
  const trapBox=document.getElementById('trapHint');
  trapBox.style.display=isTrap?'block':'none';
  if(isTrap) trapBox.textContent=`⚠ 注意力確認：本題請直接點選上方的「方案 ${it.side}」`;

  // trap 題不顯示上方 q-sub（指示集中在卡片下方的 trapHint，貼近目光落點）
  document.getElementById('qSub').style.display='none';

  const wrap=document.getElementById('cardWrap'); wrap.innerHTML='';
  ['A','B'].forEach(side=>{
    const prof=it.pair[side];
    const card=document.createElement('div');
    card.className='mcard '+side; card.dataset.side=side;
    const priceLab=A[priceIdx].levels[prof[priceIdx]].label;
    let rows='';
    state.attrOrder.forEach(i=>{
      if(i===priceIdx) return;
      const lv=A[i].levels[prof[i]];
      const has=!/^無/.test(lv.label);                 // 「無…」水準→✕，其餘→○
      const mark=has?'<span class="mk yes">○</span>':'<span class="mk no">✕</span>';
      rows+=`<li>${mark}<span class="ic">${A[i].icon}</span><span class="vv">${lv.label}</span></li>`;
    });
    const en=state.teamObj?state.teamObj.en:'';
    card.innerHTML=`<div class="card-chip"><span class="chip-en">方案 ${side}　${en}</span><span class="chip-ic"></span></div>
      <div class="price-tag"><span class="num">${priceLab.replace(' 元','')}</span><span class="unit"> 元 / 年</span></div>
      <ul class="rows">${rows}</ul>`;
    card.onclick=()=>pickCard(side);
    wrap.appendChild(card);
  });

  // None 選項：trap 題不顯示（指示型必須點 A/B）
  const noneEl=document.getElementById('noneOpt');
  noneEl.style.display=isTrap?'none':'block';
  noneEl.classList.remove('picked');

  it.pick=null;
  document.getElementById('cbcErr').textContent='';
  // 啟動每題最短秒數倒數鎖
  state.gateEnd=Date.now()+CONFIG.MIN_ANSWER_SEC*1000;
  if(state.gateTimer) clearInterval(state.gateTimer);
  state.gateTimer=setInterval(refreshNext,200);
  refreshNext();
}

// 統一控制「下一題」鈕：需同時滿足「已選」+「秒數已到」
function refreshNext(){
  const it=state.seq[state.pos];
  const btn=document.getElementById('cbcNext');
  const remain=Math.ceil((state.gateEnd-Date.now())/1000);
  const last=(state.pos===totalShown()-1);
  if(remain>0){
    btn.disabled=true;
    btn.textContent=`請再看 ${remain} 秒…`;
    return;
  }
  if(state.gateTimer){ clearInterval(state.gateTimer); state.gateTimer=null; }
  btn.textContent=last?'完成 ▸':'下一題 ▸';
  btn.disabled=(it.pick===null);
}

function pickCard(side){
  const it=state.seq[state.pos];
  if(side==='none' && it.type==='trap') return; // trap 不可選 none
  it.pick=side;
  document.querySelectorAll('#cardWrap .mcard').forEach(c=>{
    c.classList.toggle('picked',c.dataset.side===side);
  });
  document.getElementById('noneOpt').classList.toggle('picked',side==='none');
  refreshNext();
}
function nextRound(){
  const it=state.seq[state.pos];
  if(!it.pick){ document.getElementById('cbcErr').textContent='請先選擇一個方案'; return; }
  if(Date.now()<state.gateEnd){ document.getElementById('cbcErr').textContent='請再多看幾秒'; return; } // 秒數防呆
  if(state.gateTimer){ clearInterval(state.gateTimer); state.gateTimer=null; }
  // 記錄 rtMs / leftRatio（trap、rep 也計位置統計）
  it.rtMs=Date.now()-state.qStartTs;
  state.trialCount++;
  if(it.pick==='A'||it.pick==='B') state.abCount++;   // leftRatio 分母只計 A/B
  if(it.pick==='A') state.leftCount++;                // A=左
  if(it.type==='trap') it.pass=(it.pick===it.side);

  if(state.pos<totalShown()-1){ state.pos++; renderItem(); }
  else{ document.getElementById('progBar').style.width='100%'; buildScales(); go('s-scale'); }
}

/* ---------- 量表（亂序 + marker）---------- */
function buildScales(){
  const wrap=document.getElementById('scaleWrap'); wrap.innerHTML='';
  // 收集所有量表題（含 marker），打散後亂序呈現
  const all=[];
  Object.entries(CONFIG.scales).forEach(([key,sc])=>{
    sc.items.forEach((txt,idx)=>all.push({id:`${key}_${idx+1}`, txt:teamize(txt), isMarker:false}));
  });
  all.push({id:'marker', txt:CONFIG.marker, isMarker:true});
  const order=shuffle(all);

  order.forEach(q=>{
    const item=document.createElement('div'); item.className='likert-item';
    let btns='';
    for(let p=1;p<=CONFIG.scalePoints;p++)
      btns+=`<button data-id="${q.id}" data-v="${p}" onclick="pickLikert(this)">${p}</button>`;
    item.innerHTML=`<div class="qt">${q.txt}</div>
      <div class="likert-scale-hint"><span>非常不同意</span><span>非常同意</span></div>
      <div class="likert">${btns}</div>`;
    wrap.appendChild(item);
  });

  // 人口題
  const demoWrap=document.createElement('div'); demoWrap.className='scale-block';
  demoWrap.innerHTML='<h3>基本資料</h3>';
  CONFIG.demographics.forEach(d=>{
    const item=document.createElement('div'); item.className='likert-item';
    let chips='';
    d.options.forEach(o=>chips+=`<div class="chip" data-k="${d.key}" data-v="${o}" onclick="pickDemo(this)">${o}</div>`);
    item.innerHTML=`<div class="qt">${d.label}</div><div class="radio-row">${chips}</div>`;
    demoWrap.appendChild(item);
  });
  wrap.appendChild(demoWrap);
}
function pickLikert(btn){
  const id=btn.dataset.id;
  btn.parentNode.querySelectorAll('button').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
  if(id==='marker') state.marker=parseInt(btn.dataset.v,10);
  else state.scales[id]=parseInt(btn.dataset.v,10);
}
function pickDemo(el){
  const k=el.dataset.k;
  el.parentNode.querySelectorAll('.chip').forEach(c=>{ if(c.dataset.k===k) c.classList.remove('sel'); });
  el.classList.add('sel'); state.demo[k]=el.dataset.v;
}

/* ---------- 送出 ---------- */
function flatten(){
  const out={
    submitted_at:new Date().toISOString(),
    duration_sec:Math.round((Date.now()-state.startTs)/1000),
    team:state.team,
    attrOrder:state.attrOrder.map(i=>A[i].key).join('|'),
    n_rounds:NROUND,
    leftRatio:(state.abCount? (state.leftCount/state.abCount):0).toFixed(3),
    none_count:state.seq.filter(s=>s.type==='cbc'&&s.pick==='none').length, // 正式輪選 none 次數
    minAnswerSec:CONFIG.MIN_ANSWER_SEC,
  };
  // 正式 CBC 輪
  state.seq.filter(s=>s.type==='cbc').forEach(it=>{
    const n=it.idx+1;
    A.forEach((a,ai)=>{
      out[`r${n}_A_${a.key}`]=a.levels[it.pair.A[ai]].tag;
      out[`r${n}_B_${a.key}`]=a.levels[it.pair.B[ai]].tag;
    });
    out[`r${n}_pick`]=it.pick;
    out[`r${n}_rtMs`]=it.rtMs;
  });
  // trap
  const trap=state.seq.find(s=>s.type==='trap');
  if(trap){
    out['trap_side']=trap.side;
    out['trap_pick']=trap.pick;
    out['trap_pass']=trap.pass?'yes':'no';
    out['trap_rtMs']=trap.rtMs;
  }
  // repeat（鏡像重複一致性）
  const rep=state.seq.find(s=>s.type==='rep');
  const srcRound=state.seq.find(s=>s.type==='cbc'&&s.idx===CONFIG.REP_SRC_IDX);
  if(rep&&srcRound){
    // 比「選到哪張卡」：來源題 pick 對應的 profile，鏡像後同 profile 在哪一側
    // rep.pair.A = src.pair.B；故來源選 A → 同 profile 在 rep 的 B 側
    const srcPick=srcRound.pick;                               // 'A'|'B'|'none'
    let consistent;
    if(srcPick==='none'){ consistent=(rep.pick==='none'); }    // 都不選 → 一致
    else{
      const repSameSide=(srcPick==='A')?'B':'A';               // 鏡像後同卡的側
      consistent=(rep.pick===repSameSide);
    }
    out['rep_of']=CONFIG.REP_SRC_IDX+1;
    out['rep_orig']=srcPick;
    out['rep_again']=rep.pick;
    out['rep_consistent']=consistent?'yes':'no';
    out['rep_rtMs']=rep.rtMs;
  }
  // 量表 + marker + 人口
  Object.entries(state.scales).forEach(([k,v])=>out[`q_${k}`]=v);
  out['q_marker']=state.marker;
  Object.entries(state.demo).forEach(([k,v])=>out[`d_${k}`]=v);
  return out;
}
function allAnswered(){
  let need=0; Object.values(CONFIG.scales).forEach(s=>need+=s.items.length);
  const scaleOk=Object.keys(state.scales).length>=need && state.marker!==null;
  const demoOk=CONFIG.demographics.every(d=>state.demo[d.key]);
  return scaleOk && demoOk;
}
async function submitAll(){
  if(!allAnswered()){ document.getElementById('scaleErr').textContent='請完成所有量表題與基本資料（每題點一個選項）'; return; }
  const btn=document.getElementById('submitBtn'); btn.disabled=true; btn.textContent='送出中…';
  const data=flatten();
  try{
    const fd=new FormData();
    Object.entries(data).forEach(([k,v])=>fd.append(k,v));
    const res=await fetch(CONFIG.SHEETMONKEY_URL,{method:'POST',body:fd});
    if(!res.ok) throw new Error('HTTP '+res.status);
    go('s-done');
  }catch(e){
    try{ localStorage.setItem('cpbl_conjoint_'+Date.now(),JSON.stringify(data)); }catch(_){}
    window.__lastData=data;
    document.getElementById('scaleErr').innerHTML=
      '送出失敗（可能是 endpoint 尚未設定）。資料已暫存本機。<br><a href="#" onclick="downloadBackup();return false;">點此下載備份 JSON</a>';
    btn.disabled=false; btn.textContent='重試送出 ✓';
  }
}
function downloadBackup(){
  const blob=new Blob([JSON.stringify(window.__lastData,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='conjoint_backup.json'; a.click();
}

/* ---------- init ---------- */
buildS2();
