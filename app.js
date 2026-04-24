// ── PALETTES ──────────────────────────────────────────────────────────────────
const PAL = {
  EXTREME_GREED: { core:[0,255,170],   fil:[255,215,0],   pt:[0,229,255],  n:260, rot:0.0012,  label:'EXTREME GREED' },
  GREED:         { core:[168,255,120], fil:[255,179,71],  pt:[255,241,118],n:200, rot:0.0006,  label:'GREED' },
  NEUTRAL:       { core:[224,224,224], fil:[176,190,197], pt:[255,255,255],n:160, rot:0.0003,  label:'NEUTRAL' },
  FEAR:          { core:[179,157,219], fil:[124,77,255],  pt:[206,147,216],n:120, rot:0.00015, label:'FEAR' },
  EXTREME_FEAR:  { core:[183,28,28],   fil:[74,0,0],      pt:[229,57,53],  n:80,  rot:0.00005, label:'EXTREME FEAR' },
};

function scoreToKey(s){ return s>=75?'EXTREME_GREED':s>=55?'GREED':s>=45?'NEUTRAL':s>=25?'FEAR':'EXTREME_FEAR'; }
function lerp3(a,b,t){ return[a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function rc(rgb,a){ return `rgba(${rgb[0]|0},${rgb[1]|0},${rgb[2]|0},${a})`; }

// ── CANVAS SETUP ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');
let W,H,CX,CY,R;

function resize(){
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  CX = W/2; CY = H/2;
  R  = Math.min(W,H)*0.32;
  positionAnnotations();
}
window.addEventListener('resize', resize);

// ── STATE ─────────────────────────────────────────────────────────────────────
let curKey = 'NEUTRAL', tgtKey = 'NEUTRAL', lerpT = 1;
const LERP_F = 120;

let noiseOff = 0, angle = 0, curRot = PAL.NEUTRAL.rot;
let entryF = 0, entryDone = false;
const ENTRY_F = 60;

let ripR = 0, ripO = 0, ripActive = false;
let hovered = false, mX = -9999, mY = -9999;
let fgScore = null;

let tweakState = 'auto', tweakDensity = 1, tweakDrift = 1, tweakLeaders = true;
let shimHue = 0, mktData = null;

let clickFlashT = 0;
const CLICK_FLASH_DUR = 90;

let chartDots = [];
let chartAllPoints = [];
let chartRegion = null;

let labelActive = 'a';

let histScores = [];
let showChart  = true;

let primNodes = [], secNodes = [];

// ── NOISE ─────────────────────────────────────────────────────────────────────
function sn(x,y,t){
  return Math.sin(x*1.3+t)*Math.cos(y*0.9+t*0.7)
       + Math.sin(x*2.1+t*1.3+1.2)*Math.cos(y*1.7+t*0.4)*0.5
       + Math.sin(x*0.7+t*0.5+y*1.1)*0.25;
}

// ── CURRENT PALETTE (lerped) ──────────────────────────────────────────────────
function getCur(){
  const p=PAL[curKey], q=PAL[tgtKey], t=lerpT;
  return {
    core: lerp3(p.core, q.core, t),
    fil:  lerp3(p.fil,  q.fil,  t),
    pt:   lerp3(p.pt,   q.pt,   t),
    n:    p.n+(q.n-p.n)*t,
    rot:  p.rot+(q.rot-p.rot)*t,
    label: t>0.5 ? q.label : p.label,
  };
}

function getFlashColor(rgb){
  const r=rgb[0]/255, g=rgb[1]/255, b=rgb[2]/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h=0, s=0, l=(max+min)/2;
  if(max!==min){
    const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){ case r:h=(g-b)/d+(g<b?6:0);break; case g:h=(b-r)/d+2;break; case b:h=(r-g)/d+4;break; }
    h/=6;
  }
  h=(h+0.42)%1; s=Math.min(1,s*1.4); l=Math.min(0.85,l*1.5);
  function hue2rgb(p,q,t){ if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p; }
  const q2=l<0.5?l*(1+s):l+s-l*s, p2=2*l-q2;
  return [hue2rgb(p2,q2,h+1/3)*255, hue2rgb(p2,q2,h)*255, hue2rgb(p2,q2,h-1/3)*255];
}

// ── BUILD NODE ARRAYS ─────────────────────────────────────────────────────────
function buildNodes(pal){
  const count = Math.round(pal.n * tweakDensity);
  primNodes = [];
  for(let i=0;i<count;i++){
    const ba = (i/count)*Math.PI*2 + angle;
    const nx = Math.cos(ba)*0.5, ny = Math.sin(ba)*0.5;
    const n  = sn(nx, ny, noiseOff*tweakDrift);
    const a2 = ba + n*0.32;
    const l  = R*(0.52 + n*0.18);
    primNodes.push({ x:CX+Math.cos(a2)*l, y:CY+Math.sin(a2)*l, a:a2, op:0.18+Math.random()*0.17 });
  }
  secNodes = [];
  for(let i=0;i<primNodes.length;i++){
    if(Math.random()>0.3) continue;
    const nd=primNodes[i];
    const bc=1+Math.floor(Math.random()*2);
    for(let b=0;b<bc;b++){
      const ba=nd.a+(Math.random()-0.5)*1.3;
      const bl=R*(0.1+Math.random()*0.14);
      secNodes.push({ x1:nd.x,y1:nd.y, x2:nd.x+Math.cos(ba)*bl, y2:nd.y+Math.sin(ba)*bl, op:0.09+Math.random()*0.11 });
    }
  }
  const inflR = R * 0.72;
  for(const nd of primNodes){
    const dx=mX-nd.x, dy=mY-nd.y, d=Math.sqrt(dx*dx+dy*dy);
    if(d<inflR){ const s=Math.pow(1-d/inflR,2)*0.55; nd.x+=dx*s; nd.y+=dy*s; }
  }
  for(const s of secNodes){
    const dx=mX-s.x2, dy=mY-s.y2, d=Math.sqrt(dx*dx+dy*dy);
    if(d<inflR*0.8){ const str=Math.pow(1-d/(inflR*0.8),2)*0.45; s.x2+=dx*str; s.y2+=dy*str; s.x1+=(mX-s.x1)*str*0.2; s.y1+=(mY-s.y1)*str*0.2; }
  }
}

// ── DRAW SPARKLINE CHART ──────────────────────────────────────────────────────
function scoreLabel(s){ return s>=75?'Extreme Greed':s>=55?'Greed':s>=45?'Neutral':s>=25?'Fear':'Extreme Fear'; }
function scoreColor(s){
  if(s>=75) return [0,255,170];
  if(s>=55) return [168,255,120];
  if(s>=45) return [224,224,224];
  if(s>=25) return [179,157,219];
  return [183,28,28];
}

function drawChart(pal){
  if(!showChart || histScores.length < 2) return;

  const cH   = Math.min(110, H * 0.18);
  const cPadL = 38, cPadR = 16;
  const cBot  = H - 44;
  const cTop  = cBot - cH;
  const cW    = W - cPadL - cPadR;
  const scores = histScores.slice(-365);

  const minS = 0, maxS = 100;
  const sx = i => cPadL + (i/(scores.length-1))*cW;
  const sy = v => cBot - ((v-minS)/(maxS-minS))*cH;

  chartRegion = { x0:cPadL, y0:cTop, x1:cPadL+cW, y1:cBot };

  chartAllPoints = scores.map((d,i)=>({
    x: sx(i), y: sy(d.y),
    score: Math.round(d.y),
    date: new Date(d.x),
    label: scoreLabel(d.y),
    color: scoreColor(d.y)
  }));

  const zones = [
    { lo:75, hi:100, rgb:[0,255,170],   name:'Extreme Greed' },
    { lo:55, hi:75,  rgb:[168,255,120], name:'Greed' },
    { lo:45, hi:55,  rgb:[224,224,224], name:'Neutral' },
    { lo:25, hi:45,  rgb:[179,157,219], name:'Fear' },
    { lo:0,  hi:25,  rgb:[183,28,28],   name:'Extreme Fear' },
  ];
  for(const z of zones){
    ctx.fillStyle = rc(z.rgb, 0.02);
    ctx.fillRect(cPadL, sy(z.hi), cW, sy(z.lo)-sy(z.hi));
  }

  // Filled area under curve
  ctx.beginPath();
  ctx.moveTo(sx(0), cBot);
  for(let i=0;i<scores.length;i++) ctx.lineTo(sx(i), sy(scores[i].y));
  ctx.lineTo(sx(scores.length-1), cBot);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, cTop, 0, cBot);
  grad.addColorStop(0,   rc(pal.core, 0.06));
  grad.addColorStop(0.7, rc(pal.core, 0.015));
  grad.addColorStop(1,   'rgba(8,8,8,0)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Edge vignettes
  const eL = ctx.createLinearGradient(cPadL, 0, cPadL+55, 0);
  eL.addColorStop(0,'rgba(8,8,8,0.95)'); eL.addColorStop(1,'rgba(8,8,8,0)');
  ctx.fillStyle=eL; ctx.fillRect(cPadL, cTop-4, 55, cH+30);
  const eR = ctx.createLinearGradient(cPadL+cW-55, 0, cPadL+cW+cPadR, 0);
  eR.addColorStop(0,'rgba(8,8,8,0)'); eR.addColorStop(1,'rgba(8,8,8,0.95)');
  ctx.fillStyle=eR; ctx.fillRect(cPadL+cW-55, cTop-4, 55+cPadR, cH+30);
  const eB = ctx.createLinearGradient(0, cBot-18, 0, cBot+10);
  eB.addColorStop(0,'rgba(8,8,8,0)'); eB.addColorStop(1,'rgba(8,8,8,1)');
  ctx.fillStyle=eB; ctx.fillRect(cPadL-10, cBot-18, cW+cPadR+10, 30);
  const eT = ctx.createLinearGradient(0, cTop-20, 0, cTop+32);
  eT.addColorStop(0,'rgba(8,8,8,1)'); eT.addColorStop(1,'rgba(8,8,8,0)');
  ctx.fillStyle=eT; ctx.fillRect(0, cTop-20, W, 52);

  // Line
  ctx.beginPath();
  for(let i=0;i<scores.length;i++){
    i===0 ? ctx.moveTo(sx(i),sy(scores[i].y)) : ctx.lineTo(sx(i),sy(scores[i].y));
  }
  ctx.strokeStyle = rc(pal.core, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Y axis
  ctx.font = '8px "IBM Plex Mono"';
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.textAlign = 'right';
  for(const v of [0,25,50,75,100]){
    const yy = sy(v);
    ctx.fillText(v, cPadL-5, yy+3);
    ctx.setLineDash([1,4]);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cPadL, yy); ctx.lineTo(cPadL+cW, yy); ctx.stroke();
    ctx.setLineDash([]);
  }
  for(const z of zones){
    const midY = sy((z.lo+z.hi)/2);
    if(midY > cTop+6 && midY < cBot-4){
      ctx.fillStyle = rc(z.rgb, 0.22);
      ctx.fillText(z.name, cPadL-5, midY+3);
    }
  }
  ctx.textAlign = 'left';

  // X axis — month labels
  if(scores.length > 1){
    const firstDate = new Date(scores[0].x);
    const lastDate  = new Date(scores[scores.length-1].x);
    const d = new Date(firstDate.getFullYear(), firstDate.getMonth()+1, 1);
    ctx.font = '8px "IBM Plex Mono"';
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.textAlign = 'center';
    const totalMs = lastDate - firstDate;
    while(d <= lastDate){
      const frac = (d - firstDate) / totalMs;
      const lx = cPadL + frac*cW;
      const mo = d.toLocaleDateString('en-US',{month:'short',year:'2-digit'});
      ctx.fillText(mo, lx, cBot+12);
      ctx.strokeStyle='rgba(255,255,255,0.1)';
      ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(lx,cBot); ctx.lineTo(lx,cBot+4); ctx.stroke();
      d.setMonth(d.getMonth()+1);
    }
    ctx.textAlign='left';
  }

  // Waypoint dots (6 across 1yr)
  const STEPS = 5;
  chartDots = [];
  for(let i=0;i<=STEPS;i++){
    const idx = Math.round((i/STEPS)*(scores.length-1));
    const d = scores[idx];
    chartDots.push({ x:sx(idx), y:sy(d.y), score:Math.round(d.y), first:i===0, last:i===STEPS, date:new Date(d.x), label:scoreLabel(d.y), color:scoreColor(d.y) });
  }
  for(const dot of chartDots){
    const hovering = Math.sqrt((mX-dot.x)**2+(mY-dot.y)**2)<10;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, hovering?4.5:(dot.first||dot.last?3.5:2.5), 0, Math.PI*2);
    ctx.fillStyle = rc(dot.color, hovering?1.0:(dot.first||dot.last?0.9:0.55));
    ctx.fill();
    if(dot.first||dot.last){
      ctx.font='9px "IBM Plex Mono"';
      ctx.fillStyle=rc(dot.color,0.65);
      ctx.textAlign='center';
      ctx.fillText(dot.score, dot.x, Math.max(cTop+8, dot.y-8));
      ctx.textAlign='left';
    }
  }

  // Chart title
  ctx.font='9px "IBM Plex Mono"';
  ctx.fillStyle='rgba(255,255,255,0.2)';
  ctx.fillText('1Y F&G', cPadL, cTop-5);

  // Hover crosshair on nearest data point
  if(mX>=cPadL && mX<=cPadL+cW && mY>=cTop-10 && mY<=cBot+20 && chartAllPoints.length){
    let best=null, bestDx=Infinity;
    for(const p of chartAllPoints){
      const d=Math.abs(mX-p.x);
      if(d<bestDx){ bestDx=d; best=p; }
    }
    if(best && bestDx < cW/scores.length*4){
      ctx.setLineDash([2,3]);
      ctx.strokeStyle='rgba(255,255,255,0.18)';
      ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(best.x,cTop); ctx.lineTo(best.x,cBot); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(best.x,best.y,4,0,Math.PI*2);
      ctx.fillStyle=rc(best.color,1); ctx.fill();
      canvas._chartHover = best;
    } else { canvas._chartHover = null; }
  } else { canvas._chartHover = null; }
}

// ── DRAW ──────────────────────────────────────────────────────────────────────
function draw(){
  ctx.clearRect(0,0,W,H);
  const pal = getCur();
  const sc  = entryDone ? 1 : (()=>{ const t=entryF/ENTRY_F; return 1-Math.pow(1-t,3); })();

  drawChart(pal);

  ctx.save();
  ctx.translate(CX,CY); ctx.scale(sc,sc); ctx.translate(-CX,-CY);

  // Particles
  const pCount = Math.round(420+180*tweakDensity);
  for(let i=0;i<pCount;i++){
    const phi=i*2.39996, r2=i/pCount;
    const r=R*Math.sqrt(r2)*(0.9+Math.sin(i*1.3+noiseOff*0.5)*0.18);
    const a=phi+noiseOff*0.28*tweakDrift+Math.sin(i*0.73+noiseOff)*0.14;
    const px=CX+Math.cos(a)*r, py=CY+Math.sin(a)*r;
    ctx.beginPath(); ctx.arc(px,py,0.8,0,Math.PI*2);
    ctx.fillStyle=rc(pal.pt,(0.06+r2*0.19)*(pal.n/260)); ctx.fill();
  }

  // Secondary filaments
  for(const s of secNodes){
    ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2);
    ctx.strokeStyle=rc(pal.fil,s.op*0.75); ctx.lineWidth=0.4; ctx.stroke();
  }

  // Primary filaments
  for(const nd of primNodes){
    ctx.beginPath(); ctx.moveTo(CX,CY); ctx.lineTo(nd.x,nd.y);
    ctx.strokeStyle=rc(pal.fil,nd.op); ctx.lineWidth=0.6; ctx.stroke();
    ctx.beginPath(); ctx.arc(nd.x,nd.y,1.2,0,Math.PI*2);
    ctx.fillStyle=rc(pal.pt,0.5); ctx.fill();
  }

  // Click flash — smooth cubic ease arc
  let coreColor = pal.core;
  if(clickFlashT > 0){
    const ft = clickFlashT / CLICK_FLASH_DUR;
    const norm = 1 - ft;
    const flashStrength = norm < 0.4
      ? (norm/0.4)*(norm/0.4)*(norm/0.4)
      : Math.pow(1-(norm-0.4)/0.6, 2.5);
    const flashCol = getFlashColor(pal.core);
    coreColor = lerp3(pal.core, flashCol, flashStrength * 0.9);
  }

  // Outer core glow
  const gR = R*0.08;
  const g1 = ctx.createRadialGradient(CX,CY,0,CX,CY,gR*3.5);
  g1.addColorStop(0,   rc(coreColor,0.95));
  g1.addColorStop(0.25,rc(coreColor,0.38));
  g1.addColorStop(0.6, rc(coreColor,0.08));
  g1.addColorStop(1,   rc(coreColor,0));
  ctx.beginPath(); ctx.arc(CX,CY,gR*3.5,0,Math.PI*2); ctx.fillStyle=g1; ctx.fill();

  // Bright core
  const g2 = ctx.createRadialGradient(CX,CY,0,CX,CY,gR);
  g2.addColorStop(0, rc(coreColor,0.95)); g2.addColorStop(1, rc(coreColor,0.5));
  ctx.beginPath(); ctx.arc(CX,CY,gR,0,Math.PI*2); ctx.fillStyle=g2; ctx.fill();

  // Shimmer
  const sg = ctx.createRadialGradient(CX,CY,0,CX,CY,R*0.65);
  sg.addColorStop(0,  `hsla(${shimHue},100%,70%,0.12)`);
  sg.addColorStop(0.5,`hsla(${(shimHue+90)%360},90%,60%,0.06)`);
  sg.addColorStop(1,  `hsla(${(shimHue+180)%360},80%,50%,0)`);
  ctx.globalCompositeOperation='screen';
  ctx.beginPath(); ctx.arc(CX,CY,R*0.65,0,Math.PI*2); ctx.fillStyle=sg; ctx.fill();
  ctx.globalCompositeOperation='source-over';

  ctx.restore();

  // Ripple
  if(ripActive){
    ctx.beginPath(); ctx.arc(CX,CY,ripR,0,Math.PI*2);
    ctx.strokeStyle=`rgba(255,255,255,${ripO*0.08})`; ctx.lineWidth=1.5; ctx.stroke();
  }
}

// ── POSITION ANNOTATIONS ──────────────────────────────────────────────────────
function positionAnnotations(){
  if(!R) return;
  const spxEl = document.getElementById('ann-spx');
  const fgEl  = document.getElementById('ann-fg');
  const edge  = R*0.72;
  spxEl.style.left = (CX + edge*0.38)+'px';
  spxEl.style.top  = (CY - edge*0.9)+'px';
  fgEl.style.left  = (CX - edge*1.5)+'px';
  fgEl.style.top   = (CY + edge*0.55)+'px';
  const labelTop = Math.max(28, CY - R*0.65 - 28);
  document.getElementById('mood-label-a').style.top = labelTop+'px';
  document.getElementById('mood-label-b').style.top = labelTop+'px';
  document.getElementById('mood-label-a').style.left = CX+'px';
  document.getElementById('mood-label-b').style.left = CX+'px';
  setTimeout(updateLeaders, 50);
}

function updateLeaders(){
  const svg = document.getElementById('leaders');
  svg.setAttribute('width',W); svg.setAttribute('height',H);
  const spxEl = document.getElementById('ann-spx');
  const fgEl  = document.getElementById('ann-fg');
  const ls = document.getElementById('ldr-spx');
  const lf = document.getElementById('ldr-fg');
  if(!spxEl||!fgEl) return;
  const sr = spxEl.getBoundingClientRect();
  const fr = fgEl.getBoundingClientRect();
  const col = tweakLeaders?'rgba(255,255,255,0.15)':'transparent';
  const a1=-0.85, a2=2.3;
  ls.setAttribute('x1',CX+Math.cos(a1)*R*0.32); ls.setAttribute('y1',CY+Math.sin(a1)*R*0.32);
  ls.setAttribute('x2',sr.left); ls.setAttribute('y2',sr.top+sr.height/2);
  ls.setAttribute('stroke',col);
  lf.setAttribute('x1',CX+Math.cos(a2)*R*0.32); lf.setAttribute('y1',CY+Math.sin(a2)*R*0.32);
  lf.setAttribute('x2',fr.right); lf.setAttribute('y2',fr.top+fr.height/2);
  lf.setAttribute('stroke',col);
}

// ── MOOD LABEL CROSSFADE ──────────────────────────────────────────────────────
function setMoodLabel(text){
  const a = document.getElementById('mood-label-a');
  const b = document.getElementById('mood-label-b');
  if(labelActive==='a'){
    if(a.textContent===text) return;
    b.textContent = text;
    a.style.opacity = '0';
    b.style.opacity = '1';
    labelActive = 'b';
  } else {
    if(b.textContent===text) return;
    a.textContent = text;
    b.style.opacity = '0';
    a.style.opacity = '1';
    labelActive = 'a';
  }
}

// ── ANIMATION LOOP ────────────────────────────────────────────────────────────
function tick(){
  if(!entryDone){ entryF++; if(entryF>=ENTRY_F) entryDone=true; }

  if(ripActive){
    ripR+=3.6; ripO-=1/50;
    if(ripO<=0){ ripActive=false; ripO=0; }
  }

  if(lerpT<1){
    lerpT=Math.min(1,lerpT+1/LERP_F);
    if(lerpT>=1) curKey=tgtKey;
  }

  if(clickFlashT>0) clickFlashT--;

  const pal=getCur();
  const tRot=hovered?0.00008:pal.rot;
  curRot+=(tRot-curRot)*0.05;
  angle+=curRot;
  noiseOff+=0.0008;
  shimHue=(shimHue+0.2)%360;

  buildNodes(pal);
  draw();

  setMoodLabel(pal.label);

  const labelTop = Math.max(28, CY - R*0.65 - 28);
  document.getElementById('mood-label-a').style.top = labelTop+'px';
  document.getElementById('mood-label-b').style.top = labelTop+'px';
  document.getElementById('mood-label-a').style.left = CX+'px';
  document.getElementById('mood-label-b').style.left = CX+'px';

  const ts=document.getElementById('timestamp');
  if(ts){
    const n=new Date();
    const d=n.toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'2-digit'});
    ts.textContent=d.replace(/\//g,'/')+' '+n.toTimeString().slice(0,5);
  }

  requestAnimationFrame(tick);
}

// ── SET SENTIMENT ─────────────────────────────────────────────────────────────
function setSentiment(key){
  if(key===tgtKey&&lerpT>=1) return;
  ripR=0; ripO=1; ripActive=true;
  tgtKey=key; lerpT=0;
}

function triggerEntry(){
  entryF=0; entryDone=false;
  ripR=0; ripO=1; ripActive=true;
}

// ── DATA FETCH ────────────────────────────────────────────────────────────────
async function fetchFG(){
  const r = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {cache:'no-store'});
  if(!r.ok) throw new Error('cnn '+r.status);
  const j = await r.json();
  const fg = j.fear_and_greed;
  const hist = j.fear_and_greed_historical?.data || [];
  return { score: Math.round(fg.score), label: fg.rating, hist };
}

async function fetchSPXDirect(){
  // 1. Stooq — CORS-friendly CSV
  try{
    const ctrl = new AbortController();
    setTimeout(()=>ctrl.abort(), 5000);
    const r = await fetch('https://stooq.com/q/l/?s=%5Egspc&f=sd2t2ohlcv&h&e=csv', {cache:'no-store', signal:ctrl.signal});
    if(r.ok){
      const text = await r.text();
      const lines = text.trim().split('\n');
      if(lines.length >= 2){
        const cols = lines[1].split(',');
        const close = parseFloat(cols[6]);
        const open  = parseFloat(cols[3]);
        if(!isNaN(close) && close > 0){
          const change = close - open;
          const changePct = (change/open)*100;
          const now = new Date();
          const h = now.getUTCHours();
          const isOpen = h >= 13 && h < 20;
          return { price:close, change, changePct, direction:change>=0?'up':'down', isOpen };
        }
      }
    }
  }catch(e){}

  // 2. Financial Modeling Prep
  try{
    const ctrl = new AbortController();
    setTimeout(()=>ctrl.abort(), 5000);
    const r = await fetch('https://financialmodelingprep.com/api/v3/quote/%5EGSPC?apikey=demo', {cache:'no-store', signal:ctrl.signal});
    if(r.ok){
      const j = await r.json();
      if(j && j[0]){
        const q = j[0];
        const isOpen = q.isActivelyTrading ?? false;
        const price  = isOpen ? q.price : q.previousClose;
        const change = price - q.previousClose;
        const changePct = (change/q.previousClose)*100;
        return { price, change, changePct, direction:change>=0?'up':'down', isOpen };
      }
    }
  }catch(e){}

  // 3. Yahoo via proxies
  const target = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=2d';
  for(const url of [
    'https://corsproxy.io/?'+encodeURIComponent(target),
    'https://api.allorigins.win/get?url='+encodeURIComponent(target),
  ]){
    try{
      const ctrl = new AbortController();
      setTimeout(()=>ctrl.abort(), 4000);
      const r = await fetch(url, {cache:'no-store', signal:ctrl.signal});
      if(!r.ok) continue;
      const raw = await r.json();
      const j = raw.contents ? JSON.parse(raw.contents) : raw;
      const meta = j.chart.result[0].meta;
      const isOpen = meta.marketState === 'REGULAR';
      const price = isOpen ? meta.regularMarketPrice : meta.chartPreviousClose;
      const prev  = meta.chartPreviousClose;
      const change = price - prev;
      const changePct = (change/prev)*100;
      return { price, change, changePct, direction:change>=0?'up':'down', isOpen };
    }catch(e){ continue; }
  }
  return null;
}

async function fetchViaclaude(){
  if(!window.claude?.complete) throw new Error('claude not available');
  const raw = await window.claude.complete({
    messages:[{role:'user', content:
      'Search the web for today\'s current market data:\n' +
      '1. CNN Fear & Greed Index current score (0-100) and label\n' +
      '2. S&P 500 (SPX) latest price, change from yesterday\'s close, percent change, and whether the US market is currently open right now\n\n' +
      'Reply with ONLY this JSON object and nothing else:\n' +
      '{"spx":{"price":5832.10,"change":12.34,"changePct":0.21,"direction":"up","isOpen":false},"fearGreed":{"score":72,"label":"Greed"}}'
    }]
  });
  const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
  if(start===-1||end===-1) throw new Error('no JSON in Claude response');
  return JSON.parse(raw.slice(start, end+1));
}

async function fetchData(){
  setMoodLabel('READING THE MARKET…');
  document.getElementById('spx-val').textContent='SPX — —';
  document.getElementById('fg-val').innerHTML='F&G — —';
  document.getElementById('fg-hist').textContent='';
  setSentiment('NEUTRAL');

  let fg = null, spx = null;

  const [fgResult, spxDirect, claudeResult] = await Promise.allSettled([
    fetchFG(),
    fetchSPXDirect(),
    fetchViaclaude(),
  ]);

  fg  = fgResult.status  ==='fulfilled' ? fgResult.value  : null;
  spx = spxDirect.status ==='fulfilled' ? spxDirect.value : null;

  if(claudeResult.status==='fulfilled'){
    const d = claudeResult.value;
    if(!fg  && d.fearGreed) fg  = { ...d.fearGreed, hist:[] };
    if(!spx && d.spx)       spx = d.spx;
  }

  if(spx){
    const dir   = spx.direction==='up'?'▲':'▼';
    const pct   = Math.abs(spx.changePct).toFixed(2);
    const price = Number(spx.price).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    const tag   = spx.isOpen===false ? 'SPX PREV' : 'SPX';
    document.getElementById('spx-val').textContent=`${tag} ${price} ${dir} ${pct}%`;
  } else {
    document.getElementById('spx-val').textContent='SPX — (offline)';
  }

  if(fg){
    document.getElementById('fg-val').textContent=`F&G ${fg.score}`;
    fgScore = fg.score;

    if(fg.hist && fg.hist.length > 0){
      histScores = fg.hist.map(d=>({ x:d.x, y:d.y }));
    }

    document.getElementById('fg-hist').textContent = '';

    const key = tweakState==='auto' ? scoreToKey(fg.score) : tweakState;
    mktData = { spx, fearGreed:fg, sentiment:key };
    setSentiment(key);
  } else {
    document.getElementById('fg-val').textContent='F&G — (offline)';
    setSentiment(tweakState==='auto'?'NEUTRAL':tweakState);
  }

  setTimeout(updateLeaders, 200);
}

// ── POINTER + CLICK ───────────────────────────────────────────────────────────
canvas.addEventListener('mousemove',e=>{
  mX=e.clientX; mY=e.clientY;
  const dx=mX-CX, dy=mY-CY;
  hovered=Math.sqrt(dx*dx+dy*dy)<R*1.1;
  const tt=document.getElementById('tooltip');

  if(showChart && canvas._chartHover){
    const h = canvas._chartHover;
    const dateStr = h.date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    tt.style.display='block';
    tt.style.left=(mX+14)+'px';
    tt.style.top=(mY-8)+'px';
    tt.textContent=`${dateStr}  ·  ${h.score}  ·  ${h.label}`;
    return;
  }

  if(hovered&&fgScore!==null){
    tt.style.display='block';
    tt.style.left=(mX+14)+'px';
    tt.style.top=(mY-8)+'px';
    tt.textContent=`score: ${fgScore}`;
  } else { tt.style.display='none'; }
});
canvas.addEventListener('mouseleave',()=>{
  hovered=false; mX=-9999; mY=-9999;
  canvas._chartHover = null;
  document.getElementById('tooltip').style.display='none';
});
canvas.addEventListener('click',e=>{
  const dx=e.clientX-CX, dy=e.clientY-CY;
  if(Math.sqrt(dx*dx+dy*dy)<R*1.1){
    clickFlashT = CLICK_FLASH_DUR;
    ripR=0; ripO=0.8; ripActive=true;
  }
});
canvas.addEventListener('touchmove',e=>{ e.preventDefault(); mX=e.touches[0].clientX; mY=e.touches[0].clientY; },{passive:false});
canvas.addEventListener('touchend',()=>{ mX=-9999; mY=-9999; });

// ── CHART TOGGLE ──────────────────────────────────────────────────────────────
document.getElementById('chart-btn').addEventListener('click',()=>{
  showChart = !showChart;
  document.getElementById('chart-btn').classList.toggle('active', showChart);
});

// ── REFRESH ───────────────────────────────────────────────────────────────────
document.getElementById('refresh-btn').addEventListener('click',()=>{
  triggerEntry(); fetchData();
});

// ── TWEAKS ────────────────────────────────────────────────────────────────────
window.addEventListener('message',e=>{
  if(e.data?.type==='__activate_edit_mode')   document.getElementById('tweaks-panel').classList.add('visible');
  if(e.data?.type==='__deactivate_edit_mode') document.getElementById('tweaks-panel').classList.remove('visible');
});
window.parent.postMessage({type:'__edit_mode_available'},'*');

document.getElementById('tw-state').addEventListener('change',e=>{
  tweakState=e.target.value;
  const key=tweakState==='auto'?(mktData?.sentiment||'NEUTRAL'):tweakState;
  setSentiment(key);
});
document.getElementById('tw-density').addEventListener('input',e=>{ tweakDensity=parseFloat(e.target.value); });
document.getElementById('tw-drift').addEventListener('input',e=>{ tweakDrift=parseFloat(e.target.value); });
document.getElementById('tw-leaders').addEventListener('change',e=>{ tweakLeaders=e.target.checked; updateLeaders(); });

// ── INIT ──────────────────────────────────────────────────────────────────────
resize();
triggerEntry();
tick();
fetchData();
