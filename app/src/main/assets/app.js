const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let messages=[], people=[], visibleStart=0, pageSize=120, currentTheme='aurora', filtered=null;
const themes=['aurora','forest','amoled','pearl'];
const dateRe=/^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)\s+-\s+(.+?):\s?(.*)$/i;
function normalizeName(s){return s.replace(/\s*\([^)]*\)\s*/g,' ').replace(/\s+/g,' ').trim()||s.trim()}
function parseDate(d,t){
  const [a,b,c]=d.split('/').map(Number); let year=c<100?2000+c:c;
  let month=a,day=b;
  // WhatsApp exports commonly use M/D/YY; detect obviously day-first dates.
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
 showStatus('Reading '+file.name+'â€¦');
 try{
  const text=await file.text(); messages=parseChat(text);
  const counts=new Map();messages.forEach(m=>counts.set(m.name,(counts.get(m.name)||0)+1));
  // Merge source variants into the two main people; keep any additional senders separate.
  people=[...new Set(messages.map(m=>m.name))].sort((a,b)=>(counts.get(b)-counts.get(a)));
  if(people.length>2){
    const bases=[...new Set(people.map(normalizeName))];
    people=bases.sort((a,b)=>messages.filter(m=>m.name===a||normalizeName(m.name)===a).length-messages.filter(m=>m.name===b||normalizeName(m.name)===b).length).reverse();
  }
  // For exports with suffixes such as (wp1), sender labels are normalized to person names.
  messages.forEach(m=>m.person=normalizeName(m.name));
  const ranked=[...new Set(messages.map(m=>m.person))].sort((a,b)=>messages.filter(x=>x.person===b).length-messages.filter(x=>x.person===a).length);
  people=ranked.slice(0,2);
  messages.forEach(m=>{if(!people.includes(m.person))m.person='Other'});
  if(!messages.length)throw new Error('No supported timestamped messages were found.');
  await saveChatText(text);
  localStorage.setItem('chatflow_theme',currentTheme);
  showStatus(`${messages.length.toLocaleString()} messages imported Â· ${people.length} participants`);
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
 $('#peopleLegend').innerHTML=people.slice(0,2).map((p,i)=>`<span>â— ${safe(p)} <b>${((vals[i]/total)*100).toFixed(1)}%</b></span>`).join('');
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
 drawChart($('#monthChart'),Object.entries(months).slice(-12).map(([k,v])=>[k.slice(2),v]));
}
function drawChart(canvas,data){
 if(!canvas)return;const ctx=canvas.getContext('2d'),w=canvas.clientWidth||300,h=canvas.height;canvas.width=w*devicePixelRatio;canvas.height=h*devicePixelRatio;ctx.scale(devicePixelRatio,devicePixelRatio);
 const max=Math.max(1,...data.map(x=>x[1])),pad=24,step=(w-pad*2)/Math.max(data.length,1);
 ctx.clearRect(0,0,w,h);ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--line');ctx.lineWidth=1;
 for(let i=0;i<4;i++){let y=12+(h-38)*i/3;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(w-8,y);ctx.stroke()}
 data.forEach((d,i)=>{let bh=(h-50)*d[1]/max,x=pad+i*step+step*.22,y=h-25-bh;ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--accent');let r=5;ctx.beginPath();ctx.roundRect(x,y,Math.max(3,step*.55),bh,[r,r,2,2]);ctx.fill();if(data.length<=14||i%3===0){ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--muted');ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillText(d[0],x+step*.275,h-8)}})
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
    html+=`<div class="msg-row ${mine?'mine':'theirs'}">${(!prev||prev.person!==m.person)?`<div class="sender">${safe(m.person)}</div>`:''}<div class="bubble">${safe(m.text||' ')}</div><div class="time">${fmtTime(m.date)}</div></div>`;
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
function setTheme(t){currentTheme=t;document.body.dataset.theme=t;localStorage.setItem('chatflow_theme',t);$$('.theme-option').forEach(b=>b.classList.toggle('selected',b.dataset.themeChoice===t));if(messages.length){renderOverview();renderStats()}haptic()}
$$('[data-theme-choice]').forEach(b=>b.onclick=()=>setTheme(b.dataset.themeChoice));
$('#themeQuick').onclick=()=>{const i=themes.indexOf(currentTheme);setTheme(themes[(i+1)%themes.length])};
currentTheme=localStorage.getItem('chatflow_theme')||'aurora';setTheme(currentTheme);

restoreChat();
