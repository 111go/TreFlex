'use strict';

const { Plugin, ItemView, TFile, Notice } = require('obsidian');

const VIEW_TYPE = 'topic-map-view';

// ── Node geometry ──────────────────────────────────────────────────────────
const NW    = 110;   // node width
const NH    = 28;    // node height (no-wrap)
const NHW   = 46;    // node height (wrap)
const LGAP  = 100;   // vertical gap between levels
const SGAP  = 48;    // horizontal sibling gap
const BSIZE = 14;    // + button size (sits ON the border, no gap)

const LEVEL_LABELS = ['Root','L1','L2','L3','L4','L5'];

// ── Presets ────────────────────────────────────────────────────────────────
const PRESETS = [
  { name: '🎨 Default',
    colors: [
      {bg:'#5B21B6',text:'#fff'},{bg:'#1D4ED8',text:'#fff'},{bg:'#0E7490',text:'#fff'},
      {bg:'#047857',text:'#fff'},{bg:'#B45309',text:'#fff'},{bg:'#B91C1C',text:'#fff'},
    ]},
  { name: '🌊 Calm',
    colors: [
      {bg:'#1E3A5F',text:'#E8F4FD'},{bg:'#2E6DA4',text:'#fff'},{bg:'#3A9ABF',text:'#fff'},
      {bg:'#4AACAA',text:'#fff'},  {bg:'#5FB88A',text:'#fff'},{bg:'#7ECBA1',text:'#1E3A5F'},
    ]},
  { name: '🌿 Sage',
    colors: [
      {bg:'#2D4739',text:'#E8F5EC'},{bg:'#3D6B52',text:'#fff'},{bg:'#5A8C6E',text:'#fff'},
      {bg:'#7DAF90',text:'#fff'},  {bg:'#A3C8B2',text:'#2D4739'},{bg:'#C9E4D4',text:'#2D4739'},
    ]},
  { name: '👁 Colorblind-safe',
    colors: [
      {bg:'#0072B2',text:'#fff'},{bg:'#E69F00',text:'#1a1a1a'},{bg:'#009E73',text:'#fff'},
      {bg:'#CC79A7',text:'#fff'},{bg:'#56B4E9',text:'#1a1a1a'},{bg:'#D55E00',text:'#fff'},
    ]},
  { name: '🌅 Sunset',
    colors: [
      {bg:'#6B1E4A',text:'#FCE7F3'},{bg:'#A8314A',text:'#fff'},{bg:'#D4524A',text:'#fff'},
      {bg:'#E07E4B',text:'#fff'},  {bg:'#E8A84B',text:'#1a1a1a'},{bg:'#EDD17A',text:'#1a1a1a'},
    ]},
  { name: '🩶 Slate',
    colors: [
      {bg:'#0F172A',text:'#F1F5F9'},{bg:'#1E293B',text:'#F1F5F9'},{bg:'#334155',text:'#fff'},
      {bg:'#475569',text:'#fff'},  {bg:'#64748B',text:'#fff'},  {bg:'#94A3B8',text:'#0F172A'},
    ]},
  { name: '🍬 Pastel',
    colors: [
      {bg:'#A78BFA',text:'#2E1065'},{bg:'#60A5FA',text:'#1E3A8A'},{bg:'#34D399',text:'#064E3B'},
      {bg:'#FCD34D',text:'#451A03'},{bg:'#F9A8D4',text:'#500724'},{bg:'#6EE7B7',text:'#064E3B'},
    ]},
];

// ── Color helpers ──────────────────────────────────────────────────────────
function hexRgb(h) { return { r:parseInt(h.slice(1,3),16), g:parseInt(h.slice(3,5),16), b:parseInt(h.slice(5,7),16) }; }
function darken(h, a=22) { const {r,g,b}=hexRgb(h); const d=v=>Math.max(0,v-a).toString(16).padStart(2,'0'); return '#'+d(r)+d(g)+d(b); }
function autoText(h) { const {r,g,b}=hexRgb(h); return (0.299*r+0.587*g+0.114*b)/255>0.58?'#111827':'#ffffff'; }
function rgba(h,a) { const {r,g,b}=hexRgb(h); return `rgba(${r},${g},${b},${a})`; }

// ── Layout ─────────────────────────────────────────────────────────────────
function computeDepths(nodes,edges){
  const ci=new Set(edges.map(e=>e.to)),depth={};
  const q=nodes.filter(n=>!ci.has(n.id)).map(n=>({id:n.id,d:0}));
  while(q.length){const{id,d}=q.shift();if(depth[id]!==undefined)continue;depth[id]=d;edges.filter(e=>e.from===id).forEach(e=>q.push({id:e.to,d:d+1}));}
  nodes.forEach(n=>{if(depth[n.id]===undefined)depth[n.id]=0;});
  return depth;
}
function countDesc(id,edges){let c=0;const v=nid=>edges.filter(e=>e.from===nid).forEach(e=>{c++;v(e.to);});v(id);return c;}
function subW(id,edges,col,memo={}){
  if(memo[id]!==undefined)return memo[id];
  if(col.has(id)){memo[id]=NW;return NW;}
  const ch=edges.filter(e=>e.from===id).map(e=>e.to);
  if(!ch.length){memo[id]=NW;return NW;}
  const t=ch.reduce((s,c)=>s+subW(c,edges,col,memo),0)+SGAP*(ch.length-1);
  memo[id]=Math.max(t,NW);return memo[id];
}
function placeNode(id,cx,y,edges,col,pos,memo){
  pos[id]={x:cx,y};
  if(col.has(id))return;
  const ch=edges.filter(e=>e.from===id).map(e=>e.to);
  if(!ch.length)return;
  const ws=ch.map(c=>subW(c,edges,col,memo));
  const tw=ws.reduce((s,w)=>s+w,0)+SGAP*(ch.length-1);
  let rx=cx-tw/2;
  ch.forEach((c,i)=>{placeNode(c,rx+ws[i]/2,y+LGAP,edges,col,pos,memo);rx+=ws[i]+SGAP;});
}
function layout(nodes,edges,col){
  const ci=new Set(edges.map(e=>e.to)),roots=nodes.filter(n=>!ci.has(n.id));
  const pos={},m={},m2={};
  let rx=-(roots.reduce((s,r)=>s+subW(r.id,edges,col,m2),0)+SGAP*(roots.length-1))/2;
  for(const r of roots){const w=subW(r.id,edges,col,m);placeNode(r.id,rx+w/2,0,edges,col,pos,m);rx+=w+SGAP;}
  nodes.forEach(n=>{if(!pos[n.id])pos[n.id]={x:0,y:500};});
  return pos;
}

// ══════════════════════════════════════════════════════════════════════════════
// View
// ══════════════════════════════════════════════════════════════════════════════
class TopicMapView extends ItemView {
  constructor(leaf,plugin){
    super(leaf);
    this.plugin=plugin;
    this.nodes=[];this.edges=[];this.collapsed=new Set();
    this.pan={x:0,y:0};this.scale=1;
    this._pan=false;this._panStart=null;this._drag=null;
    this._manualPos={};this._positions={};
    this._searchQ='';this._menu=null;this._panelOpen=false;
    this.S={wrapText:false,palette:PRESETS[0].colors.map(c=>({...c}))};
  }

  getViewType(){return VIEW_TYPE;}
  getDisplayText(){return 'Topic Map';}
  getIcon(){return 'git-fork';}
  get nodeH(){return this.S.wrapText?NHW:NH;}

  async onOpen(){
    const d=await this.plugin.loadData()||{};
    this.nodes=d.nodes||[];this.edges=d.edges||[];
    this.pan=d.pan||{x:0,y:0};this.scale=d.scale||1;
    this._manualPos=d.manualPos||{};this.collapsed=new Set(d.collapsed||[]);
    if(d.settings)Object.assign(this.S,d.settings);
    if(!this.S.palette)this.S.palette=PRESETS[0].colors.map(c=>({...c}));
    this.buildUI();this.draw();
    setTimeout(()=>this.fitView(),160);
  }

  async save(){
    await this.plugin.saveData({nodes:this.nodes,edges:this.edges,pan:this.pan,scale:this.scale,manualPos:this._manualPos,collapsed:[...this.collapsed],settings:this.S});
  }

  // ── Build UI ───────────────────────────────────────────────────────────
  buildUI(){
    const root=this.containerEl.children[1];
    root.empty();
    root.style.cssText='display:flex;flex-direction:column;height:100%;overflow:hidden;background:var(--background-primary);';

    // toolbar
    const bar=root.createDiv();
    bar.style.cssText='display:flex;align-items:center;gap:6px;padding:8px 12px;border-bottom:1px solid var(--background-modifier-border);flex-shrink:0;background:var(--background-secondary);flex-wrap:wrap;';

    const mkBtn=(label,title,accent=false)=>{
      const b=bar.createEl('button',{text:label});b.title=title;
      b.style.cssText=`padding:4px 11px;border-radius:6px;cursor:pointer;border:none;font-size:11px;font-weight:600;white-space:nowrap;transition:opacity .12s;${accent?'background:var(--interactive-accent);color:var(--text-on-accent);':'background:var(--background-modifier-border);color:var(--text-normal);'}`;
      b.addEventListener('mouseenter',()=>b.style.opacity='.78');
      b.addEventListener('mouseleave',()=>b.style.opacity='1');
      return b;
    };

    mkBtn('＋ Add Root','Add root topic',true).addEventListener('click',()=>this.addNode(null));
    mkBtn('⊡ Fit','Fit all nodes').addEventListener('click',()=>this.fitView());
    mkBtn('⟳ Reset','Reset positions').addEventListener('click',()=>{this._manualPos={};this.save();this.draw();setTimeout(()=>this.fitView(),80);});

    // wrap toggle
    this._wBtn=mkBtn('','Toggle text wrap');
    const syncW=()=>{
      const on=this.S.wrapText;
      this._wBtn.textContent=on?'↩ Wrap ON':'↩ Wrap OFF';
      this._wBtn.style.background=on?'var(--interactive-accent)':'var(--background-modifier-border)';
      this._wBtn.style.color=on?'var(--text-on-accent)':'var(--text-normal)';
    };
    syncW();
    this._wBtn.addEventListener('click',()=>{this.S.wrapText=!this.S.wrapText;syncW();this.save();this.draw();});

    mkBtn('🎨 Colors','Colour settings').addEventListener('click',()=>this.togglePanel());
    mkBtn('↑ Export','Export as Markdown').addEventListener('click',()=>this.exportOutline());

    // search
    const srch=bar.createEl('input');srch.type='text';srch.placeholder='🔍  Search…';
    srch.style.cssText='padding:4px 10px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);font-size:11px;margin-left:auto;width:140px;';
    srch.addEventListener('input',()=>{this._searchQ=srch.value.toLowerCase();this.draw();});

    const hint=bar.createEl('span',{text:'Hover node edge → + to add  •  Drag to move  •  Double-click to open'});
    hint.style.cssText='font-size:9.5px;color:var(--text-faint);white-space:nowrap;';

    // body
    const body=root.createDiv();
    body.style.cssText='flex:1;display:flex;min-height:0;overflow:hidden;';

    const svgWrap=body.createDiv();
    svgWrap.style.cssText='flex:1;overflow:hidden;position:relative;';

    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.style.cssText='width:100%;height:100%;cursor:grab;display:block;';
    svgWrap.appendChild(svg);this.svg=svg;

    const defs=document.createElementNS('http://www.w3.org/2000/svg','defs');
    defs.innerHTML=`
      <filter id="tmS" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#000" flood-opacity=".13"/>
      </filter>
      <filter id="tmSH" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity=".2"/>
      </filter>
      <marker id="tmArrow" markerWidth="6" markerHeight="6" refX="5" refY="2.2" orient="auto">
        <path d="M0,0 L0,4.5 L6,2.2 z" fill="var(--text-faint)" opacity=".7"/>
      </marker>`;
    svg.appendChild(defs);

    const g=document.createElementNS('http://www.w3.org/2000/svg','g');
    svg.appendChild(g);this.g=g;

    this._panelEl=this.buildSettingsPanel(body);

    // events
    svg.addEventListener('mousedown',e=>{
      if(e.button!==0||e.target.closest('.tm-node'))return;
      this._pan=true;this._panStart={mx:e.clientX,my:e.clientY,px:this.pan.x,py:this.pan.y};
      svg.style.cursor='grabbing';
    });
    this._mm=e=>{
      if(this._pan){this.pan.x=this._panStart.px+e.clientX-this._panStart.mx;this.pan.y=this._panStart.py+e.clientY-this._panStart.my;this.applyT();return;}
      if(this._drag){const dx=(e.clientX-this._drag.mx)/this.scale,dy=(e.clientY-this._drag.my)/this.scale;this._manualPos[this._drag.id]={x:this._drag.ox+dx,y:this._drag.oy+dy};this.draw();}
    };
    this._mu=()=>{
      if(this._pan){this._pan=false;svg.style.cursor='grab';this.save();}
      if(this._drag){this._drag=null;this.save();}
    };
    window.addEventListener('mousemove',this._mm);
    window.addEventListener('mouseup',this._mu);
    svg.addEventListener('wheel',e=>{
      e.preventDefault();
      const r=svg.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
      const ns=Math.min(3,Math.max(0.1,this.scale*(e.deltaY<0?1.1:0.91)));
      this.pan.x=mx-(mx-this.pan.x)*ns/this.scale;this.pan.y=my-(my-this.pan.y)*ns/this.scale;this.scale=ns;this.applyT();
    },{passive:false});
    document.addEventListener('click',()=>this.closeMenu());
    this.applyT();
  }

  onClose(){window.removeEventListener('mousemove',this._mm);window.removeEventListener('mouseup',this._mu);}
  applyT(){this.g?.setAttribute('transform',`translate(${this.pan.x},${this.pan.y}) scale(${this.scale})`);}

  fitView(){
    const pos=this._positions;
    if(!this.nodes.length||!Object.keys(pos).length)return;
    const xs=Object.values(pos).map(p=>p.x),ys=Object.values(pos).map(p=>p.y);
    const pad=70,NH=this.nodeH;
    const minX=Math.min(...xs)-NW/2-pad,maxX=Math.max(...xs)+NW/2+pad;
    const minY=Math.min(...ys)-NH/2-pad,maxY=Math.max(...ys)+NH/2+pad+24;
    const W=this.svg.clientWidth||900,H=this.svg.clientHeight||600;
    this.scale=Math.min(W/(maxX-minX),H/(maxY-minY),1.6);
    this.pan.x=(W-(maxX+minX)*this.scale)/2;this.pan.y=(H-(maxY+minY)*this.scale)/2;
    this.applyT();this.save();
  }

  // ── Settings panel ─────────────────────────────────────────────────────
  buildSettingsPanel(parent){
    const panel=parent.createDiv();
    panel.style.cssText='width:292px;flex-shrink:0;display:none;flex-direction:column;border-left:1px solid var(--background-modifier-border);background:var(--background-secondary);overflow-y:auto;';

    const hdr=panel.createDiv();
    hdr.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--background-modifier-border);position:sticky;top:0;background:var(--background-secondary);z-index:2;';
    hdr.createEl('span',{text:'🎨  Colour Settings'}).style.cssText='font-weight:700;font-size:12.5px;color:var(--text-normal);';
    const x=hdr.createEl('button',{text:'✕'});
    x.style.cssText='background:none;border:none;cursor:pointer;font-size:12px;color:var(--text-muted);padding:2px 7px;border-radius:4px;';
    x.addEventListener('click',()=>this.togglePanel());

    const body=panel.createDiv();
    body.style.cssText='padding:13px;display:flex;flex-direction:column;gap:18px;';

    const ps=body.createDiv();
    ps.createEl('p',{text:'PRESET PALETTES'}).style.cssText='margin:0 0 8px;font-size:9.5px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;';
    const grid=ps.createDiv();grid.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:6px;';
    for(const preset of PRESETS){
      const card=grid.createDiv();
      card.style.cssText='border:1.5px solid var(--background-modifier-border);border-radius:8px;padding:7px 7px 5px;cursor:pointer;transition:border-color .15s,box-shadow .12s,transform .1s;';
      card.addEventListener('mouseenter',()=>{card.style.borderColor='var(--interactive-accent)';card.style.boxShadow='0 2px 10px rgba(0,0,0,.13)';card.style.transform='translateY(-1px)';});
      card.addEventListener('mouseleave',()=>{card.style.borderColor='var(--background-modifier-border)';card.style.boxShadow='none';card.style.transform='none';});
      const dots=card.createDiv();dots.style.cssText='display:flex;gap:2px;margin-bottom:5px;';
      preset.colors.forEach(c=>{const d=dots.createDiv();d.style.cssText=`width:13px;height:13px;border-radius:3px;background:${c.bg};`;});
      card.createEl('span',{text:preset.name}).style.cssText='font-size:10px;color:var(--text-normal);font-weight:600;';
      card.addEventListener('click',()=>{this.S.palette=preset.colors.map(c=>({bg:c.bg,text:c.text||autoText(c.bg)}));this.refreshPickers();this.save();this.draw();});
    }

    const cs=body.createDiv();
    cs.createEl('p',{text:'CUSTOM PER LEVEL'}).style.cssText='margin:0 0 8px;font-size:9.5px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;';
    this._pickerRows=[];
    for(let i=0;i<6;i++){
      const c=this.S.palette[i]||{bg:'#888',text:'#fff'};
      const row=cs.createDiv();row.style.cssText='display:flex;align-items:center;gap:7px;margin-bottom:7px;';
      const lbl=row.createEl('span',{text:LEVEL_LABELS[i]});
      lbl.style.cssText=`font-size:9.5px;font-weight:700;width:32px;padding:2px 0;border-radius:3px;text-align:center;background:${c.bg};color:${c.text};flex-shrink:0;`;
      const pick=row.createEl('input');pick.type='color';pick.value=c.bg;
      pick.style.cssText='width:32px;height:24px;border:none;background:none;cursor:pointer;border-radius:4px;padding:0;flex-shrink:0;';
      const prev=row.createDiv();
      prev.style.cssText=`flex:1;height:24px;border-radius:6px;background:${c.bg};color:${c.text};border:1.5px solid ${darken(c.bg,18)};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;`;
      prev.textContent=LEVEL_LABELS[i]+' node';
      pick.addEventListener('input',()=>{
        const bg=pick.value,text=autoText(bg);
        this.S.palette[i]={bg,text};
        lbl.style.background=bg;lbl.style.color=text;
        prev.style.background=bg;prev.style.color=text;prev.style.border=`1.5px solid ${darken(bg,18)}`;
        this.save();this.draw();
      });
      this._pickerRows.push({lbl,pick,prev,i});
    }

    const note=body.createDiv();
    note.style.cssText='font-size:10px;color:var(--text-muted);line-height:1.6;background:var(--background-primary);border-radius:7px;padding:9px 11px;';
    note.innerHTML='<strong>💡 Tips</strong><br>• <em>Colorblind-safe</em> uses the Okabe-Ito palette.<br>• <em>Calm</em> is optimised for long sessions.<br>• Text contrast is auto-computed.';
    return panel;
  }

  refreshPickers(){
    for(const{lbl,pick,prev,i}of(this._pickerRows||[])){
      const c=this.S.palette[i]||{bg:'#888',text:'#fff'};
      pick.value=c.bg;lbl.style.background=c.bg;lbl.style.color=c.text;
      prev.style.background=c.bg;prev.style.color=c.text;prev.style.border=`1.5px solid ${darken(c.bg,18)}`;
    }
  }
  togglePanel(){
    this._panelOpen=!this._panelOpen;
    this._panelEl.style.display=this._panelOpen?'flex':'none';
    if(this._panelOpen)this._panelEl.style.flexDirection='column';
  }

  // ── Draw ───────────────────────────────────────────────────────────────
  draw(){
    if(!this.g)return;
    while(this.g.firstChild)this.g.removeChild(this.g.firstChild);
    if(!this.nodes.length){this.drawEmpty();return;}

    const NH=this.nodeH;
    const autoPos=layout(this.nodes,this.edges,this.collapsed);
    const depths=computeDepths(this.nodes,this.edges);
    const pos={};
    this.nodes.forEach(n=>{pos[n.id]=this._manualPos[n.id]?{...this._manualPos[n.id]}:{...autoPos[n.id]};});
    this._positions=pos;

    const vis=new Set(),visEdges=[];
    const addVis=id=>{
      if(vis.has(id))return;vis.add(id);
      if(this.collapsed.has(id))return;
      this.edges.filter(e=>e.from===id).forEach(e=>{addVis(e.to);visEdges.push(e);});
    };
    const ci=new Set(this.edges.map(e=>e.to));
    this.nodes.filter(n=>!ci.has(n.id)).forEach(n=>addVis(n.id));
    this.nodes.forEach(n=>{if(!vis.has(n.id))vis.add(n.id);});

    const sq=this._searchQ;

    // edges
    const eg=document.createElementNS('http://www.w3.org/2000/svg','g');
    for(const e of visEdges){
      const fp=pos[e.from],tp=pos[e.to];if(!fp||!tp)continue;
      const x1=fp.x,y1=fp.y+NH/2+1,x2=tp.x,y2=tp.y-NH/2-1;
      const cy1=y1+(y2-y1)*.38,cy2=y2-(y2-y1)*.38;
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d',`M${x1},${y1} C${x1},${cy1} ${x2},${cy2} ${x2},${y2}`);
      path.setAttribute('fill','none');path.setAttribute('stroke','var(--text-faint)');
      path.setAttribute('stroke-width','1.2');path.setAttribute('opacity','0.65');
      path.setAttribute('marker-end','url(#tmArrow)');
      eg.appendChild(path);
    }
    this.g.appendChild(eg);

    // nodes
    const ng=document.createElementNS('http://www.w3.org/2000/svg','g');

    for(const node of this.nodes){
      if(!vis.has(node.id))continue;

      const p=pos[node.id];
      const dep=depths[node.id]||0;
      const col=this.S.palette[Math.min(dep,this.S.palette.length-1)];
      const bg=col.bg,tc=col.text||autoText(bg),bd=darken(bg,18);
      const hasKids=this.edges.some(e=>e.from===node.id);
      const isCol=this.collapsed.has(node.id);
      const descN=isCol?countDesc(node.id,this.edges):0;
      const matched=sq&&node.name.toLowerCase().includes(sq);
      const dimmed=sq&&!matched;

      // ── foreignObject spans the full node including space for collapse toggle ──
      // We do NOT add padding for buttons — they live ON the border edge
      const TOGH=hasKids?18:0;
      const foW=NW;
      const foH=NH+TOGH+4;

      const fo=document.createElementNS('http://www.w3.org/2000/svg','foreignObject');
      fo.setAttribute('x',p.x-NW/2);
      fo.setAttribute('y',p.y-NH/2);
      fo.setAttribute('width',foW);
      fo.setAttribute('height',foH);
      fo.setAttribute('class','tm-node');
      fo.setAttribute('data-id',node.id);
      fo.style.overflow='visible';   // allows buttons to render outside bounds

      const outer=document.createElement('div');
      outer.style.cssText='position:relative;display:flex;flex-direction:column;align-items:center;';

      // ── + buttons — positioned exactly on the midpoint of each border edge ──
      // No background, no border — just the + glyph. A thin circle outline appears on hover.
      // Because they're centered ON the border, the cursor passes over them
      // without ever leaving the outer div's hover zone.

      const mkAddBtn=(title,posCSS,onClick)=>{
        const b=document.createElement('button');
        b.title=title;
        b.style.cssText=`
          position:absolute;${posCSS}
          width:${BSIZE}px;height:${BSIZE}px;
          border-radius:50%;
          background:transparent;
          border:1.5px solid transparent;
          color:var(--text-muted);
          font-size:14px;font-weight:700;line-height:1;
          cursor:pointer;
          display:none;
          align-items:center;justify-content:center;
          padding:0;
          transition:border-color .12s,color .12s,background .12s;
          z-index:20;
          box-sizing:border-box;
        `;
        b.textContent='+';
        b.addEventListener('mouseenter',()=>{
          b.style.borderColor='var(--interactive-accent)';
          b.style.color='var(--interactive-accent)';
          b.style.background='var(--background-primary)';
        });
        b.addEventListener('mouseleave',()=>{
          b.style.borderColor='transparent';
          b.style.color='var(--text-muted)';
          b.style.background='transparent';
        });
        b.addEventListener('click',e=>{e.stopPropagation();onClick();});
        return b;
      };

      // Positions: buttons sit centred on each border midpoint.
      // top edge centre:   translateY(-50%) so half is above, half below the top border
      // bottom edge centre: translateY(+50%) relative to bottom of pill
      // right edge centre:  translateX(+50%) relative to right of pill
      const half=BSIZE/2;

      const btnTop=mkAddBtn('Add Parent Node',
        `top:${-half}px;left:${NW/2-half}px;`,
        ()=>this.addParentNode(node));

      const btnBot=mkAddBtn('Add Child Node',
        `top:${NH-half}px;left:${NW/2-half}px;`,
        ()=>this.addChildNode(node));

      const btnRight=mkAddBtn('Add Sibling (right)',
        `top:${NH/2-half}px;left:${NW-half}px;`,
        ()=>this.addSiblingNode(node));

      const btnLeft=mkAddBtn('Add Sibling (left)',
        `top:${NH/2-half}px;left:${-half}px;`,
        ()=>this.addSiblingNode(node));

      const allBtns=[btnTop,btnBot,btnRight,btnLeft];

      // Show on outer hover, hide when leaving outer
      // No delay — buttons sit on the border so cursor naturally
      // passes from pill onto button without leaving the outer div
      outer.addEventListener('mouseenter',()=>{
        if(!dimmed) allBtns.forEach(b=>b.style.display='flex');
      });
      outer.addEventListener('mouseleave',()=>{
        allBtns.forEach(b=>b.style.display='none');
      });

      // ── pill ──
      const wrapCSS=this.S.wrapText
        ?'white-space:normal;word-break:break-word;line-height:1.3;text-align:center;'
        :'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;';

      const pill=document.createElement('div');
      pill.style.cssText=`
        width:${NW}px;min-height:${NH}px;box-sizing:border-box;
        display:flex;align-items:center;gap:5px;
        padding:0 9px;border-radius:8px;
        background:${bg};border:1.5px solid ${bd};color:${tc};
        font-size:11px;font-weight:600;
        cursor:grab;user-select:none;
        filter:url(#tmS);
        transition:opacity .15s,filter .12s;
        opacity:${dimmed?.14:1};
        ${matched?`outline:2px solid #FCD34D;outline-offset:2px;`:''}
      `;
      pill.title=`${node.name}\n\nDouble-click → open  •  Drag → move  •  Right-click → options`;

      const bar2=document.createElement('div');
      bar2.style.cssText=`width:2px;min-height:${NH-10}px;border-radius:2px;flex-shrink:0;background:${rgba('#fff',dep===0?.5:.22)};`;

      const lbl2=document.createElement('div');
      lbl2.style.cssText=`flex:1;min-width:0;${wrapCSS}`;
      lbl2.textContent=node.name;

      pill.append(bar2,lbl2);
      pill.addEventListener('mouseenter',()=>{if(!dimmed)pill.style.filter='url(#tmSH)';});
      pill.addEventListener('mouseleave',()=>{pill.style.filter='url(#tmS)';});
      pill.addEventListener('dblclick',e=>{e.stopPropagation();this.openFile(node);});
      pill.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();this.showMenu(e,node);});
      pill.addEventListener('mousedown',e=>{
        if(e.button!==0)return;e.stopPropagation();
        const cur=this._manualPos[node.id]||autoPos[node.id]||{x:0,y:0};
        this._drag={id:node.id,mx:e.clientX,my:e.clientY,ox:cur.x,oy:cur.y};
        pill.style.cursor='grabbing';
      });

      outer.append(btnTop,btnBot,btnRight,btnLeft,pill);

      // collapse toggle
      if(hasKids){
        const tog=document.createElement('div');
        tog.style.cssText=`
          display:inline-flex;align-items:center;gap:3px;margin-top:3px;
          padding:1px 7px;height:15px;border-radius:4px;
          background:${rgba(bg,.15)};border:1px solid ${rgba(bd,.28)};
          color:var(--text-muted);font-size:8px;font-weight:700;
          cursor:pointer;user-select:none;opacity:${dimmed?.1:.75};
          transition:background .15s;
        `;
        tog.title=isCol?'Expand':'Collapse';
        const arr=document.createElement('span');arr.textContent=isCol?'▶':'▼';tog.appendChild(arr);
        if(isCol&&descN>0){
          const badge=document.createElement('span');
          badge.textContent=`+${descN}`;
          badge.style.cssText=`background:${bg};color:${tc};border-radius:2px;padding:1px 3px;font-size:7.5px;font-weight:700;`;
          tog.appendChild(badge);
        }
        tog.addEventListener('mouseenter',()=>tog.style.background=rgba(bg,.26));
        tog.addEventListener('mouseleave',()=>tog.style.background=rgba(bg,.15));
        tog.addEventListener('click',e=>{e.stopPropagation();this.toggleCollapse(node.id);});
        outer.appendChild(tog);
      }

      fo.appendChild(outer);
      ng.appendChild(fo);
    }
    this.g.appendChild(ng);
  }

  drawEmpty(){
    const cx=(this.svg.clientWidth||800)/2/this.scale,cy=(this.svg.clientHeight||600)/2/this.scale;
    const fo=document.createElementNS('http://www.w3.org/2000/svg','foreignObject');
    fo.setAttribute('x',cx-180);fo.setAttribute('y',cy-48);fo.setAttribute('width',360);fo.setAttribute('height',96);
    const card=document.createElement('div');
    card.style.cssText='width:360px;height:96px;border-radius:12px;background:var(--background-secondary);border:1.5px dashed var(--background-modifier-border);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;';
    card.innerHTML=`<span style="font-size:20px">🗺️</span><span style="font-size:12px;font-weight:600;color:var(--text-muted);">Click <strong style="color:var(--interactive-accent)">＋ Add Root</strong> to start mapping</span>`;
    fo.appendChild(card);this.g.appendChild(fo);
  }

  toggleCollapse(id){this.collapsed.has(id)?this.collapsed.delete(id):this.collapsed.add(id);this.save();this.draw();}

  // ── Context menu ────────────────────────────────────────────────────────
  showMenu(e,node){
    this.closeMenu();
    const hasKids=this.edges.some(ed=>ed.from===node.id),isCol=this.collapsed.has(node.id);
    const menu=document.createElement('div');
    menu.style.cssText=`position:fixed;left:${e.clientX+4}px;top:${e.clientY}px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:10px;padding:4px;z-index:9999;box-shadow:0 10px 32px rgba(0,0,0,.24);min-width:200px;`;

    const sec=label=>{
      if(label){const s=document.createElement('div');s.style.cssText='padding:5px 12px 2px;font-size:9px;font-weight:700;color:var(--text-faint);letter-spacing:.08em;';s.textContent=label.toUpperCase();menu.appendChild(s);}
      else{const hr=document.createElement('hr');hr.style.cssText='border:none;border-top:1px solid var(--background-modifier-border);margin:3px 0;';menu.appendChild(hr);}
    };
    const item=(icon,label,fn,danger=false)=>{
      const row=document.createElement('div');
      row.style.cssText=`padding:6px 12px;cursor:pointer;border-radius:5px;font-size:11.5px;display:flex;align-items:center;gap:8px;color:${danger?'var(--text-error)':'var(--text-normal)'};transition:background .1s;`;
      row.innerHTML=`<span style="width:16px;text-align:center;font-size:11.5px;">${icon}</span><span>${label}</span>`;
      row.addEventListener('mouseenter',()=>row.style.background='var(--background-modifier-hover)');
      row.addEventListener('mouseleave',()=>row.style.background='');
      row.addEventListener('click',ev=>{ev.stopPropagation();this.closeMenu();fn();});
      menu.appendChild(row);
    };

    sec('Add');
    item('➕','Add Child Node',()=>this.addChildNode(node));
    item('⬆️','Add Parent Node',()=>this.addParentNode(node));
    item('↔️','Add Sibling Node',()=>this.addSiblingNode(node));
    sec(null);
    if(hasKids)item(isCol?'🔓':'🔒',isCol?'Expand Children':'Collapse Children',()=>this.toggleCollapse(node.id));
    sec('Note');
    item('📄','Open Note',()=>this.openFile(node));
    sec('Edit');
    item('✏️','Rename',()=>this.renameNode(node));
    item('📍','Reset Position',()=>{delete this._manualPos[node.id];this.save();this.draw();});
    sec(null);
    item('🗑️','Delete Node',()=>this.deleteNode(node),true);
    item('🌳','Delete Node + Subtree',()=>this.deleteSubtree(node),true);

    document.body.appendChild(menu);this._menu=menu;
    const mr=menu.getBoundingClientRect();
    if(mr.right>window.innerWidth)menu.style.left=(e.clientX-mr.width-4)+'px';
    if(mr.bottom>window.innerHeight)menu.style.top=(e.clientY-mr.height)+'px';
  }
  closeMenu(){this._menu?.remove();this._menu=null;}

  // ── Prompt — with optional uniqueness check ────────────────────────────
  async prompt(msg, def='', excludeId=null){
    return new Promise(resolve=>{
      const ov=document.createElement('div');
      ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.52);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(4px);';
      const box=document.createElement('div');
      box.style.cssText='background:var(--background-primary);border-radius:14px;padding:26px 22px;min-width:350px;display:flex;flex-direction:column;gap:14px;box-shadow:0 20px 60px rgba(0,0,0,.38);border:1px solid var(--background-modifier-border);';
      const lbl=document.createElement('p');lbl.textContent=msg;lbl.style.cssText='margin:0;font-size:13.5px;font-weight:700;color:var(--text-normal);';
      const inp=document.createElement('input');inp.type='text';inp.value=def;
      inp.style.cssText='padding:9px 11px;border-radius:7px;border:1.5px solid var(--background-modifier-border);background:var(--background-secondary);color:var(--text-normal);font-size:13px;outline:none;width:100%;box-sizing:border-box;transition:border-color .15s;';
      inp.addEventListener('focus',()=>inp.style.borderColor='var(--interactive-accent)');
      inp.addEventListener('blur',()=>inp.style.borderColor='var(--background-modifier-border)');

      // inline error message
      const err=document.createElement('p');
      err.style.cssText='margin:0;font-size:11.5px;color:var(--text-error);display:none;';

      const row=document.createElement('div');row.style.cssText='display:flex;gap:7px;justify-content:flex-end;';
      const ok=document.createElement('button');ok.textContent='Create';
      ok.style.cssText='padding:7px 17px;border-radius:7px;background:var(--interactive-accent);color:var(--text-on-accent);border:none;cursor:pointer;font-size:12.5px;font-weight:700;';
      const cn=document.createElement('button');cn.textContent='Cancel';
      cn.style.cssText='padding:7px 12px;border-radius:7px;background:var(--background-modifier-border);color:var(--text-normal);border:none;cursor:pointer;font-size:12.5px;';

      const done=v=>{ov.remove();resolve(v);};

      const trySubmit=()=>{
        const v=inp.value.trim();
        if(!v.length) return;
        // uniqueness check — case-insensitive, skip the node being renamed (excludeId)
        const clash=this.nodes.find(n=>n.name.toLowerCase()===v.toLowerCase()&&n.id!==excludeId);
        if(clash){
          err.textContent=`"${v}" already exists. Please choose a different name.`;
          err.style.display='block';
          inp.style.borderColor='var(--text-error)';
          inp.focus(); inp.select();
          return;
        }
        done(v);
      };

      ok.addEventListener('click', trySubmit);
      cn.addEventListener('click', ()=>done(null));
      inp.addEventListener('keydown',e=>{
        if(e.key==='Enter'){e.preventDefault();trySubmit();}
        if(e.key==='Escape')done(null);
      });
      inp.addEventListener('input',()=>{
        err.style.display='none';
        inp.style.borderColor='var(--interactive-accent)';
      });

      row.append(cn,ok);[lbl,inp,err,row].forEach(el=>box.appendChild(el));
      ov.appendChild(box);document.body.appendChild(ov);
      setTimeout(()=>{inp.focus();inp.select();},50);
    });
  }

  // ── Vault ──────────────────────────────────────────────────────────────
  async createMd(name){
    const safe=name.replace(/[\\/:*?"<>|]/g,'-'),path=`${safe}.md`;
    if(!this.app.vault.getAbstractFileByPath(path))await this.app.vault.create(path,`# ${name}\n\n`);
    return path;
  }

  // ── Node operations ────────────────────────────────────────────────────
  async addNode(parent){
    const name=await this.prompt('Enter topic name:');if(!name)return;
    const file=await this.createMd(name);const id=`n${Date.now()}`;
    this.nodes.push({id,name,file});if(parent)this.edges.push({from:parent.id,to:id});
    await this.save();this.draw();setTimeout(()=>this.fitView(),80);
  }
  async addChildNode(node){await this.addNode(node);}
  async addParentNode(child){
    const name=await this.prompt('Enter parent topic name:');if(!name)return;
    const file=await this.createMd(name);const id=`n${Date.now()}`;
    this.nodes.push({id,name,file});this.edges.push({from:id,to:child.id});
    await this.save();this.draw();setTimeout(()=>this.fitView(),80);
  }
  async addSiblingNode(node){
    const pe=this.edges.find(e=>e.to===node.id),pn=pe?this.nodes.find(n=>n.id===pe.from):null;
    const name=await this.prompt('Enter sibling topic name:');if(!name)return;
    const file=await this.createMd(name);const id=`n${Date.now()}`;
    this.nodes.push({id,name,file});if(pn)this.edges.push({from:pn.id,to:id});
    await this.save();this.draw();
  }
  async renameNode(node){
    const name=await this.prompt(`Rename "${node.name}":`,node.name,node.id);
    if(!name||name===node.name)return;node.name=name;await this.save();this.draw();
  }
  async deleteNode(node){
    this.nodes=this.nodes.filter(n=>n.id!==node.id);
    this.edges=this.edges.filter(e=>e.from!==node.id&&e.to!==node.id);
    delete this._manualPos[node.id];await this.save();this.draw();
  }
  async deleteSubtree(node){
    const del=new Set();
    const collect=id=>{del.add(id);this.edges.filter(e=>e.from===id).forEach(e=>collect(e.to));};
    collect(node.id);
    this.nodes=this.nodes.filter(n=>!del.has(n.id));
    this.edges=this.edges.filter(e=>!del.has(e.from)&&!del.has(e.to));
    del.forEach(id=>delete this._manualPos[id]);await this.save();this.draw();
  }
  async openFile(node){
    const file=this.app.vault.getAbstractFileByPath(node.file);
    if(file instanceof TFile){const leaf=this.app.workspace.getLeaf('tab');await leaf.openFile(file);}
    else new Notice(`Note not found: ${node.file}`);
  }
  async exportOutline(){
    const ci=new Set(this.edges.map(e=>e.to)),roots=this.nodes.filter(n=>!ci.has(n.id));
    const lines=['# Topic Map Export',''];
    const write=(node,d)=>{lines.push('  '.repeat(d)+`- [[${node.name}]]`);this.edges.filter(e=>e.from===node.id).forEach(e=>{const ch=this.nodes.find(n=>n.id===e.to);if(ch)write(ch,d+1);});};
    roots.forEach(r=>write(r,0));
    const path='Topic Map Export.md',content=lines.join('\n');
    const ex=this.app.vault.getAbstractFileByPath(path);
    if(ex instanceof TFile)await this.app.vault.modify(ex,content);else await this.app.vault.create(path,content);
    new Notice('✅ Exported to "Topic Map Export.md"');
    const leaf=this.app.workspace.getLeaf('tab');
    const f=this.app.vault.getAbstractFileByPath(path);
    if(f instanceof TFile)await leaf.openFile(f);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Plugin
// ══════════════════════════════════════════════════════════════════════════════
class TopicMapPlugin extends Plugin {
  async onload(){
    this.registerView(VIEW_TYPE,leaf=>new TopicMapView(leaf,this));
    this.addRibbonIcon('git-fork','Open Topic Map',()=>this.activateView());
    this.addCommand({id:'open-topic-map',name:'Open Topic Map',callback:()=>this.activateView()});
  }
  async activateView(){
    const ex=this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if(ex.length){this.app.workspace.revealLeaf(ex[0]);return;}
    const leaf=this.app.workspace.getLeaf('tab');
    await leaf.setViewState({type:VIEW_TYPE,active:true});
    leaf.setPinned(true);
    this.app.workspace.revealLeaf(leaf);
  }
  onunload(){}
}

module.exports=TopicMapPlugin;
