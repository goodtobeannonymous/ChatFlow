```javascript
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let messages=[], people=[], visibleStart=0, pageSize=120, currentTheme='aurora', filtered=null;

const themes=['aurora','amoled','nebula','carbon','cyber'];

const dateRe=/^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)\s+-\s+(.+?):\s?(.*)$/i;

function normalizeName(s){
  return s.replace(/\s*\([^)]*\)\s*/g,' ').replace(/\s+/g,' ').trim()||s.trim();
}

function parseDate(d,t){
  const [a,b,c]=d.split('/').map(Number);
  let year=c<100?2000+c:c;
  let month=a,day=b;

  if(a>12){day=a;month=b}

  const tm=t.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if(!tm)return new Date(year,month-1,day);

  let h=Number(tm[1])%12;
  if(tm[4].toUpperCase()==='PM')h+=12;

  return new Date(year,month-1,day,h,Number(tm[2]),Number(tm[3]||0));
}

function parseChat(text){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);
  const out=[];
  let last=null;

  for(const line of lines){
    const m=line.match(dateRe);

    if(m){
      const raw=m[3].trim();
      const name=normalizeName(raw);

      last={
        date:parseDate(m[1],m[2]),
        raw,
        name,
        text:m[4]||''
      };

      out.push(last);
    }else if(last){
      last.text+=(last.text?'\n':'')+line;
    }
  }

  return out.filter(x=>x.date instanceof Date&&!isNaN(x.date));
}

function fmtDate(d){
  return d.toLocaleDateString(undefined,{
    day:'numeric',
    month:'short',
    year:'numeric'
  });
}

function fmtTime(d){
  return d.toLocaleTimeString(undefined,{
    hour:'numeric',
    minute:'2-digit'
  });
}

function safe(s){
  return String(s).replace(/[&<>"']/g,c=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c]));
}

function haptic(){
  try{
    if(navigator.vibrate)navigator.vibrate(8);
  }catch(e){}
}

function showStatus(s){
  $('#importStatus').textContent=s;
}

$('#chatFile').addEventListener('change',async e=>{
  const file=e.target.files[0];
  if(!file)return;

  showStatus('Reading '+file.name+'…');

  try{
    const text=await file.text();
    messages=parseChat(text);

    const counts=new Map();
    messages.forEach(m=>counts.set(m.name,(counts.get(m.name)||0)+1));

    people=[...new Set(messages.map(m=>m.name))]
      .sort((a,b)=>(counts
