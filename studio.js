"use strict";
const $ = id => document.getElementById(id);
const garments = [
  ["Boxy 短袖 T-Shirt","SHORT SLEEVE",60,72,59,24,"tee"],
  ["落肩長袖 T-Shirt","LONG SLEEVE",60,74,59,58,"long"],
  ["重磅 Sweater","CREWNECK",64,72,62,57,"sweater"],
  ["落肩 Hoodie","HOODED SWEATSHIRT",66,73,64,58,"hood"],
  ["底特律夾克","DETROIT JACKET",64,68,56,62,"jacket"],
  ["寬版彎刀運動褲","BARREL SWEATPANTS",43,103,43,22,"pants"],
  ["男款 Tank","MEN'S TANK",51,71,35,12,"tank"],
  ["女款 Tank","WOMEN'S TANK",40,54,28,12,"women"]
];
const zones = {front:"前片",back:"後片",left:"左袖",right:"右袖",hood:"帽子",pocket:"口袋",label:"領口內標"};
const measurements = {chest:"胸寬平量",shoulder:"肩寬平量",front:"前衣長",back:"後衣長",sleeve:"袖長",waist:"腰寬平量",inseam:"褲長"};
const materials = ["棉", "棉混紡", "Interlock", "運動針織", "Piqué", "羅紋", "華夫格", "搖粒絨", "法式毛圈", "運動網眼"];
const palette = ["181818","363739","666766","999994","d4d0c4","eeeade","ffffff","453832","795643","b39069","b88b7f","802a38","ba3441","e65c35","d4a626","d9dd49","727950","313d2d","4c8580","263749","38508d","615076","b4a5bd","f2a5c2","876126","1d5755","793e63","9ab0b7"];
const ranges = {
  fabricRanges:[["fold","褶皺",0,100,64],["texture","質地",0,100,42],["knit","針織尺度",1,12,4],["light","布面亮度",30,190,100]],
  sceneRanges:[["exposure","曝光",-70,100,0],["contrast","對比",30,180,100],["shadow","接地陰影",0,100,44]]
};
const canvas = $("canvas");
const work = document.createElement("canvas");
work.width = work.height = 1800;
const ctx = work.getContext("2d", {willReadFrequently:true});
let garment = 0, view = "front", zone = "front", drafts, layers, photos, pending, drag, last, tab = "art";
let timer;
function notify(message) {
  $("status").textContent = message;
  clearTimeout(timer);
  timer = setTimeout(() => $("status").textContent = "", 4200);
}
function artwork(name, width=27, height=9, image=null) {
  return {name,width,height,image,x:0,y:0,angle:0};
}
function defaults() {
  drafts = garments.map(([, , chest, length, shoulder, sleeve]) => ({chest,shoulder,front:length,back:length,sleeve,waist:chest,inseam:length}));
  layers = {front:artwork("CHRONIC 示範印花")};
  photos = {};
}
defaults();
const icon = kind => {
  let path = "M11 7 18 4q6 8 12 0l7 3 7 7-6 8-5-3v22H15V19l-5 3-6-8z";
  if (["long","sweater","hood","jacket"].includes(kind)) path = "M13 9 18 5q6 6 12 0l5 4 9 28-6 3-5-17v19H15V23l-5 17-6-3z";
  if (kind === "pants") path = "M14 5h20l4 35-10 2-4-26-4 26-10-2z";
  if (["tank","women"].includes(kind)) path = "M14 5h6q4 15 8 0h6q-3 9 5 15l-3 21H12L9 20q8-6 5-15z";
  return '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="'+path+'"/>'+ (kind==="hood"?'<path d="M18 8q-3-9 6-7 9-2 6 7l-6 7z M19 30h10l3 7H16z"/>':kind==="jacket"?'<path d="M24 10v31m2-25h6"/>':"")+'</svg>';
};
$("garments").innerHTML = garments.map(([name,sub,,,,,kind],index) => '<button class="garment" data-index="'+index+'">'+icon(kind)+'<span><b>'+name+'</b><small>'+sub+'</small></span></button>').join("");
$("material").innerHTML = materials.map((name,index) => '<option value="'+index+'">'+name+'</option>').join("");
$("swatches").innerHTML = palette.map(color => '<button style="background:#'+color+'" title="#'+color+'" aria-label="布色 #'+color+'" data-color="#'+color+'"></button>').join("");
for (const [container, rows] of Object.entries(ranges)) {
  $(container).innerHTML = rows.map(([id,label,min,max,value]) => '<label class="field">'+label+'<output id="'+id+'Out"></output><input id="'+id+'" type="range" min="'+min+'" max="'+max+'" value="'+value+'"></label>').join("");
}
function availableZones() {
  const kind = garments[garment][6];
  if (kind==="pants") return ["front","back","pocket","label"];
  if (["tank","women"].includes(kind)) return ["front","back","label"];
  return ["front","back","left","right",...(kind==="hood"?["hood","pocket"]:kind==="jacket"?["pocket"]:[]),"label"];
}
function activePhoto() { return photos[garment+"-"+view]; }
function updateUI() {
  const [name,,,,,,kind] = garments[garment];
  $("title").textContent = name;
  document.querySelectorAll(".garment").forEach((button,i) => button.classList.toggle("on",i===garment));
  document.querySelectorAll("#view button").forEach(button => button.classList.toggle("on",button.dataset.value===view));
  document.querySelectorAll("#tabs button").forEach(button => {
    $(button.dataset.value).hidden = button.dataset.value!==tab;
    button.classList.toggle("on",button.dataset.value===tab);
  });
  $("mode").textContent = view==="pattern"?"PATTERN":{flat:"FLAT LAY",hang:"HANGING",form:"DISPLAY FORM"}[$("pose").value];
  $("pose").disabled = view==="pattern" || !!activePhoto();
  $("removePhoto").hidden = !activePhoto();
  if (!availableZones().includes(zone)) zone = view==="back"?"back":"front";
  $("zone").innerHTML = availableZones().map(key => '<option value="'+key+'">'+zones[key]+'</option>').join("");
  $("zone").value = zone;
  const keys = kind==="pants"?["waist","inseam"]:["chest","shoulder","front","back",...(availableZones().includes("left")?["sleeve"]:[])];
  $("measurements").innerHTML = keys.map(key => '<label class="field">'+measurements[key]+' cm<input type="number" min="5" max="180" step="0.1" data-measure="'+key+'" value="'+drafts[garment][key]+'"></label>').join("");
  syncLayer();
}
function syncLayer(skip="") {
  const layer = layers[zone];
  $("layerName").textContent = layer?.name ?? "尚未加入圖案";
  $("artSize").textContent = layer ? layer.width.toFixed(1)+" × "+layer.height.toFixed(1)+" cm" : zones[zone];
  $("clearArt").disabled = !layer;
  const fields = {printWidth:"width",printHeight:"height",offsetX:"x",offsetY:"y",angle:"angle"};
  for (const [id,key] of Object.entries(fields)) {
    $(id).disabled = !layer;
    if (id!==skip) $(id).value = layer ? Number(layer[key].toFixed(2)) : "";
  }
  $("angleOut").textContent = layer ? layer.angle+"°" : "";
}
const path = d => new Path2D(d);
function color(hex, amount=0) {
  const n = parseInt(hex.slice(1),16);
  const clamp = x => Math.max(0,Math.min(255,Math.round(x+amount)));
  return "rgb("+clamp(n>>16)+","+clamp((n>>8)&255)+","+clamp(n&255)+")";
}
function geometry(side = view) {
  const d = drafts[garment], kind = garments[garment][6], fit = +$("fitType").value;
  const pose = view==="pattern"?"flat":$("pose").value;
  const pants = kind==="pants", tank = kind==="tank"||kind==="women";
  const len = pants?d.inseam:(side==="back"?d.back:d.front);
  const chest = (pants?d.waist:d.chest)*fit;
  const shoulder = d.shoulder * (fit>1.15?1.13:1);
  const long = ["long","sweater","hood","jacket"].includes(kind);
  const span = pants?chest*1.35:tank?Math.max(chest,shoulder):Math.max(chest,shoulder)+d.sleeve*(long?.95:1.4);
  const scale = Math.min(645/span, 590/(len+(kind==="hood"?18:0)));
  const half = chest*scale/2, sh = Math.min(shoulder*scale/2,half*1.25), h = len*scale*(pose==="hang"?1.07:1), sl = d.sleeve*scale;
  const x=450,y=(900-h)/2+(kind==="hood"?38:0), bend=pose==="hang"?19:pose==="form"?10:0;
  const hem = y+h, neck=Math.min(half*.66, Math.max(26,scale*(tank?9:10)));
  const sy=y+18, armpit=y+Math.min(h*.43,Math.max(50,scale*(tank?24:25)));
  const l=x-half,r=x+half, ls=x-sh,rs=x+sh;
  const p = [], anchors = {};
  function piece(key,d,seams=[], folds=[]) { const shape=path(d); p.push({key,shape,seams:seams.map(path),folds}); return shape; }
  const bodyKey=side==="back"?"back":"front";
  if (pants) {
    const crotch=y+h*.34, flare=half*.22;
    piece(bodyKey,`M${l} ${y}Q450 ${y-5} ${r} ${y} C${r+flare} ${y+h*.28} ${r+flare*2} ${hem-83} ${r-4} ${hem} Q${r-half*.45} ${hem+6} 460 ${hem-2} Q472 ${crotch+42} 450 ${crotch} Q428 ${crotch+42} 440 ${hem-2} Q${l+half*.45} ${hem+6} ${l+4} ${hem} C${l-flare*2} ${hem-83} ${l-flare} ${y+h*.28} ${l} ${y}Z`,[`M${l} ${y+24}Q450 ${y+30} ${r} ${y+24}`,`M450 ${y+25}V${crotch}`,`M${l+4} ${hem-11}H440 M460 ${hem-11}H${r-4}`],[[l+25,y+35,l+10,hem-15],[r-21,y+42,r+4,hem-13]]);
    anchors[bodyKey]=[x+half*.64,y+h*.22];
    const px=x-half*.5,py=y+h*.13;
    piece("pocket",`M${px-23} ${py-25}H${px+24}L${px+19} ${py+27}Q${px} ${py+33} ${px-25} ${py+20}Z`,[`M${px-22} ${py-16}H${px+23}`]);
    anchors.pocket=[px,py];anchors.label=[x,y+12];
  } else {
    if (!tank) for (const [key,sign] of [["left",-1],["right",1]]) {
      const f = n=>x+sign*n;
      const tip = sh+sl*(pose==="hang"?(long?.24:.69):long?.50:.88);
      const cuffY = sy+sl*(long?.88:.59)+bend;
      const cuff = Math.max(17,(armpit-sy)*(long?.30:.68));
      piece(key,`M${f(sh-15)} ${sy} C${f(sh+sl*.25)} ${sy+2} ${f(tip-10)} ${cuffY-26} ${f(tip)} ${cuffY} L${f(tip-cuff)} ${cuffY+cuff*.42} Q${f(sh+sl*.16)} ${armpit+6} ${f(half-10)} ${armpit}Z`,[`M${f(tip-6)} ${cuffY-7}L${f(tip-cuff+2)} ${cuffY+cuff*.42-7}`],[[f(sh+3),sy+11,f(tip-14),cuffY]]);
      anchors[key]=[f((sh+tip)/2-6),(sy+cuffY)/2+20];
    }
    if (kind==="hood") {
      const hh=scale*18, hw=neck*1.52;
      piece("hood",`M${x-hw} ${y+15} C${x-hw*1.1} ${y-hh*.28} ${x-hw*.65} ${y-hh} ${x} ${y-hh} C${x+hw*.77} ${y-hh} ${x+hw} ${y-hh*.34} ${x+hw} ${y+15} Q450 ${y+66} ${x-hw} ${y+15}Z`,[side==="back"?`M450 ${y-hh+5}Q464 ${y-hh*.34} 450 ${y+26}`:`M${x-hw*.65} ${y+15}C${x-hw*.7} ${y-hh*.85} ${x+hw*.7} ${y-hh*.85} ${x+hw*.65} ${y+15}`],[[x-20,y-hh+13,x-5,y+12]]);
      anchors.hood=[450,y-hh*.47];
    }
    const scoop = y + (side==="back"?14:tank?56:kind==="jacket"?32:29);
    const arm = tank
      ? `Q${r-40} ${armpit-34} ${r} ${armpit}`
      : `Q${rs-18} ${armpit-40} ${r} ${armpit}`;
    const waist = half*(pose==="form"?.86:kind==="women"?.79:.98);
    piece(bodyKey,`M${ls} ${sy} Q${x-neck*1.7} ${y+2} ${x-neck} ${y} C${x-neck*.72} ${scoop} ${x+neck*.72} ${scoop} ${x+neck} ${y} Q${x+neck*1.7} ${y+2} ${rs} ${sy} ${arm} Q${x+waist} ${y+h*.64} ${r+bend*.36} ${hem-5} Q450 ${hem+12+bend*.28} ${l-bend*.36} ${hem-4} Q${x-waist} ${y+h*.60} ${l} ${armpit} Q${tank?l+40:ls+18} ${armpit-36} ${ls} ${sy}Z`,[
      `M${x-neck} ${y+5}C${x-neck*.7} ${scoop+13} ${x+neck*.7} ${scoop+13} ${x+neck} ${y+5}`,
      `M${l+4} ${hem-17}Q450 ${hem+bend*.27} ${r-4} ${hem-17}`,
      `M${l+4} ${hem-13}Q450 ${hem+4+bend*.27} ${r-4} ${hem-13}`
    ],[[l+19,armpit,l+52,hem-30],[r-14,armpit+9,r-65,hem-30],[x-67,sy+26,x-48,hem-42],[r-20,hem-55,x-69,hem-12],[l+11,hem-66,x+41,hem-25]]);
    anchors[bodyKey]=[x,y+h*.28];
    anchors.label=[x,y+Math.max(8,(scoop-y)*.38)];
    if ((kind==="hood" || kind==="jacket") && side!=="back") {
      const px=kind==="hood"?x:x+half*.60, py=kind==="hood"?hem-h*.24:y+h*.36;
      const w=half*(kind==="hood"?.74:.31), ph=kind==="hood"?h*.16:h*.12;
      piece("pocket",`M${px-w*.73} ${py-ph*.52}H${px+w*.73} L${px+w} ${py+ph*.33} L${px+w*.94} ${py+ph*.52} H${px-w*.94} L${px-w} ${py+ph*.33}Z`,[`M${px-w*.70} ${py-ph*.43}H${px+w*.70} M${px-w*.86} ${py+ph*.42}H${px+w*.86}`]);
      anchors.pocket=[px,py];
    }
    if (kind==="jacket" && side!=="back") {
      p.find(item=>item.key===bodyKey).seams.push(path(`M448 ${y+21}V${hem} M452 ${y+21}V${hem} M${ls} ${sy}L${x-neck*.62} ${y+46}L450 ${y+21}L${x+neck*.62} ${y+46}L${rs} ${sy}`));
    }
  }
  return {p, anchors, scale, y, hem, half, h};
}
const grain = document.createElement("canvas");
grain.width = grain.height = 192;
const gc = grain.getContext("2d");
let seed = 81219;
function random() { seed = (1664525*seed+1013904223)>>>0; return seed/4294967296; }
const noise = gc.createImageData(192,192);
for(let n=0;n<noise.data.length;n+=4) {
  const v=random()>.52?255:0;
  noise.data[n]=noise.data[n+1]=noise.data[n+2]=v;
  noise.data[n+3]=Math.round(random()*85);
}
gc.putImageData(noise,0,0);
let weaveKey, weave;
function weavePattern() {
  const material=+$("material").value, knit=+$("knit").value;
  const key=material+"-"+knit;
  if (key===weaveKey) return weave;
  const tile=document.createElement("canvas"), size=Math.max(3,knit+1);
  tile.width=tile.height=size;
  const t=tile.getContext("2d");
  if (material===9 || material===4 || material===7) {
    t.fillStyle="#0009";t.beginPath();t.ellipse(size*.45,size*.45,size*.22,size*.17,-.3,0,7);t.fill();
    t.strokeStyle="#fff5";t.beginPath();t.arc(size*.45,size*.55,size*.26,0,2.8);t.stroke();
  } else {
    t.fillStyle="#fff5";
    t.fillRect(0,0,1,material===5?size:Math.ceil(size/2));
    t.fillRect(Math.floor(size/2),Math.floor(size/2),1,size);
    if (material===6) t.fillRect(0,0,size,1);
    t.fillStyle="#0008";t.fillRect(1,0,1,size);
  }
  weaveKey=key;weave=ctx.createPattern(tile,"repeat");
  return weave;
}
function fold(g, coords, strength) {
  const [x,y,xx,yy]=coords;
  const grad=ctx.createLinearGradient(x,y,xx,yy);
  grad.addColorStop(0,"transparent");grad.addColorStop(.17,"rgba(0,0,0,"+strength+")");
  grad.addColorStop(.58,"rgba(255,255,255,"+strength*.58+")");grad.addColorStop(1,"transparent");
  ctx.strokeStyle=grad;ctx.lineWidth=4+g.scale*.65;ctx.filter="blur("+Math.max(4,g.scale*.77)+"px)";
  ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+(xx-x)*.10,y+(yy-y)*.46,xx-(xx-x)*.28,yy-(yy-y)*.16,xx,yy);ctx.stroke();
  ctx.filter="none";
}
function shade(item,g,art) {
  ctx.save();ctx.clip(item.shape);
  const strength=+$("fold").value/100, brightness=(+$("light").value-100)*.55;
  const base=$("color").value, end=$("gradient").checked?$("color2").value:base;
  const grad=ctx.createLinearGradient(290,g.y-100,643,g.hem);
  grad.addColorStop(0,color(base,brightness+30));grad.addColorStop(.43,color(base,brightness+3));
  grad.addColorStop(1,color(end,brightness-13));
  ctx.fillStyle=grad;ctx.fillRect(0,0,900,900);
  const glow=ctx.createRadialGradient(410,g.y+g.h*.32,16,430,g.y+g.h*.42,g.h*.69);
  glow.addColorStop(0,"rgba(255,255,255,.08)");glow.addColorStop(.56,"transparent");glow.addColorStop(1,"rgba(0,0,0,.37)");
  ctx.fillStyle=glow;ctx.fillRect(0,0,900,900);
  if (art) printArtwork(art,item.key,g);
  const ripple=ctx.createLinearGradient(450-g.half,0,450+g.half,0);
  for (const [position,tone,opacity] of [[0,0,.54],[.08,0,.07],[.17,255,.08],[.25,0,.13],[.34,255,.07],[.45,0,0],[.58,255,.08],[.68,0,.16],[.77,255,.11],[.88,0,.14],[1,0,.36]]) {
    ripple.addColorStop(position,"rgba("+tone+","+tone+","+tone+","+opacity*strength+")");
  }
  ctx.fillStyle=ripple;ctx.fillRect(0,0,900,900);
  for (const coords of item.folds) fold(g,coords,strength*.65);
  const texture=+$("texture").value/100;
  ctx.globalAlpha=texture*.57;ctx.fillStyle=weavePattern();ctx.fillRect(0,0,900,900);
  ctx.globalAlpha=texture*.6;ctx.fillStyle=ctx.createPattern(grain,"repeat");ctx.fillRect(0,0,900,900);
  ctx.globalAlpha=1;
  ctx.lineWidth=3;ctx.strokeStyle="#0005";ctx.stroke(item.shape);
  for(const seam of item.seams) {
    ctx.lineWidth=4;ctx.strokeStyle="#0005";ctx.stroke(seam);
    ctx.setLineDash([1.6,1.9]);ctx.lineWidth=.9;ctx.strokeStyle="#d0cfb557";ctx.stroke(seam);ctx.setLineDash([]);
  }
  ctx.restore();
}
function printArtwork(layer,key,g,{full=false}={}) {
  const pos=g.anchors[key];
  if(!pos) return;
  const [x,y]=pos, w=layer.width*g.scale, h=layer.height*g.scale;
  ctx.save();ctx.translate(x+layer.x*g.scale,y+layer.y*g.scale);ctx.rotate(layer.angle*Math.PI/180);
  if(layer.image) ctx.drawImage(layer.image,-w/2,-h/2,w,h);
  else {
    ctx.scale(w/320,h/100);
    ctx.fillStyle="#e4dfca";ctx.textAlign="center";ctx.font="italic 900 70px Arial";
    ctx.fillText("CHRONIC",0,6,320);
    ctx.fillRect(-155,17,310,1.7);
    ctx.font="bold 14px monospace";ctx.fillText("T R U S T   T H E   P R O C E S S",0,39,304);
  }
  if(full) {
    ctx.strokeStyle="#7e9f31";ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.strokeRect(-w/2,-h/2,w,h);ctx.setLineDash([]);
  }
  ctx.restore();
}
function drawPattern(g, format) {
  if(format==="preview"){ctx.fillStyle="#f6f7f1";ctx.fillRect(0,0,900,900);}
  ctx.lineWidth=.7;ctx.strokeStyle="#d9dece";
  const step=g.scale*5;
  ctx.beginPath();
  for(let i=450%step;i<900;i+=step){ctx.moveTo(i,0);ctx.lineTo(i,900);ctx.moveTo(0,i);ctx.lineTo(900,i);}
  if(format==="preview")ctx.stroke();
  const item=g.p.find(piece=>piece.key===zone);
  if(item) {
    ctx.fillStyle="#e2e6d9";ctx.fill(item.shape);ctx.lineWidth=1.5;ctx.strokeStyle="#5c674d";ctx.stroke(item.shape);
    ctx.setLineDash([3,5]);for(const seam of item.seams)ctx.stroke(seam);ctx.setLineDash([]);
  } else if(zone==="label" && g.anchors.label) {
    const [x,y]=g.anchors.label;ctx.strokeStyle="#5c674d";ctx.strokeRect(x-g.scale*4,y-g.scale*2,g.scale*8,g.scale*4);
  }
  if(layers[zone]) printArtwork(layers[zone],zone,g,{full:format==="preview"});
  ctx.font="bold 16px monospace";ctx.fillStyle="#46513b";if(format==="preview")ctx.fillText(zones[zone]+"  /  5 cm GRID",32,840);
}
function dropShadow(g) {
  const opacity=+$("shadow").value/100;
  const shadow=ctx.createRadialGradient(450,g.hem+5,4,450,g.hem+5,g.half*1.34);
  shadow.addColorStop(0,"rgba(0,0,0,"+opacity*.45+")");shadow.addColorStop(.67,"rgba(0,0,0,"+opacity*.13+")");shadow.addColorStop(1,"transparent");
  ctx.save();ctx.translate(450,g.hem+5);ctx.scale(1,.15);ctx.translate(-450,-g.hem-5);
  ctx.fillStyle=shadow;ctx.fillRect(0,-2000,900,5000);ctx.restore();
}
function drawForm(g) {
  const gradient=ctx.createLinearGradient(403,0,497,0);
  gradient.addColorStop(0,"#99948a");gradient.addColorStop(.42,"#e4ded3");gradient.addColorStop(1,"#a9a397");
  ctx.fillStyle=gradient;
  ctx.fill(path(`M413 ${g.y+36} Q420 ${g.y-1} 421 ${g.y-35} Q449 ${g.y-41} 478 ${g.y-35} Q478 ${g.y-4} 487 ${g.y+36}Z`));
  ctx.fillStyle="#9e9e97";ctx.fillRect(445,g.hem-12,10,79);
  ctx.fill(path(`M445 ${g.hem+59}h10l43 6v4h-96v-4Z`));
}
function render(target=canvas, format="preview") {
  const g=geometry(view==="pattern"?(zone==="back"?"back":"front"):view);
  last=g;
  const output=target.getContext("2d");
  const exposure=+$("exposure").value, contrast=+$("contrast").value;
  ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,900,900);
  if(view==="pattern") drawPattern(g,format);
  else {
    const photo=activePhoto();
    if(photo) {
      const f=Math.min(810/photo.naturalWidth,810/photo.naturalHeight);
      const w=photo.naturalWidth*f,h=photo.naturalHeight*f;
      ctx.drawImage(photo,450-w/2,450-h/2,w,h);
      const source=ctx.getImageData(0,0,1800,1800);
      ctx.clearRect(0,0,900,900);
      for(const k of Object.keys(g.anchors)) if(layers[k]) printArtwork(layers[k],k,g);
      const ink=ctx.getImageData(0,0,1800,1800);
      for(let i=0;i<ink.data.length;i+=4) {
        if(!ink.data[i+3]||!source.data[i+3])continue;
        const a=ink.data[i+3]/255, b=source.data[i+3]/255;
        const light=(source.data[i]*.21+source.data[i+1]*.72+source.data[i+2]*.07)/255;
        for(let c=0;c<3;c++)source.data[i+c]=ink.data[i+c]*a*(.81+light*.19)+source.data[i+c]*(1-a);
        source.data[i+3]=b*255;
      }
      ctx.putImageData(source,0,0);
    } else {
      dropShadow(g);
      if($("pose").value==="form" && garments[garment][6]!=="pants") drawForm(g);
      for(const item of g.p) shade(item,g,layers[item.key]);
      if(zone==="label"&&layers.label&&view==="front") printArtwork(layers.label,"label",g);
    }
  }
  output.clearRect(0,0,1800,1800);
  if(format!=="png") {
    output.fillStyle=$("background").value;
    output.fillRect(0,0,1800,1800);
  }
  if(view!=="pattern") output.filter="brightness("+(1+exposure/100)+") contrast("+contrast+"%)";
  output.drawImage(work,0,0);
  output.filter="none";
  if(format==="preview") {
    const layer=layers[zone];
    $("readout").textContent=zones[zone]+(layer?" · "+layer.width.toFixed(1)+" × "+layer.height.toFixed(1)+" CM":"");
    document.querySelector(".scale span").style.width=(10*g.scale*canvas.clientWidth/900)+"px";
    document.querySelector(".scale").hidden=!!activePhoto();
    for(const rows of Object.values(ranges)) for(const [id] of rows) $(id+"Out").textContent=$(id).value;
  }
}
function schedule() {
  if(pending) return;
  pending=requestAnimationFrame(()=>{pending=0;render();});
}
function choose(nextView,nextZone) {
  view=nextView;zone=nextZone;updateUI();schedule();
}
$("garments").addEventListener("click",event=>{
  const choice=event.target.closest("[data-index]");
  if(!choice)return;
  garment=+choice.dataset.index;updateUI();schedule();
});
$("view").addEventListener("click",event=>{
  const next=event.target.dataset.value;
  if(next)choose(next,next==="pattern"?zone:next);
});
$("tabs").addEventListener("click",event=>{
  if(!event.target.dataset.value)return;
  tab=event.target.dataset.value;updateUI();
});
$("zone").addEventListener("change",event=>{
  const key=event.target.value;
  choose(view==="pattern"?view:key==="back"?"back":"front",key);
});
$("clearArt").onclick=()=>{delete layers[zone];syncLayer();schedule();};
const bound = (value,min,max) => Math.max(min,Math.min(max,value));
for(const [id,key] of Object.entries({printWidth:"width",printHeight:"height",offsetX:"x",offsetY:"y",angle:"angle"})) {
  $(id).addEventListener("input",event=>{
    const value=Number(event.target.value);
    if(event.target.value===""||!Number.isFinite(value)||!layers[zone])return;
    layers[zone][key]=key==="width"||key==="height"?bound(value,.1,150):key==="angle"?value:bound(value,-180,180);
    syncLayer(id);schedule();
  });
  $(id).addEventListener("change",()=>syncLayer());
}
$("measurements").addEventListener("input",event=>{
  const key=event.target.dataset.measure;
  const number=Number(event.target.value);
  if(key&&event.target.value!==""&&Number.isFinite(number)) {
    drafts[garment][key]=bound(number,5,180);schedule();
  }
});
$("measurements").addEventListener("change",event=>{
  const key=event.target.dataset.measure;
  if(key) event.target.value=drafts[garment][key];
});
const aliases={胸寬:"chest",胸寬平量:"chest",肩寬:"shoulder",肩寬平量:"shoulder",前衣長:"front",後衣長:"back",袖長:"sleeve",腰寬:"waist",腰寬平量:"waist",褲長:"inseam",length:"front"};
$("sizeFile").addEventListener("change",async event=>{
  const file=event.target.files[0];if(!file)return;
  const style=garment;
  try {
    const raw=(await file.text()).replace(/^\uFEFF/,"").trim();
    const rows=file.name.toLowerCase().endsWith(".json")?Object.entries(JSON.parse(raw)):raw.split(/\r?\n/).map(line=>line.split(",").map(value=>value.trim().replace(/^"|"$/g,"")));
    const changes={};
    for (const [input,value] of rows) {
      const key=aliases[input]??input;
      const number=Number(value);
      if(Object.hasOwn(measurements,key)&&Number.isFinite(number)&&number>=5&&number<=180)changes[key]=number;
    }
    if(!Object.keys(changes).length)throw Error();
    Object.assign(drafts[style],changes);updateUI();schedule();notify("已套用 "+Object.keys(changes).length+" 項尺寸");
  }catch{notify("讀取失敗，請確認格式和公分數值。");}
  event.target.value="";
});
function loadImage(file) {
  return new Promise((resolve,reject)=>{
    if(!file || !/^image\/(png|jpeg|webp|svg\+xml)$/i.test(file.type)) return reject(Error("請使用 PNG、JPG、WebP 或 SVG。"));
    const url=URL.createObjectURL(file), img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(Error("無法讀取圖檔。"));};img.src=url;
  });
}
async function upload(file) {
  const selected=zone;
  try{
    const img=await loadImage(file);
    const ratio=img.naturalWidth/img.naturalHeight;
    const w=Math.min(selected==="label"?7:selected==="pocket"?13:28,150*ratio);
    layers[selected]=artwork(file.name,Math.max(.1,w),bound(w/ratio,.1,150),img);
    syncLayer();schedule();notify("已加入"+zones[selected]+"圖案");
  }catch(error){notify(error.message);}
}
$("upload").addEventListener("change",event=>{if(event.target.files[0])upload(event.target.files[0]);event.target.value="";});
for(const name of ["dragover","dragleave","drop"]) $("drop").addEventListener(name,event=>{
  event.preventDefault();$("drop").classList.toggle("drag",name==="dragover");
  if(name==="drop"&&event.dataTransfer.files[0])upload(event.dataTransfer.files[0]);
});
$("photo").addEventListener("change",async event=>{
  if(!event.target.files[0])return;
  const side=view==="pattern"?(zone==="back"?"back":"front"):view, style=garment;
  try{
    photos[style+"-"+side]=await loadImage(event.target.files[0]);
    if(style===garment)choose(side,side);
    notify("已套用"+(side==="front"?"正面":"背面")+"實拍底圖");
  }catch(error){notify(error.message);}
  event.target.value="";
});
$("removePhoto").onclick=()=>{delete photos[garment+"-"+view];updateUI();schedule();};
for(const id of ["color","color2","gradient","material","background","fitType",...Object.values(ranges).flat().map(([id])=>id)]) $(id).addEventListener("input",schedule);
$("swatches").addEventListener("click",event=>{if(event.target.dataset.color){$("color").value=event.target.dataset.color;schedule();}});
$("pose").addEventListener("change",()=>{updateUI();schedule();});
function point(event) {
  const box=canvas.getBoundingClientRect();
  return [(event.clientX-box.left)/box.width*900,(event.clientY-box.top)/box.height*900];
}
canvas.addEventListener("wheel",event=>{
  if(!event.shiftKey||!layers[zone]||!last?.anchors[zone])return;
  event.preventDefault();
  const layer=layers[zone], smallest=Math.min(layer.width,layer.height), largest=Math.max(layer.width,layer.height);
  const factor=bound(Math.exp(-Math.sign(event.deltaY)*.07),.1/smallest,150/largest);
  layer.width*=factor;layer.height*=factor;
  syncLayer();schedule();
},{passive:false});
canvas.addEventListener("pointerdown",event=>{
  if (!last||event.button!==0)return;
  const [x,y]=point(event);
  const keys=view==="pattern"?[zone]:[zone,...Object.keys(last.anchors).reverse()];
  for(const key of keys){
    const layer=layers[key], anchor=last.anchors[key];
    if(!layer||!anchor||(key==="label"&&view!=="pattern"&&view==="back"))continue;
    const dx=x-anchor[0]-layer.x*last.scale,dy=y-anchor[1]-layer.y*last.scale;
    const angle=layer.angle*Math.PI/180, px=dx*Math.cos(angle)+dy*Math.sin(angle),py=-dx*Math.sin(angle)+dy*Math.cos(angle);
    if(Math.abs(px)>layer.width*last.scale/2+5||Math.abs(py)>layer.height*last.scale/2+5)continue;
    zone=key;updateUI();drag={key,x,y,startX:layer.x,startY:layer.y,scale:last.scale};canvas.setPointerCapture(event.pointerId);canvas.style.cursor="grabbing";break;
  }
});
canvas.addEventListener("pointermove",event=>{
  if(!drag||!layers[drag.key])return;
  const [x,y]=point(event),layer=layers[drag.key];
  layer.x=bound(drag.startX+(x-drag.x)/drag.scale,-180,180);layer.y=bound(drag.startY+(y-drag.y)/drag.scale,-180,180);
  syncLayer();schedule();
});
for(const name of ["pointerup","lostpointercapture","pointercancel"])canvas.addEventListener(name,()=>{drag=null;canvas.style.cursor="default";});
$("reset").onclick=()=>{
  if(!confirm("重設所有版型、印花和場景設定？"))return;
  defaults();garment=0;tab="art";
  for(const [id,value] of Object.entries({pose:"flat",fitType:"1",material:"0",color:"#181818",color2:"#474747",background:"#ffffff"}))$(id).value=value;
  $("gradient").checked=false;
  for(const rows of Object.values(ranges))for(const [id,,,,value] of rows)$(id).value=value;
  choose("front","front");
};
$("export").onclick=()=>$("dialog").showModal();
for (const format of ["png","jpg"]) $(format).onclick=()=>{
  const filename="CHRONIC-"+garments[garment][6]+"-"+view+"."+format;
  const output=document.createElement("canvas");output.width=output.height=1800;
  render(output,format);
  output.toBlob(blob=>{
    if(!blob){notify("匯出失敗，請重新上傳圖案後再試。");return;}
    const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;
    link.download=filename;
    link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);$("dialog").close();notify("已下載 "+format.toUpperCase());
  },format==="png"?"image/png":"image/jpeg",.95);
};
updateUI();schedule();new ResizeObserver(schedule).observe(canvas);
