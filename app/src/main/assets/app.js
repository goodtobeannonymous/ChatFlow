const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let messages=[], people=[], visibleStart=0, pageSize=120, currentTheme='aurora', filtered=null;
const themes = ['aurora', 'amoled', 'ocean', 'sunset', 'lavender'];
const dateRe=/^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)\s+-\s+(.+?):\s?(.*)$/i;
function normalizeName(s){return s.replace(/\s*\([^)]*\)\s*/g,' ').replace(/\s+/g,' ').trim()||s.trim()}
function parseDate(d,t){
  const [a,b,c]=d.split('/').map(Number); let year=c<100?2000+c:c;
  let month=a,day=b;
  if(a>12){day=a;month=b}
  const tm=t.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if(!tm)return new Date(year,month-1,day);
  let h=Number(tm[1])%12;if(tm[4].toUpperCase()==='PM')h+=12;
  return new Date(year,month-1,day,h,Number(tm[2]),Number(tm[3]||0));
}
function parseChat(text){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/), out=[]; let last=null;
  for(const line of lines){
    const m=line.match(dateRe);
    if(m){
      const raw=m[3].trim(), name=normalizeName(raw);
      last={date:parseDate(m[1],m[2]),raw,name,text:m[4]||''};
      out.push(last);
    }else if(last){
      last.text+=(last.text?'\n':'')+line;
    }
  }
  return out.filter(x=>x.date instanceof Date&&!isNaN(x.date));
}
function fmtDate(d){return d.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}
function fmtTime(d){return d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}
function safe(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function haptic(){try{if(navigator.vibrate)navigator.vibrate(8)}catch(e){}}
function showStatus(s){$('#importStatus').textContent=s}
$('#chatFile').addEventListener('change',async e=>{
 const file=e.target.files[0];if(!file)return;
 showStatus('Reading '+file.name+'…');
 try{
  const text=await file.text(); messages=parseChat(text);
  const counts=new Map();messages.forEach(m=>counts.set(m.name,(counts.get(m.name)||0)+1));
  people=[...new Set(messages.map(m=>m.name))].sort((a,b)=>(counts.get(b)-counts.get(a)));
  if(people.length>2){
    const bases=[...new Set(people.map(normalizeName))];
    people=bases.sort((a,b)=>messages.filter(m=>m.name===a||normalizeName(m.name)===a).length-messages.filter(m=>m.name===b||normalizeName(m.name)===b).length).reverse();
  }
  messages.forEach(m=>m.person=normalizeName(m.name));
  const ranked=[...new Set(messages.map(m=>m.person))].sort((a,b)=>messages.filter(x=>x.person===b).length-messages.filter(x=>x.person===a).length);
  people=ranked.slice(0,2);
  messages.forEach(m=>{if(!people.includes(m.person))m.person='Other'});
  if(!messages.length)throw new Error('No supported timestamped messages were found.');
  await saveChatText(text);
  localStorage.setItem('chatflow_theme',currentTheme);
  showStatus(`${messages.length.toLocaleString()} messages imported · ${people.length} participants`);
  $('#overview').classList.remove('hidden'); renderOverview();renderStats();renderReader(true);
  $('#chatTitle').textContent=people.slice(0,2).join(' & ');
  $('#chatSubtitle').textContent=`${messages.length.toLocaleString()} messages`;
  $('#avatarA').textContent=(people[0]||'A')[0].toUpperCase();$('#avatarB').textContent=(people[1]||'B')[0].toUpperCase();
  go('home');haptic();
 }catch(err){showStatus(err.message||'Could not read this file.')}
});
function openChatDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('ChatFlowDB',1);req.onupgradeneeded=()=>req.result.createObjectStore('archive');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function saveChatText(text){try{const db=await openChatDB();await new Promise((resolve,reject)=>{const tx=db.transaction('archive','readwrite');tx.objectStore('archive').put(text,'latest');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}catch(e){showStatus('Imported for this session. Local archive could not be saved.')}}
async function restoreChat(){try{const db=await openChatDB();const text=await new Promise((resolve,reject)=>{const r=db.transaction('archive').objectStore('archive').get('latest');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});db.close();if(!text)return;messages=parseChat(text);const ranked=[...new Set(messages.map(m=>m.name.replace(/\s*\([^)]*\)\s*/g,' ').replace(/\s+/g,' ').trim()))].sort((a,b)=>messages.filter(m=>m.name.startsWith(b)).length-messages.filter(m=>m.name.startsWith(a)).length);people=ranked.slice(0,2);messages.forEach(m=>{m.person=m.name.replace(/\s*\([^)]*\)\s*/g,' ').replace(/\s+/g,' ').trim();if(!people.includes(m.person))m.person='Other'});if(messages.length){showStatus(`${messages.length.toLocaleString()} messages restored from this device`);$('#overview').classList.remove('hidden');renderOverview();renderStats();renderReader(true);$('#chatTitle').textContent=people.join(' & ');$('#chatSubtitle').textContent=`${messages.length.toLocaleString()} messages`}}catch(e){}}
function countBy(key){const map={};messages.forEach(m=>{const k=key(m);map[k]=(map[k]||0)+1});return map}
function renderOverview(){
 $('#totalMessages').textContent=messages.length.toLocaleString();$('#participantCount').textContent=people.length;
 const c=countBy(m=>m.person);const vals=people.map(p=>c[p]||0),total=messages.length;
 $('#distribution').innerHTML=people.slice(0,2).map((p,i)=>`<span style="width:${(vals[i]/total*100).toFixed(2)}%;background:${i?'var(--accent2)':'var(--accent)'}"></span>`).join('');
 $('#peopleLegend').innerHTML=people.slice(0,2).map((p,i)=>`<span>● ${safe(p)} <b>${((vals[i]/total)*100).toFixed(1)}%</b></span>`).join('');
 drawChart($('#activityChart'),Object.entries(countBy(m=>m.date.toISOString().slice(0,10))).slice(-14).map(([k,v])=>[k.slice(5),v]));
}
function renderStats(){
 $('#statTotal').textContent=messages.length.toLocaleString();
 const days=[...new Set(messages.map(m=>m.date.toDateString()))];
 $('#activeDays').textContent=days.length.toLocaleString();
 $('#firstDate').textContent=fmtDate(messages[0].date);$('#lastDate').textContent=fmtDate(messages[messages.length-1].date);
 const c=countBy(m=>m.person),max=Math.max(...people.map(p=>c[p]||0),1);
 $('#senderBars').innerHTML=people.slice(0,6).map((p,i)=>`<div class="bar-person"><div style="display:flex;justify-content:space-between;font-size:11px;margin:13px 0 7px"><span>${safe(p)}</span><b>${(c[p]||0).toLocaleString()}</b></div><div class="distribution"><span style="width:${(c[p]||0)/max*100}%;background:${i?'var(--accent2)':'var(--accent)'}"></span></div></div>`).join('');
 const hours=countBy(m=>String(m.date.getHours()).padStart(2,'0'));
 drawChart($('#hoursChart'),Array.from({length:24},(_,h)=>[String(h).padStart(2,'0'),hours[String(h).padStart(2,'0')]||0]));
 const months=countBy(m=>m.date.getFullYear()+'-'+String(m.date.getMonth()+1).padStart(2,'0'));
 drawChart($('#monthChart'),Object.entries(months).slice(-12).map(([k,v])=>{const [y,m]=k.split('-').map(Number);return [new Date(y,m-1,1).toLocaleDateString(undefined,{month:'short',year:'2-digit'}),v]}),true);
}
function drawChart(canvas,data,verticalLabels=false){
  if(!canvas)return;
  const dpr=window.devicePixelRatio||1;
  const w=Math.max(260,canvas.clientWidth||300);
  const cssH=verticalLabels?260:230;
  canvas.style.height=cssH+'px';
  canvas.width=Math.round(w*dpr);
  canvas.height=Math.round(cssH*dpr);
  const ctx=canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const h=cssH, max=Math.max(1,...data.map(x=>x[1]));
  const padL=24,padR=8,top=12,bottom=verticalLabels?76:30;
  const plotH=h-top-bottom,plotW=w-padL-padR;
  const step=plotW/Math.max(data.length,1),style=getComputedStyle(document.body);
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle=style.getPropertyValue('--line').trim()||'#302844';
  ctx.lineWidth=1;
  for(let i=0;i<4;i++){
    const y=top+plotH*i/3;
    ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(w-padR,y);ctx.stroke();
  }
  data.forEach((d,i)=>{
    const bh=plotH*d[1]/max,x=padL+i*step+step*.22,y=top+plotH-bh;
    ctx.fillStyle=style.getPropertyValue('--accent').trim()||'#a78bfa';
    ctx.beginPath();ctx.roundRect(x,y,Math.max(3,step*.56),bh,[5,5,2,2]);ctx.fill();
    const showLabel=verticalLabels||data.length<=14||i%3===0;
    if(showLabel){
      ctx.save();
      ctx.fillStyle=style.getPropertyValue('--muted').trim()||'#aaa1c2';
      ctx.font='10px system-ui,sans-serif';
      if(verticalLabels){
        ctx.translate(padL+i*step+step*.5,h-8);
        ctx.rotate(-Math.PI/2);
        ctx.textAlign='right';
        ctx.fillText(String(d[0]),0,0);
      }else{
        ctx.textAlign='center';
        ctx.fillText(String(d[0]),padL+i*step+step*.5,h-9);
      }
      ctx.restore();
    }
  });
}
function appendReaderPage(){
  const list=filtered||messages;
  if(visibleStart>=list.length)return;
  const from=visibleStart,to=Math.min(from+pageSize,list.length);
  let html='',lastDay=from?fmtDate(list[from-1].date):'';
  for(let i=from;i<to;i++){
    const m=list[i],day=fmtDate(m.date);
    if(day!==lastDay){html+=`<div class="day-separator"><span>${safe(day)}</span></div>`;lastDay=day}
    const mine=m.person===people[0],prev=list[i-1];
    html+=`<div class="msg-row ${mine?'mine':'theirs'}">${(!prev||prev.person!==m.person)?`<div class="sender">${safe(m.person)}</div>`:''}<div class="bubble"><span class="message-text">${safe(m.text||' ')}</span><span class="bubble-time">${fmtTime(m.date)}</span></div></div>`;
  }
  $('#chatMessages').insertAdjacentHTML('beforeend',html);
  visibleStart=to;
  $('#messageCountLabel').textContent=`Showing ${visibleStart.toLocaleString()} of ${list.length.toLocaleString()}`;
  $('#loadOlder').style.display='none';
}
function renderReader(reset=false){
  const list=filtered||messages;
  if(reset){
    visibleStart=0;
    $('#chatMessages').innerHTML='';
    if(!list.length)$('#chatMessages').innerHTML='<div class="empty-state">No matching messages.</div>';
  }
  appendReaderPage();
}
const chatScroller=$('#chatMessages');
chatScroller.addEventListener('scroll',()=>{
  if(chatScroller.scrollTop+chatScroller.clientHeight>=chatScroller.scrollHeight-260){
    appendReaderPage();
  }
});
$('#loadOlder').style.display='none';
$('#searchToggle').onclick=()=>{$('#searchBar').classList.toggle('hidden');$('#searchInput').focus()};
$('#clearSearch').onclick=()=>{$('#searchInput').value='';filtered=null;renderReader(true)};
$('#searchInput').addEventListener('input',e=>{const q=e.target.value.toLowerCase();filtered=q?messages.filter(m=>m.text.toLowerCase().includes(q)||m.person.toLowerCase().includes(q)):null;renderReader(true)});
function go(id){$$('.screen').forEach(s=>s.classList.toggle('active',s.id===id));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.go===id));haptic()}
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
$('#openReader').onclick=()=>go('reader');

const themeConfig = {
  aurora: {
    label: 'Aurora',
    description: 'Northern lights · Purple and violet',
    colors: ['#0d0b18','#171326','#211b35','#f7f4ff','#aaa1c2','#a78bfa','#ec8df5','#29213f','#6843a7']
  },
  amoled: {
    label: 'Midnight AMOLED',
    description: 'Pure black · Electric blue',
    colors: ['#000000','#090909','#141414','#f5f7fb','#9299a5','#168bff','#65b7ff','#171717','#075bb8']
  },
  ocean: {
    label: 'Ocean Glass',
    description: 'Deep ocean · Cyan highlights',
    colors: ['#071522','#10283b','#17394e','#effaff','#9bbacb','#39c6df','#65a9ff','#18364a','#087da9']
  },
  sunset: {
    label: 'Sunset',
    description: 'Warm coral · Amber glow',
    colors: ['#211018','#321b25','#482633','#fff3ec','#c8a6a0','#ff956f','#ffc36e','#492b32','#ce654c']
  },
  lavender: {
    label: 'Lavender',
    description: 'Soft lilac · Elegant light purple',
    colors: ['#f5f1fc','#ffffff','#eae2f6','#29233b','#82758f','#9271d5','#c29bea','#eee8f7','#8060c8']
  }
};

function applyThemeColors(theme) {
  const c = themeConfig[theme] || themeConfig.aurora;
  const keys = [
    '--bg','--surface','--surface2','--text','--muted',
    '--line','--accent','--accent2','--bubbleA','--bubbleB'
  ];

  // The color array includes nine entries; assign the ten CSS variables
  // using the explicit palette below.
  const palettes = {
    aurora: ['#0d0b18','#171326','#211b35','#f7f4ff','#aaa1c2','#302844','#a78bfa','#ec8df5','#29213f','#6843a7'],
    amoled: ['#000000','#090909','#141414','#f5f7fb','#9299a5','#242424','#168bff','#65b7ff','#171717','#075bb8'],
    ocean: ['#071522','#10283b','#17394e','#effaff','#9bbacb','#23475b','#39c6df','#65a9ff','#18364a','#087da9'],
    sunset: ['#211018','#321b25','#482633','#fff3ec','#c8a6a0','#57313a','#ff956f','#ffc36e','#492b32','#ce654c'],
    lavender: ['#f5f1fc','#ffffff','#eae2f6','#29233b','#82758f','#e0d7ec','#9271d5','#c29bea','#eee8f7','#8060c8']
  };

  const values = palettes[theme] || palettes.aurora;
  keys.forEach((key, i) => document.documentElement.style.setProperty(key, values[i]));
  document.body.dataset.theme = theme;
}

function buildThemeOptions() {
  const list = $('.theme-list');
  if (!list) return;

  list.innerHTML = Object.entries(themeConfig).map(([id, t]) => `
    <button class="theme-option" type="button" data-theme-choice="${id}">
      <span class="swatch ${id}"></span>
      <span>
        <b>${t.label}</b>
        <small>${t.description}</small>
      </span>
      <i>✓</i>
    </button>
  `).join('');

  list.querySelectorAll('[data-theme-choice]').forEach(button => {
    const id = button.dataset.themeChoice;

    button.addEventListener('pointerenter', () => {
      applyThemeColors(id);
      document.body.classList.add('theme-preview');
    });

    button.addEventListener('pointerleave', () => {
      document.body.classList.remove('theme-preview');
      applyThemeColors(currentTheme);
    });

    button.addEventListener('focus', () => {
      applyThemeColors(id);
      document.body.classList.add('theme-preview');
    });

    button.addEventListener('blur', () => {
      document.body.classList.remove('theme-preview');
      applyThemeColors(currentTheme);
    });

    button.addEventListener('click', () => setTheme(id));
  });
}

function setTheme(theme) {
  if (!themeConfig[theme]) theme = 'aurora';

  currentTheme = theme;
  applyThemeColors(theme);

  localStorage.setItem('chatflow_theme', theme);

  $$('.theme-option').forEach(button => {
    button.classList.toggle(
      'selected',
      button.dataset.themeChoice === theme
    );
  });

  if (messages.length) {
    renderOverview();
    renderStats();
  }

  haptic();
}

function setupDynamicHeader() {
  const scroller = $('#chatMessages');
  const header = $('.topbar');

  if (!scroller || !header) return;

  let ticking = false;

  scroller.addEventListener('scroll', () => {
    if (ticking) return;

    ticking = true;

    requestAnimationFrame(() => {
      const collapsed = scroller.scrollTop > 45;

      header.classList.toggle('is-collapsed', collapsed);
      document.body.classList.toggle('header-collapsed', collapsed);

      ticking = false;
    });
  }, { passive: true });
}

buildThemeOptions();

$$('[data-theme-choice]').forEach(button => {
  button.addEventListener('click', () => setTheme(button.dataset.themeChoice));
});

$('#themeQuick').onclick = () => {
  const index = themes.indexOf(currentTheme);
  setTheme(themes[(index + 1) % themes.length]);
};

currentTheme = localStorage.getItem('chatflow_theme') || 'aurora';
setTheme(currentTheme);

setupDynamicHeader();

restoreChat();
