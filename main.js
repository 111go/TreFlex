'use strict';

const { Plugin, ItemView, TFile, Notice, PluginSettingTab, Setting, setIcon } = require('obsidian');

const VIEW_TYPE = 'treflex-view';
const NH     = 30;
const LGAP   = 108;
const SGAP   = 52;
const NW_MIN = 80;
const NW_MAX = 210;
const BSIZE  = 14;

// ── Toolbar buttons ────────────────────────────────────────────────────────
const TOOLBAR_BTNS = [
  { id:'add-root',    icon:'plus-circle', label:'Add Root',    accent:true  },
  { id:'fit',         icon:'scan',        label:'Zoom to Fit'               },
  { id:'reset',       icon:'refresh-cw',  label:'Reset Layout'              },
  { id:'vault-sync',  icon:'link',        label:'Vault Sync'                },
  { id:'edge-labels', icon:'tag',         label:'Edge Labels', toggle:true  },
  { id:'export',      icon:'upload',      label:'Export'                    },
];

// ── Text measurement ───────────────────────────────────────────────────────
let _ctx = null;
function nodeWidth(name) {
  if (!_ctx) _ctx = document.createElement('canvas').getContext('2d');
  _ctx.font = '600 11px system-ui,sans-serif';
  return Math.min(NW_MAX, Math.max(NW_MIN, Math.ceil(_ctx.measureText(name||'x').width) + 34));
}

// ── Presets ────────────────────────────────────────────────────────────────
const PRESETS = [
  { name:'🎨 Default', colors:[
    {bg:'#5B21B6',text:'#fff'},{bg:'#1D4ED8',text:'#fff'},{bg:'#0E7490',text:'#fff'},
    {bg:'#047857',text:'#fff'},{bg:'#B45309',text:'#fff'},{bg:'#B91C1C',text:'#fff'}]},
  { name:'🌊 Calm', colors:[
    {bg:'#1E3A5F',text:'#E8F4FD'},{bg:'#2E6DA4',text:'#fff'},{bg:'#3A9ABF',text:'#fff'},
    {bg:'#4AACAA',text:'#fff'},{bg:'#5FB88A',text:'#fff'},{bg:'#7ECBA1',text:'#1E3A5F'}]},
  { name:'🌿 Sage', colors:[
    {bg:'#2D4739',text:'#E8F5EC'},{bg:'#3D6B52',text:'#fff'},{bg:'#5A8C6E',text:'#fff'},
    {bg:'#7DAF90',text:'#fff'},{bg:'#A3C8B2',text:'#2D4739'},{bg:'#C9E4D4',text:'#2D4739'}]},
  { name:'👁 Colorblind-safe', colors:[
    {bg:'#0072B2',text:'#fff'},{bg:'#E69F00',text:'#1a1a1a'},{bg:'#009E73',text:'#fff'},
    {bg:'#CC79A7',text:'#fff'},{bg:'#56B4E9',text:'#1a1a1a'},{bg:'#D55E00',text:'#fff'}]},
  { name:'🌅 Sunset', colors:[
    {bg:'#6B1E4A',text:'#FCE7F3'},{bg:'#A8314A',text:'#fff'},{bg:'#D4524A',text:'#fff'},
    {bg:'#E07E4B',text:'#fff'},{bg:'#E8A84B',text:'#1a1a1a'},{bg:'#EDD17A',text:'#1a1a1a'}]},
  { name:'🩶 Slate', colors:[
    {bg:'#0F172A',text:'#F1F5F9'},{bg:'#1E293B',text:'#F1F5F9'},{bg:'#334155',text:'#fff'},
    {bg:'#475569',text:'#fff'},{bg:'#64748B',text:'#fff'},{bg:'#94A3B8',text:'#0F172A'}]},
  { name:'🍬 Pastel', colors:[
    {bg:'#A78BFA',text:'#2E1065'},{bg:'#60A5FA',text:'#1E3A8A'},{bg:'#34D399',text:'#064E3B'},
    {bg:'#FCD34D',text:'#451A03'},{bg:'#F9A8D4',text:'#500724'},{bg:'#6EE7B7',text:'#064E3B'}]},
];

// ── Colour helpers ─────────────────────────────────────────────────────────
function hexRgb(h){return{r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)};}
function darken(h,a=22){const{r,g,b}=hexRgb(h);const d=v=>Math.max(0,v-a).toString(16).padStart(2,'0');return'#'+d(r)+d(g)+d(b);}
function autoText(h){const{r,g,b}=hexRgb(h);return(0.299*r+0.587*g+0.114*b)/255>0.58?'#111827':'#ffffff';}
function rgba(h,a){const{r,g,b}=hexRgb(h);return`rgba(${r},${g},${b},${a})`;}

// ── Validation ─────────────────────────────────────────────────────────────
const INVALID_CHARS=/[\\/:*?"<>|#\^[\]]/;
function validateName(name,nodes,excludeId=null){
  if(!name.trim())return'Name cannot be empty.';
  if(INVALID_CHARS.test(name))return'Invalid character ( \\ / : * ? " < > | # ^ [ ] ).';
  const clash=nodes.find(n=>n.name.toLowerCase()===name.trim().toLowerCase()&&n.id!==excludeId);
  if(clash)return`"${name.trim()}" already exists.`;
  return null;
}

// ── Layout ─────────────────────────────────────────────────────────────────
function computeDepths(nodes,edges){
  const ci=new Set(edges.map(e=>e.to)),depth={};
  const q=nodes.filter(n=>!ci.has(n.id)).map(n=>({id:n.id,d:0}));
  while(q.length){const{id,d}=q.shift();if(depth[id]!==undefined)continue;depth[id]=d;edges.filter(e=>e.from===id).forEach(e=>q.push({id:e.to,d:d+1}));}
  nodes.forEach(n=>{if(depth[n.id]===undefined)depth[n.id]=0;});
  return depth;
}
function countDesc(id,edges){let c=0;const v=nid=>edges.filter(e=>e.from===nid).forEach(e=>{c++;v(e.to);});v(id);return c;}
function subW(id,edges,col,nwMap,memo={}){
  if(memo[id]!==undefined)return memo[id];
  const nw=nwMap[id]||NW_MIN;
  if(col.has(id)){memo[id]=nw;return nw;}
  const ch=edges.filter(e=>e.from===id).map(e=>e.to);
  if(!ch.length){memo[id]=nw;return nw;}
  const t=ch.reduce((s,c)=>s+subW(c,edges,col,nwMap,memo),0)+SGAP*(ch.length-1);
  memo[id]=Math.max(t,nw);return memo[id];
}
function placeNode(id,cx,y,edges,col,pos,nwMap,memo){
  pos[id]={x:cx,y};if(col.has(id))return;
  const ch=edges.filter(e=>e.from===id).map(e=>e.to);if(!ch.length)return;
  const ws=ch.map(c=>subW(c,edges,col,nwMap,memo));
  const tw=ws.reduce((s,w)=>s+w,0)+SGAP*(ch.length-1);
  let rx=cx-tw/2;
  ch.forEach((c,i)=>{placeNode(c,rx+ws[i]/2,y+LGAP,edges,col,pos,nwMap,memo);rx+=ws[i]+SGAP;});
}
function layout(nodes,edges,collapsed){
  const nwMap={};nodes.forEach(n=>{nwMap[n.id]=nodeWidth(n.name);});
  const ci=new Set(edges.map(e=>e.to)),roots=nodes.filter(n=>!ci.has(n.id));
  const pos={},m={},m2={};
  let rx=-(roots.reduce((s,r)=>s+subW(r.id,edges,collapsed,nwMap,m2),0)+SGAP*(roots.length-1))/2;
  for(const r of roots){const w=subW(r.id,edges,collapsed,nwMap,m);placeNode(r.id,rx+w/2,0,edges,collapsed,pos,nwMap,m);rx+=w+SGAP;}
  nodes.forEach(n=>{if(!pos[n.id])pos[n.id]={x:0,y:500};});
  return pos;
}

// ── Bezier midpoint ────────────────────────────────────────────────────────
function bezierMid(x1,y1,cx1,cy1,cx2,cy2,x2,y2){
  return{x:0.125*x1+0.375*cx1+0.375*cx2+0.125*x2,y:0.125*y1+0.375*cy1+0.375*cy2+0.125*y2};
}

// ── Markdown-only wikilink extractor (vault sync safety) ───────────────────
function extractMarkdownLinks(content,vault){
  const raw=[...content.matchAll(/\[\[([^\]|#]+?)(?:\|[^\]]+)?\]\]/g)].map(m=>m[1].trim());
  const mdNames=new Set(vault.getMarkdownFiles().map(f=>f.basename.toLowerCase()));
  return raw.filter(l=>mdNames.has(l.toLowerCase()));
}

// ══════════════════════════════════════════════════════════════════════════════
// View
// ══════════════════════════════════════════════════════════════════════════════
class TreFlexView extends ItemView{
  constructor(leaf,plugin){
    super(leaf);this.plugin=plugin;
    this.nodes=[];this.edges=[];this.collapsed=new Set();
    this.pan={x:0,y:0};this.scale=1;
    this._pan=false;this._panStart=null;this._drag=null;
    this._manualPos={};this._positions={};
    this._searchQ='';this._menu=null;this._panelOpen=false;
    this._mmScale=1;this._mmOX=0;this._mmOY=0;
    this._editingId=null;this._isNewNode=false;
    this._editingEdge=null;
  }
  getViewType(){return VIEW_TYPE;}
  getDisplayText(){return'TreFlex';}
  getIcon(){return'workflow';}
  get PS(){return this.plugin.pluginSettings;}

  // colour lookup with per-level fallback and uniform mode
  getColour(depth){
    if(this.PS.colourMode==='uniform')return this.PS.uniformColour||{bg:'#5B21B6',text:'#fff'};
    const p=this.PS.palette;
    return p[Math.min(depth,p.length-1)];
  }

  async onOpen(){
    const d=await this.plugin.loadData()||{};
    this.nodes=d.nodes||[];this.edges=d.edges||[];
    this.pan=d.pan||{x:0,y:0};this.scale=d.scale||1;
    this._manualPos=d.manualPos||{};this.collapsed=new Set(d.collapsed||[]);
    this.buildUI();this.draw();
    setTimeout(()=>this.fitView(),160);
  }
  async save(){
    await this.plugin.saveData({nodes:this.nodes,edges:this.edges,pan:this.pan,scale:this.scale,manualPos:this._manualPos,collapsed:[...this.collapsed]});
  }

  // ── Build UI ───────────────────────────────────────────────────────────
  buildUI(){
    const root=this.containerEl.children[1];root.empty();
    const isRight=(this.PS.toolbarPosition||'top')==='right';
    root.style.cssText=`display:flex;flex-direction:${isRight?'row':'column'};height:100%;overflow:hidden;background:var(--background-primary);`;

    const body=document.createElement('div');
    body.style.cssText='flex:1;display:flex;flex-direction:row;min-height:0;min-width:0;overflow:hidden;';

    const svgWrap=document.createElement('div');
    svgWrap.style.cssText='flex:1;overflow:hidden;position:relative;min-width:0;';

    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.style.cssText='width:100%;height:100%;cursor:grab;display:block;';
    svgWrap.appendChild(svg);this.svg=svg;

    const defs=document.createElementNS('http://www.w3.org/2000/svg','defs');
    defs.innerHTML=`
      <filter id="tfS" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#000" flood-opacity=".13"/>
      </filter>
      <filter id="tfSH" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity=".2"/>
      </filter>
      <marker id="tfArrow" markerWidth="6" markerHeight="6" refX="5" refY="2.2" orient="auto">
        <path d="M0,0 L0,4.5 L6,2.2 z" fill="var(--text-faint)" opacity=".7"/>
      </marker>`;
    svg.appendChild(defs);

    const g=document.createElementNS('http://www.w3.org/2000/svg','g');
    svg.appendChild(g);this.g=g;

    // minimap: right toolbar → bottom-left, top toolbar → bottom-right
    this.buildMinimap(svgWrap,!isRight);

    const panel=this.buildVaultPanel();
    body.appendChild(svgWrap);body.appendChild(panel);this._panelEl=panel;

    const toolbar=this.buildToolbar(isRight);
    if(isRight){root.appendChild(body);root.appendChild(toolbar);}
    else{root.appendChild(toolbar);root.appendChild(body);}

    svg.addEventListener('mousedown',e=>{
      if(e.button!==0||e.target.closest('.tf-node'))return;
      if(this._editingId){this._commitEdit();return;}
      if(this._editingEdge){this._commitEdgeLabel();return;}
      this._pan=true;this._panStart={mx:e.clientX,my:e.clientY,px:this.pan.x,py:this.pan.y};svg.style.cursor='grabbing';
    });
    this._mm=e=>{
      if(this._pan){this.pan.x=this._panStart.px+e.clientX-this._panStart.mx;this.pan.y=this._panStart.py+e.clientY-this._panStart.my;this.applyT();return;}
      if(this._drag){const dx=(e.clientX-this._drag.mx)/this.scale,dy=(e.clientY-this._drag.my)/this.scale;this._manualPos[this._drag.id]={x:this._drag.ox+dx,y:this._drag.oy+dy};this.draw();}
    };
    this._mu=()=>{
      if(this._pan){this._pan=false;svg.style.cursor='grab';this.save();this.updateMinimap();}
      if(this._drag){this._drag=null;this.save();}
    };
    window.addEventListener('mousemove',this._mm);window.addEventListener('mouseup',this._mu);
    svg.addEventListener('wheel',e=>{
      e.preventDefault();
      const r=svg.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
      const ns=Math.min(3,Math.max(0.1,this.scale*(e.deltaY<0?1.1:0.91)));
      this.pan.x=mx-(mx-this.pan.x)*ns/this.scale;this.pan.y=my-(my-this.pan.y)*ns/this.scale;
      this.scale=ns;this.applyT();this.updateMinimap();
    },{passive:false});
    document.addEventListener('click',()=>this.closeMenu());
    this.applyT();
  }
  onClose(){window.removeEventListener('mousemove',this._mm);window.removeEventListener('mouseup',this._mu);}
  applyT(){this.g?.setAttribute('transform',`translate(${this.pan.x},${this.pan.y}) scale(${this.scale})`);}

  fitView(){
    const pos=this._positions;if(!this.nodes.length||!Object.keys(pos).length)return;
    const xs=Object.values(pos).map(p=>p.x),ys=Object.values(pos).map(p=>p.y);const pad=70;
    const minX=Math.min(...xs)-NW_MAX/2-pad,maxX=Math.max(...xs)+NW_MAX/2+pad;
    const minY=Math.min(...ys)-NH/2-pad,maxY=Math.max(...ys)+NH/2+pad+24;
    const W=this.svg.clientWidth||900,H=this.svg.clientHeight||600;
    this.scale=Math.min(W/(maxX-minX),H/(maxY-minY),1.6);
    this.pan.x=(W-(maxX+minX)*this.scale)/2;this.pan.y=(H-(maxY+minY)*this.scale)/2;
    this.applyT();this.updateMinimap();this.save();
  }

  // ── Toolbar ────────────────────────────────────────────────────────────
  buildToolbar(isRight){
    const min=this.PS.toolbarMinimized||false;
    const showEL=this.PS.showEdgeLabels!==false;
    const tb=document.createElement('div');
    if(isRight){
      tb.style.cssText=`display:flex;flex-direction:column;align-items:stretch;flex-shrink:0;border-left:1px solid var(--background-modifier-border);background:var(--background-secondary);overflow:hidden;position:relative;width:${min?'44px':'152px'};transition:width .18s;`;
    }else{
      tb.style.cssText=`display:flex;flex-direction:row;align-items:center;flex-shrink:0;border-bottom:1px solid var(--background-modifier-border);background:var(--background-secondary);overflow-x:auto;overflow-y:hidden;padding:0 6px;gap:2px;height:${min?'38px':'42px'};transition:height .18s;`;
    }

    // search at top of right sidebar (expanded only)
    if(isRight&&!min){
      const sr=document.createElement('div');
      sr.style.cssText='display:flex;align-items:center;gap:5px;padding:7px 8px;border-bottom:1px solid var(--background-modifier-border);flex-shrink:0;';
      const si=document.createElement('span');si.style.cssText='display:flex;align-items:center;color:var(--text-muted);flex-shrink:0;width:14px;height:14px;';
      setIcon(si,'search');
      const sinp=document.createElement('input');sinp.type='text';sinp.placeholder='Search…';
      sinp.style.cssText='flex:1;padding:3px 7px;border-radius:5px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);font-size:10.5px;min-width:0;';
      sinp.addEventListener('input',()=>{this._searchQ=sinp.value.toLowerCase();this.draw();});
      sr.append(si,sinp);tb.appendChild(sr);
    }

    TOOLBAR_BTNS.forEach(def=>{
      const btn=document.createElement('button');
      btn.dataset.tfBtn=def.id;btn.title=def.label;
      const iw=document.createElement('span');iw.style.cssText='display:flex;align-items:center;justify-content:center;width:16px;height:16px;flex-shrink:0;';
      setIcon(iw,def.icon);
      const ls=document.createElement('span');ls.textContent=def.label;
      ls.style.cssText=`font-size:11px;font-weight:600;white-space:nowrap;${min?'display:none;':''}`;
      const isOn=def.toggle&&showEL;
      if(isRight){
        btn.style.cssText=`display:flex;flex-direction:row;align-items:center;gap:8px;padding:8px 10px;border:none;cursor:pointer;text-align:left;width:100%;position:relative;background:${def.accent?'var(--interactive-accent)':isOn?'rgba(99,102,241,0.13)':'transparent'};color:${def.accent?'var(--text-on-accent)':'var(--text-normal)'};`;
      }else{
        btn.style.cssText=`display:flex;flex-direction:row;align-items:center;gap:5px;padding:4px ${min?'7px':'10px'};border:none;cursor:pointer;border-radius:6px;height:30px;position:relative;background:${def.accent?'var(--interactive-accent)':isOn?'rgba(99,102,241,0.13)':'transparent'};color:${def.accent?'var(--text-on-accent)':'var(--text-normal)'};`;
      }
      btn.append(iw,ls);

      // minimized hover pill
      if(min){
        const pill=document.createElement('div');
        const pp=isRight?'right:calc(100% + 6px);top:50%;transform:translateY(-50%);':'top:calc(100% + 5px);left:50%;transform:translateX(-50%);';
        pill.style.cssText=`position:absolute;${pp}background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:6px;padding:4px 9px;font-size:11px;font-weight:600;color:var(--text-normal);white-space:nowrap;display:none;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,.2);pointer-events:none;align-items:center;gap:6px;`;
        const pi=document.createElement('span');pi.style.cssText='display:flex;align-items:center;width:14px;height:14px;';setIcon(pi,def.icon);
        const pt=document.createElement('span');pt.textContent=def.label;
        pill.append(pi,pt);btn.appendChild(pill);
        btn.addEventListener('mouseenter',()=>pill.style.display='flex');
        btn.addEventListener('mouseleave',()=>pill.style.display='none');
      }
      btn.addEventListener('mouseenter',()=>{if(!def.accent&&!isOn)btn.style.background='var(--background-modifier-hover)';});
      btn.addEventListener('mouseleave',()=>{if(!def.accent)btn.style.background=isOn?'rgba(99,102,241,0.13)':'transparent';});
      btn.addEventListener('click',()=>this._handleToolbarBtn(def.id));
      tb.appendChild(btn);
    });

    // search + hint for top bar
    if(!isRight&&!min){
      const sw=document.createElement('div');sw.style.cssText='display:flex;align-items:center;margin-left:auto;padding:0 2px;';
      const sinp=document.createElement('input');sinp.type='text';sinp.placeholder='🔍  Search…';
      sinp.style.cssText='padding:3px 9px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);font-size:10.5px;width:130px;';
      sinp.addEventListener('input',()=>{this._searchQ=sinp.value.toLowerCase();this.draw();});
      sw.appendChild(sinp);tb.appendChild(sw);
// hint text removed — toolbar now scrollable
    }

    // chevron
    const chevBtn=document.createElement('button');
    chevBtn.title=min?'Expand toolbar':'Minimize toolbar';
    const chevIcon=document.createElement('span');chevIcon.style.cssText='display:flex;align-items:center;width:16px;height:16px;';
    if(isRight){
      setIcon(chevIcon,min?'chevron-left':'chevron-right');
      chevBtn.style.cssText='background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-muted);padding:8px;margin-top:auto;width:100%;height:36px;border-top:1px solid var(--background-modifier-border);';
    }else{
      setIcon(chevIcon,min?'chevron-down':'chevron-up');
      chevBtn.style.cssText='background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-muted);padding:4px 6px;height:30px;border-radius:6px;flex-shrink:0;';
    }
    chevBtn.appendChild(chevIcon);
    chevBtn.addEventListener('click',async()=>{
      this.PS.toolbarMinimized=!this.PS.toolbarMinimized;
      await this.plugin.savePluginSettings();
      this.buildUI();this.draw();setTimeout(()=>this.fitView(),80);
    });
    tb.appendChild(chevBtn);
    return tb;
  }

  async _handleToolbarBtn(id){
    switch(id){
      case'add-root':   this.addNode(null);break;
      case'fit':        this.fitView();break;
      case'reset':      this._manualPos={};this.save();this.draw();setTimeout(()=>this.fitView(),80);break;
      case'vault-sync': this.togglePanel();break;
      case'edge-labels':
        this.PS.showEdgeLabels=!(this.PS.showEdgeLabels!==false);
        await this.plugin.savePluginSettings();
        this.buildUI();this.draw();break;
      case'export':     this.exportOutline();break;
    }
  }

  // ── Minimap ────────────────────────────────────────────────────────────
  buildMinimap(container,placeRight){
    const mm=document.createElement('div');
    mm.title='Click to navigate';
    mm.style.cssText=`position:absolute;bottom:14px;${placeRight?'right':'left'}:14px;width:160px;height:100px;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:8px;overflow:hidden;z-index:10;box-shadow:0 2px 10px rgba(0,0,0,.18);cursor:crosshair;opacity:0.88;`;
    const mmSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    mmSvg.style.cssText='width:100%;height:100%;';
    mm.appendChild(mmSvg);container.appendChild(mm);
    this._mmEl=mm;this._mmSvg=mmSvg;
    const lbl=document.createElement('div');lbl.textContent='MAP';
    lbl.style.cssText='position:absolute;top:4px;left:7px;font-size:8px;font-weight:700;color:var(--text-faint);letter-spacing:.06em;pointer-events:none;';
    mm.appendChild(lbl);
    mmSvg.addEventListener('click',e=>{
      const r=mmSvg.getBoundingClientRect();
      const worldX=(e.clientX-r.left-this._mmOX)/this._mmScale;
      const worldY=(e.clientY-r.top-this._mmOY)/this._mmScale;
      const W=this.svg.clientWidth||900,H=this.svg.clientHeight||600;
      this.pan.x=W/2-worldX*this.scale;this.pan.y=H/2-worldY*this.scale;
      this.applyT();this.updateMinimap();this.save();
    });
  }

  updateMinimap(){
    const mmSvg=this._mmSvg;if(!mmSvg)return;
    while(mmSvg.firstChild)mmSvg.removeChild(mmSvg.firstChild);
    const pos=this._positions;if(!Object.keys(pos).length)return;
    const MMW=160,MMH=100,PAD=10;
    const xs=Object.values(pos).map(p=>p.x),ys=Object.values(pos).map(p=>p.y);
    const minX=Math.min(...xs)-NW_MAX/2,maxX=Math.max(...xs)+NW_MAX/2;
    const minY=Math.min(...ys)-NH/2,maxY=Math.max(...ys)+NH/2;
    const sc=Math.min((MMW-PAD*2)/(maxX-minX||1),(MMH-PAD*2)/(maxY-minY||1));
    const oX=(MMW-(maxX+minX)*sc)/2,oY=(MMH-(maxY+minY)*sc)/2;
    this._mmScale=sc;this._mmOX=oX;this._mmOY=oY;
    const toMM=(x,y)=>({x:x*sc+oX,y:y*sc+oY});
    const depths=computeDepths(this.nodes,this.edges);
    for(const e of this.edges){
      const fp=pos[e.from],tp=pos[e.to];if(!fp||!tp)continue;
      const p1=toMM(fp.x,fp.y),p2=toMM(tp.x,tp.y);
      const line=document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1',p1.x);line.setAttribute('y1',p1.y);line.setAttribute('x2',p2.x);line.setAttribute('y2',p2.y);
      line.setAttribute('stroke','var(--text-faint)');line.setAttribute('stroke-width','0.6');line.setAttribute('opacity','0.45');
      mmSvg.appendChild(line);
    }
    for(const node of this.nodes){
      const p=pos[node.id];if(!p)continue;
      const mp=toMM(p.x,p.y);const col=this.getColour(depths[node.id]||0);
      const nw=nodeWidth(node.name);const rw=Math.max(10,nw*sc),rh=Math.max(5,NH*sc);
      const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
      rect.setAttribute('x',mp.x-rw/2);rect.setAttribute('y',mp.y-rh/2);
      rect.setAttribute('width',rw);rect.setAttribute('height',rh);rect.setAttribute('rx','2');rect.setAttribute('fill',col.bg);
      mmSvg.appendChild(rect);
      if(rw>=18){
        const txt=document.createElementNS('http://www.w3.org/2000/svg','text');
        txt.setAttribute('x',mp.x);txt.setAttribute('y',mp.y+0.4);
        txt.setAttribute('text-anchor','middle');txt.setAttribute('dominant-baseline','middle');
        txt.setAttribute('fill',col.text||'#fff');txt.setAttribute('font-size',Math.min(5.5,rh*0.62));
        txt.setAttribute('font-weight','600');txt.setAttribute('font-family','system-ui,sans-serif');
        const mc=Math.floor(rw/3.2);txt.textContent=node.name.length>mc?node.name.slice(0,mc-1)+'…':node.name;
        mmSvg.appendChild(txt);
      }
    }
    const W=this.svg.clientWidth||900,H=this.svg.clientHeight||600;
    const vp1=toMM(-this.pan.x/this.scale,-this.pan.y/this.scale);
    const vp2=toMM(-this.pan.x/this.scale+W/this.scale,-this.pan.y/this.scale+H/this.scale);
    const vp=document.createElementNS('http://www.w3.org/2000/svg','rect');
    vp.setAttribute('x',vp1.x);vp.setAttribute('y',vp1.y);
    vp.setAttribute('width',Math.max(0,vp2.x-vp1.x));vp.setAttribute('height',Math.max(0,vp2.y-vp1.y));
    vp.setAttribute('fill','rgba(99,102,241,0.08)');vp.setAttribute('stroke','var(--interactive-accent)');vp.setAttribute('stroke-width','1');vp.setAttribute('rx','1');
    mmSvg.appendChild(vp);
  }

  // ── Edge animations ────────────────────────────────────────────────────
  animateEdges(nodeId,pos){
    this.clearEdgeAnimation();
    const ag=document.createElementNS('http://www.w3.org/2000/svg','g');ag.setAttribute('id','tfAnimLayer');
    this.edges.filter(e=>e.from===nodeId||e.to===nodeId).forEach(e=>{
      const fp=pos[e.from],tp=pos[e.to];if(!fp||!tp)return;
      const x1=fp.x,y1=fp.y+NH/2+1,x2=tp.x,y2=tp.y-NH/2-1;
      const cy1=y1+(y2-y1)*.38,cy2=y2-(y2-y1)*.38;
      const d=`M${x1},${y1} C${x1},${cy1} ${x2},${cy2} ${x2},${y2}`;
      const glow=document.createElementNS('http://www.w3.org/2000/svg','path');
      glow.setAttribute('d',d);glow.setAttribute('fill','none');glow.setAttribute('stroke','var(--interactive-accent)');glow.setAttribute('stroke-width','2');glow.setAttribute('opacity','0.45');
      ag.appendChild(glow);
      const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
      dot.setAttribute('r','3.5');dot.setAttribute('fill','var(--interactive-accent)');dot.setAttribute('opacity','0.9');
      const anim=document.createElementNS('http://www.w3.org/2000/svg','animateMotion');
      anim.setAttribute('dur','1.4s');anim.setAttribute('repeatCount','indefinite');anim.setAttribute('path',d);
      anim.setAttribute('calcMode','spline');anim.setAttribute('keyTimes','0;1');anim.setAttribute('keySplines','0.4 0 0.6 1');
      dot.appendChild(anim);ag.appendChild(dot);
    });
    this.g.appendChild(ag);
  }
  clearEdgeAnimation(){this.g?.querySelector('#tfAnimLayer')?.remove();}

  // ── Vault sync panel ───────────────────────────────────────────────────
  buildVaultPanel(){
    const panel=document.createElement('div');
    panel.style.cssText='width:280px;flex-shrink:0;display:none;flex-direction:column;border-left:1px solid var(--background-modifier-border);background:var(--background-secondary);overflow:hidden;';
    const hdr=document.createElement('div');
    hdr.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--background-modifier-border);flex-shrink:0;';
    const ht=document.createElement('span');ht.textContent='🔗  Vault Sync';ht.style.cssText='font-weight:700;font-size:12px;color:var(--text-normal);';
    const xb=document.createElement('button');xb.textContent='✕';xb.style.cssText='background:none;border:none;cursor:pointer;font-size:12px;color:var(--text-muted);padding:2px 7px;border-radius:4px;';
    xb.addEventListener('click',()=>this.togglePanel());
    hdr.append(ht,xb);panel.appendChild(hdr);
    const body=document.createElement('div');
    body.style.cssText='flex:1;overflow-y:auto;padding:11px;display:flex;flex-direction:column;gap:12px;';
    const mkS=t=>{const s=document.createElement('div');s.style.cssText='background:var(--background-primary);border-radius:8px;padding:10px 11px;display:flex;flex-direction:column;gap:7px;';const h=document.createElement('p');h.textContent=t;h.style.cssText='margin:0;font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;';s.appendChild(h);return s;};

    // auto-backlink
    const bl=mkS('AUTO-BACKLINK');
    const blR=document.createElement('div');blR.style.cssText='display:flex;align-items:center;justify-content:space-between;';
    const blL=document.createElement('span');blL.textContent='Auto-backlink';blL.style.cssText='font-size:11px;font-weight:600;color:var(--text-normal);';
    const tog=document.createElement('button');
    const stog=()=>{const on=this.PS.autoBacklink;tog.textContent=on?'ON':'OFF';tog.style.background=on?'var(--interactive-accent)':'var(--background-modifier-border)';tog.style.color=on?'var(--text-on-accent)':'var(--text-normal)';};
    tog.style.cssText='padding:2px 9px;border-radius:5px;border:none;cursor:pointer;font-size:10.5px;font-weight:700;';stog();
    tog.addEventListener('click',async()=>{this.PS.autoBacklink=!this.PS.autoBacklink;stog();await this.plugin.savePluginSettings();});
    const blD=document.createElement('p');blD.textContent='Appends [[name]] into parent note when adding child/sibling.';blD.style.cssText='margin:0;font-size:9.5px;color:var(--text-muted);line-height:1.5;';
    blR.append(blL,tog);bl.append(blR,blD);

    // sync edges
    const se=mkS('SYNC EDGES FROM NOTES');
    const seD=document.createElement('p');seD.textContent='Scans [[wikilinks]] in map notes. Markdown files only — attachments skipped automatically.';seD.style.cssText='margin:0;font-size:9.5px;color:var(--text-muted);line-height:1.5;';
    this._syncStatus=document.createElement('p');this._syncStatus.style.cssText='margin:0;font-size:10px;color:var(--text-accent);font-weight:600;min-height:13px;';
    const syncBtn=document.createElement('button');syncBtn.textContent='🔍 Scan & Sync Edges';
    syncBtn.style.cssText='padding:5px 11px;border-radius:6px;border:none;cursor:pointer;font-size:10.5px;font-weight:600;background:var(--interactive-accent);color:var(--text-on-accent);';
    syncBtn.addEventListener('click',async()=>{
      syncBtn.textContent='Scanning…';syncBtn.disabled=true;
      const added=await this.syncEdgesFromVault();
      this._syncStatus.textContent=added>0?`✅ Added ${added} new connection${added>1?'s':''}.`:'✓ No new connections found.';
      syncBtn.textContent='🔍 Scan & Sync Edges';syncBtn.disabled=false;this.draw();
    });
    se.append(seD,this._syncStatus,syncBtn);

    // orphan notes
    const or=mkS('ORPHAN NOTES');
    const orD=document.createElement('p');orD.textContent='Vault notes not yet on this map. Click ＋ to add as root node.';orD.style.cssText='margin:0;font-size:9.5px;color:var(--text-muted);';
    const ob=document.createElement('button');ob.textContent='📂 Load Orphan Notes';
    ob.style.cssText='padding:5px 11px;border-radius:6px;border:none;cursor:pointer;font-size:10.5px;font-weight:600;background:var(--background-modifier-border);color:var(--text-normal);';
    this._orphanList=document.createElement('div');this._orphanList.style.cssText='display:flex;flex-direction:column;gap:3px;max-height:200px;overflow-y:auto;';
    ob.addEventListener('click',async()=>{ob.textContent='Loading…';ob.disabled=true;await this.loadOrphanNotes();ob.textContent='📂 Refresh';ob.disabled=false;});
    or.append(orD,ob,this._orphanList);
    body.append(bl,se,or);panel.appendChild(body);
    return panel;
  }

  togglePanel(){
    this._panelOpen=!this._panelOpen;
    this._panelEl.style.display=this._panelOpen?'flex':'none';
    if(this._panelOpen)this._panelEl.style.flexDirection='column';
  }

  async syncEdgesFromVault(){
    let added=0;
    for(const node of this.nodes){
      const file=this.app.vault.getAbstractFileByPath(node.file);
      if(!(file instanceof TFile))continue;
      const content=await this.app.vault.read(file);
      const links=extractMarkdownLinks(content,this.app.vault);
      for(const link of links){
        const target=this.nodes.find(n=>n.name.toLowerCase()===link.toLowerCase());
        if(!target||target.id===node.id)continue;
        if(!this.edges.some(e=>e.from===node.id&&e.to===target.id)){this.edges.push({from:node.id,to:target.id});added++;}
      }
    }
    if(added>0)await this.save();return added;
  }

  async writeBacklink(parentNode,childName){
    const file=this.app.vault.getAbstractFileByPath(parentNode.file);
    if(!(file instanceof TFile))return;
    const content=await this.app.vault.read(file);
    const link=`[[${childName}]]`;
    if(content.includes(link))return;
    await this.app.vault.modify(file,content+(content.endsWith('\n')?'':'\n')+link+'\n');
  }

  async loadOrphanNotes(){
    const list=this._orphanList;while(list.firstChild)list.removeChild(list.firstChild);
    const mapFiles=new Set(this.nodes.map(n=>n.file));
    const mapNames=new Set(this.nodes.map(n=>n.name.toLowerCase()));
    const orphans=this.app.vault.getMarkdownFiles().filter(f=>!mapFiles.has(f.path)&&!mapNames.has(f.basename.toLowerCase()));
    if(!orphans.length){const p=document.createElement('p');p.textContent='All notes are on the map!';p.style.cssText='font-size:10px;color:var(--text-muted);margin:0;';list.appendChild(p);return;}
    orphans.slice(0,80).forEach(f=>{
      const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:4px;background:var(--background-secondary);';
      const nm=document.createElement('span');nm.textContent=f.basename;nm.style.cssText='font-size:10px;color:var(--text-normal);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;';
      const ab=document.createElement('button');ab.textContent='＋';ab.style.cssText='padding:1px 6px;border-radius:3px;border:none;cursor:pointer;font-size:10px;font-weight:700;background:var(--interactive-accent);color:var(--text-on-accent);flex-shrink:0;';
      ab.addEventListener('click',async()=>{const id=`n${Date.now()}`;this.nodes.push({id,name:f.basename,file:f.path});await this.save();this.draw();ab.textContent='✓';ab.disabled=true;ab.style.background='var(--background-modifier-border)';ab.style.color='var(--text-muted)';});
      row.append(nm,ab);list.appendChild(row);
    });
    if(orphans.length>80){const p=document.createElement('p');p.textContent=`…and ${orphans.length-80} more`;p.style.cssText='font-size:9.5px;color:var(--text-muted);margin:3px 0 0;text-align:center;';list.appendChild(p);}
  }

  // ── Inline node editing ────────────────────────────────────────────────
  async _startInlineEdit(nodeId,isNew=false){
    this._editingId=nodeId;this._isNewNode=isNew;this.draw();
    setTimeout(()=>{const inp=this.g?.querySelector(`[data-edit-id="${nodeId}"]`);if(inp){inp.focus();inp.select();}},30);
  }

  async _commitEdit(nodeId,newName){
    const id=nodeId||this._editingId;if(!id)return;
    const node=this.nodes.find(n=>n.id===id);if(!node)return;
    const name=(newName||'').trim();
    const err=validateName(name,this.nodes,id);
    if(err){const errEl=this.g?.querySelector(`[data-edit-err="${id}"]`);if(errEl){errEl.textContent=err;errEl.style.display='block';}return;}
    node.name=name;
    if(!node.file){
      node.file=await this.createMd(name);
      if(this.PS.autoBacklink){const pe=this.edges.find(e=>e.to===id);const pn=pe?this.nodes.find(n=>n.id===pe.from):null;if(pn&&pn.file)await this.writeBacklink(pn,name);}
    }
    this._editingId=null;this._isNewNode=false;
    await this.save();this.draw();setTimeout(()=>this.fitView(),80);
  }

  _cancelEdit(){
    if(!this._editingId)return;
    if(this._isNewNode){const id=this._editingId;this.nodes=this.nodes.filter(n=>n.id!==id);this.edges=this.edges.filter(e=>e.from!==id&&e.to!==id);delete this._manualPos[id];this.save();}
    this._editingId=null;this._isNewNode=false;this.draw();
  }

  // ── Edge label editing ─────────────────────────────────────────────────
  _startEdgeLabelEdit(from,to){
    this._editingEdge={from,to};this.draw();
    setTimeout(()=>{const inp=this.g?.querySelector('[data-edge-edit]');if(inp){inp.focus();inp.select();}},30);
  }
  async _commitEdgeLabel(newLabel){
    if(!this._editingEdge)return;
    const{from,to}=this._editingEdge;
    const edge=this.edges.find(e=>e.from===from&&e.to===to);
    if(edge){const v=(newLabel||'').trim();if(v)edge.label=v;else delete edge.label;}
    this._editingEdge=null;await this.save();this.draw();
  }
  _cancelEdgeLabelEdit(){this._editingEdge=null;this.draw();}

  // ── Main draw ──────────────────────────────────────────────────────────
  draw(){
    if(!this.g)return;
    while(this.g.firstChild)this.g.removeChild(this.g.firstChild);
    if(!this.nodes.length){this.drawEmpty();return;}

    const autoPos=layout(this.nodes,this.edges,this.collapsed);
    const depths=computeDepths(this.nodes,this.edges);
    const pos={};this.nodes.forEach(n=>{pos[n.id]=this._manualPos[n.id]?{...this._manualPos[n.id]}:{...autoPos[n.id]};});
    this._positions=pos;

    const vis=new Set(),visEdges=[];
    const addVis=id=>{if(vis.has(id))return;vis.add(id);if(this.collapsed.has(id))return;this.edges.filter(e=>e.from===id).forEach(e=>{addVis(e.to);visEdges.push(e);});};
    const ci=new Set(this.edges.map(e=>e.to));
    this.nodes.filter(n=>!ci.has(n.id)).forEach(n=>addVis(n.id));
    this.nodes.forEach(n=>{if(!vis.has(n.id))vis.add(n.id);});

    const sq=this._searchQ;
    const showLabels=this.PS.showEdgeLabels!==false;

    // edges
    const eg=document.createElementNS('http://www.w3.org/2000/svg','g');
    for(const e of visEdges){
      const fp=pos[e.from],tp=pos[e.to];if(!fp||!tp)continue;
      const x1=fp.x,y1=fp.y+NH/2+1,x2=tp.x,y2=tp.y-NH/2-1;
      const cy1=y1+(y2-y1)*.38,cy2=y2-(y2-y1)*.38;
      const d=`M${x1},${y1} C${x1},${cy1} ${x2},${cy2} ${x2},${y2}`;

      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d',d);path.setAttribute('fill','none');
      path.setAttribute('stroke','var(--text-faint)');path.setAttribute('stroke-width','1.2');path.setAttribute('opacity','0.65');
      path.setAttribute('marker-end','url(#tfArrow)');eg.appendChild(path);

      // wide hit zone for double-click / right-click
      const hit=document.createElementNS('http://www.w3.org/2000/svg','path');
      hit.setAttribute('d',d);hit.setAttribute('fill','none');hit.setAttribute('stroke','transparent');hit.setAttribute('stroke-width','14');hit.style.cursor='pointer';
      hit.addEventListener('dblclick',ev=>{ev.stopPropagation();this._startEdgeLabelEdit(e.from,e.to);});
      hit.addEventListener('contextmenu',ev=>{ev.preventDefault();ev.stopPropagation();this.showEdgeMenu(ev,e);});
      eg.appendChild(hit);

      // edge label
      const isEditingThis=this._editingEdge&&this._editingEdge.from===e.from&&this._editingEdge.to===e.to;
      const mid=bezierMid(x1,y1,x1,cy1,x2,cy2,x2,y2);

      if(isEditingThis){
        const lw=130,lh=24;
        const lfo=document.createElementNS('http://www.w3.org/2000/svg','foreignObject');
        lfo.setAttribute('x',mid.x-lw/2);lfo.setAttribute('y',mid.y-lh/2);lfo.setAttribute('width',lw+20);lfo.setAttribute('height',lh);lfo.style.overflow='visible';
        const linp=document.createElement('input');linp.type='text';linp.value=e.label||'';
        linp.setAttribute('data-edge-edit','1');
        linp.style.cssText=`width:${lw}px;height:${lh}px;box-sizing:border-box;padding:0 8px;border-radius:6px;border:1.5px solid var(--interactive-accent);background:var(--background-primary);color:var(--text-normal);font-size:10px;font-weight:600;outline:none;`;
        linp.addEventListener('keydown',ev=>{
          if(ev.key==='Enter'){ev.preventDefault();this._commitEdgeLabel(linp.value);}
          if(ev.key==='Escape'){ev.stopPropagation();this._cancelEdgeLabelEdit();}
        });
        linp.addEventListener('blur',()=>setTimeout(()=>{if(this._editingEdge)this._commitEdgeLabel(linp.value);},120));
        lfo.appendChild(linp);eg.appendChild(lfo);
      } else if(e.label&&showLabels&&this.scale>0.45){
        const lw=Math.min(130,e.label.length*7+16),lh=18;
        const lfo=document.createElementNS('http://www.w3.org/2000/svg','foreignObject');
        lfo.setAttribute('x',mid.x-lw/2);lfo.setAttribute('y',mid.y-lh/2);lfo.setAttribute('width',lw);lfo.setAttribute('height',lh);lfo.style.overflow='visible';lfo.style.cursor='pointer';
        const lpill=document.createElement('div');
        const opacity=this.scale<0.6?this.scale/0.6:1;
        lpill.style.cssText=`width:${lw}px;height:${lh}px;border-radius:5px;background:var(--background-secondary);border:1px solid var(--background-modifier-border);display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:600;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 5px;box-sizing:border-box;opacity:${opacity};`;
        lpill.textContent=e.label;lpill.title=`Label: ${e.label} — double-click to edit`;
        lpill.addEventListener('dblclick',ev=>{ev.stopPropagation();this._startEdgeLabelEdit(e.from,e.to);});
        lfo.appendChild(lpill);eg.appendChild(lfo);
      }
    }
    this.g.appendChild(eg);

    // nodes
    const ng=document.createElementNS('http://www.w3.org/2000/svg','g');
    for(const node of this.nodes){
      if(!vis.has(node.id))continue;
      const p=pos[node.id];
      const dep=depths[node.id]||0;
      const col=this.getColour(dep);
      const bg=col.bg,tc=col.text||autoText(bg),bd=darken(bg,18);
      const nw=nodeWidth(node.name);
      const hasKids=this.edges.some(e=>e.from===node.id);
      const isCol=this.collapsed.has(node.id);
      const descN=isCol?countDesc(node.id,this.edges):0;
      const matched=sq&&node.name.toLowerCase().includes(sq);
      const dimmed=sq&&!matched;
      const editing=node.id===this._editingId;

      const TOGH=hasKids?18:0;
      const fo=document.createElementNS('http://www.w3.org/2000/svg','foreignObject');
      fo.setAttribute('x',p.x-nw/2);fo.setAttribute('y',p.y-NH/2);
      fo.setAttribute('width',editing?NW_MAX+40:nw);fo.setAttribute('height',NH+TOGH+(editing?28:4));
      fo.setAttribute('class','tf-node');fo.setAttribute('data-id',node.id);fo.style.overflow='visible';

      const outer=document.createElement('div');outer.style.cssText='position:relative;display:flex;flex-direction:column;align-items:center;';

      if(editing){
        const initW=this._isNewNode?120:nw;
        const inp=document.createElement('input');inp.type='text';
        inp.value=this._isNewNode?'':node.name;inp.setAttribute('data-edit-id',node.id);
        inp.style.cssText=`width:${initW}px;height:${NH}px;box-sizing:border-box;padding:0 10px;border-radius:8px;background:var(--background-primary);border:2px solid var(--interactive-accent);color:var(--text-normal);font-size:11px;font-weight:600;outline:none;box-shadow:0 0 0 3px ${rgba(bg,0.22)};`;
        inp.addEventListener('input',()=>{
          const w=Math.min(NW_MAX,Math.max(NW_MIN,nodeWidth(inp.value||'x')+10));
          inp.style.width=w+'px';fo.setAttribute('width',w+40);fo.setAttribute('x',p.x-w/2);
        });
        inp.addEventListener('keydown',e=>{
          if(e.key==='Enter'){e.preventDefault();e.stopPropagation();this._commitEdit(node.id,inp.value);}
          if(e.key==='Escape'){e.stopPropagation();this._cancelEdit();}
        });
        inp.addEventListener('blur',()=>setTimeout(()=>{
          if(this._editingId!==node.id)return;
          const v=inp.value.trim();
          if(!v&&this._isNewNode){this._cancelEdit();return;}
          if(v)this._commitEdit(node.id,v);else this._cancelEdit();
        },120));
        const errEl=document.createElement('div');errEl.setAttribute('data-edit-err',node.id);
        errEl.style.cssText=`display:none;position:absolute;top:${NH+3}px;left:50%;transform:translateX(-50%);background:var(--background-primary);border:1px solid var(--text-error);border-radius:5px;padding:2px 7px;font-size:9px;color:var(--text-error);white-space:nowrap;z-index:30;box-shadow:0 2px 8px rgba(0,0,0,.2);`;
        outer.append(inp,errEl);

      }else{
        const mkAB=(title,css,fn)=>{
          const b=document.createElement('button');b.title=title;
          b.style.cssText=`position:absolute;${css}width:${BSIZE}px;height:${BSIZE}px;border-radius:50%;background:transparent;border:1.5px solid transparent;color:var(--text-muted);font-size:14px;font-weight:700;line-height:1;cursor:pointer;display:none;align-items:center;justify-content:center;padding:0;transition:border-color .12s,color .12s,background .12s;z-index:20;box-sizing:border-box;`;
          b.textContent='+';
          b.addEventListener('mouseenter',()=>{b.style.borderColor='var(--interactive-accent)';b.style.color='var(--interactive-accent)';b.style.background='var(--background-primary)';});
          b.addEventListener('mouseleave',()=>{b.style.borderColor='transparent';b.style.color='var(--text-muted)';b.style.background='transparent';});
          b.addEventListener('click',e=>{e.stopPropagation();fn();});return b;
        };
        const h=BSIZE/2;
        const bT=mkAB('Add Parent',        `top:${-h}px;left:${nw/2-h}px;`,  ()=>this.addParentNode(node));
        const bB=mkAB('Add Child',          `top:${NH-h}px;left:${nw/2-h}px;`,()=>this.addChildNode(node));
        const bR=mkAB('Add Sibling (right)',`top:${NH/2-h}px;left:${nw-h}px;`,()=>this.addSiblingNode(node));
        const bL=mkAB('Add Sibling (left)', `top:${NH/2-h}px;left:${-h}px;`, ()=>this.addSiblingNode(node));
        const allB=[bT,bB,bR,bL];
        outer.addEventListener('mouseenter',()=>{if(!dimmed){allB.forEach(b=>b.style.display='flex');this.animateEdges(node.id,pos);}});
        outer.addEventListener('mouseleave',()=>{allB.forEach(b=>b.style.display='none');this.clearEdgeAnimation();});

        const pill=document.createElement('div');
        pill.style.cssText=`width:${nw}px;height:${NH}px;box-sizing:border-box;display:flex;align-items:center;gap:5px;padding:0 9px;border-radius:8px;background:${bg};border:1.5px solid ${bd};color:${tc};font-size:11px;font-weight:600;cursor:grab;user-select:none;filter:url(#tfS);transition:opacity .15s,filter .12s;opacity:${dimmed?.14:1};${matched?'outline:2px solid #FCD34D;outline-offset:2px;':''}`;
        pill.title=`${node.name}\n\nDouble-click → open  •  Drag → move  •  Right-click → options`;
        const bar2=document.createElement('div');bar2.style.cssText=`width:2px;min-height:${NH-10}px;border-radius:2px;flex-shrink:0;background:${rgba('#fff',dep===0?.5:.22)};`;
        const lbl2=document.createElement('div');lbl2.style.cssText='flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';lbl2.textContent=node.name;
        pill.append(bar2,lbl2);
        pill.addEventListener('mouseenter',()=>{if(!dimmed)pill.style.filter='url(#tfSH)';});
        pill.addEventListener('mouseleave',()=>{pill.style.filter='url(#tfS)';});
        pill.addEventListener('dblclick',e=>{e.stopPropagation();this.openFile(node);});
        pill.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();this.showMenu(e,node);});
        pill.addEventListener('mousedown',e=>{
          if(e.button!==0)return;e.stopPropagation();
          const cur=this._manualPos[node.id]||autoPos[node.id]||{x:0,y:0};
          this._drag={id:node.id,mx:e.clientX,my:e.clientY,ox:cur.x,oy:cur.y};pill.style.cursor='grabbing';
        });
        outer.append(bT,bB,bR,bL,pill);

        if(hasKids){
          const tog=document.createElement('div');
          tog.style.cssText=`display:inline-flex;align-items:center;gap:3px;margin-top:3px;padding:1px 7px;height:15px;border-radius:4px;background:${rgba(bg,.15)};border:1px solid ${rgba(bd,.28)};color:var(--text-muted);font-size:8px;font-weight:700;cursor:pointer;user-select:none;opacity:${dimmed?.1:.75};transition:background .15s;`;
          tog.title=isCol?'Expand':'Collapse';
          const arr=document.createElement('span');arr.textContent=isCol?'▶':'▼';tog.appendChild(arr);
          if(isCol&&descN>0){const badge=document.createElement('span');badge.textContent=`+${descN}`;badge.style.cssText=`background:${bg};color:${tc};border-radius:2px;padding:1px 3px;font-size:7.5px;font-weight:700;`;tog.appendChild(badge);}
          tog.addEventListener('mouseenter',()=>tog.style.background=rgba(bg,.26));
          tog.addEventListener('mouseleave',()=>tog.style.background=rgba(bg,.15));
          tog.addEventListener('click',e=>{e.stopPropagation();this.toggleCollapse(node.id);});
          outer.appendChild(tog);
        }
      }
      fo.appendChild(outer);ng.appendChild(fo);
    }
    this.g.appendChild(ng);
    this.updateMinimap();
  }

  drawEmpty(){
    const cx=(this.svg.clientWidth||800)/2/this.scale,cy=(this.svg.clientHeight||600)/2/this.scale;
    const fo=document.createElementNS('http://www.w3.org/2000/svg','foreignObject');
    fo.setAttribute('x',cx-180);fo.setAttribute('y',cy-48);fo.setAttribute('width',360);fo.setAttribute('height',96);
    const card=document.createElement('div');
    card.style.cssText='width:360px;height:96px;border-radius:12px;background:var(--background-secondary);border:1.5px dashed var(--background-modifier-border);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;';
    card.innerHTML=`<span style="font-size:20px">🌿</span><span style="font-size:12px;font-weight:600;color:var(--text-muted);">Click <strong style="color:var(--interactive-accent)">＋ Add Root</strong> to start your TreFlex map</span>`;
    fo.appendChild(card);this.g.appendChild(fo);this.updateMinimap();
  }

  toggleCollapse(id){this.collapsed.has(id)?this.collapsed.delete(id):this.collapsed.add(id);this.save();this.draw();}

  showMenu(e,node){
    this.closeMenu();
    const hasKids=this.edges.some(ed=>ed.from===node.id),isCol=this.collapsed.has(node.id);
    const menu=document.createElement('div');
    menu.style.cssText=`position:fixed;left:${e.clientX+4}px;top:${e.clientY}px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:10px;padding:4px;z-index:9999;box-shadow:0 10px 32px rgba(0,0,0,.24);min-width:198px;`;
    const sec=l=>{if(l){const s=document.createElement('div');s.style.cssText='padding:5px 12px 2px;font-size:9px;font-weight:700;color:var(--text-faint);letter-spacing:.08em;';s.textContent=l.toUpperCase();menu.appendChild(s);}else{const hr=document.createElement('hr');hr.style.cssText='border:none;border-top:1px solid var(--background-modifier-border);margin:3px 0;';menu.appendChild(hr);}};
    const item=(icon,lbl,fn,danger=false)=>{
      const row=document.createElement('div');
      row.style.cssText=`padding:6px 12px;cursor:pointer;border-radius:5px;font-size:11.5px;display:flex;align-items:center;gap:8px;color:${danger?'var(--text-error)':'var(--text-normal)'};transition:background .1s;`;
      row.innerHTML=`<span style="width:16px;text-align:center;">${icon}</span><span>${lbl}</span>`;
      row.addEventListener('mouseenter',()=>row.style.background='var(--background-modifier-hover)');
      row.addEventListener('mouseleave',()=>row.style.background='');
      row.addEventListener('click',ev=>{ev.stopPropagation();this.closeMenu();fn();});
      menu.appendChild(row);
    };
    sec('Add');
    item('➕','Add Child Node',        ()=>this.addChildNode(node));
    item('⬆️','Add Parent Node',       ()=>this.addParentNode(node));
    item('↔️','Add Sibling Node',      ()=>this.addSiblingNode(node));
    sec(null);
    if(hasKids)item(isCol?'🔓':'🔒',isCol?'Expand Children':'Collapse Children',()=>this.toggleCollapse(node.id));
    sec('Note');item('📄','Open Note',()=>this.openFile(node));
    sec('Edit');
    item('✏️','Rename',              ()=>this._startInlineEdit(node.id,false));
    item('📍','Reset Position',       ()=>{delete this._manualPos[node.id];this.save();this.draw();});
    sec(null);
    item('🗑️','Delete Node',          ()=>this.deleteNode(node),true);
    item('🌳','Delete Node + Subtree',()=>this.deleteSubtree(node),true);
    document.body.appendChild(menu);this._menu=menu;
    const mr=menu.getBoundingClientRect();
    if(mr.right>window.innerWidth)menu.style.left=(e.clientX-mr.width-4)+'px';
    if(mr.bottom>window.innerHeight)menu.style.top=(e.clientY-mr.height)+'px';
  }

  showEdgeMenu(e,edge){
    this.closeMenu();
    const menu=document.createElement('div');
    menu.style.cssText=`position:fixed;left:${e.clientX+4}px;top:${e.clientY}px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:10px;padding:4px;z-index:9999;box-shadow:0 10px 32px rgba(0,0,0,.24);min-width:170px;`;
    const item=(icon,lbl,fn,danger=false)=>{
      const row=document.createElement('div');
      row.style.cssText=`padding:6px 12px;cursor:pointer;border-radius:5px;font-size:11.5px;display:flex;align-items:center;gap:8px;color:${danger?'var(--text-error)':'var(--text-normal)'};`;
      row.innerHTML=`<span style="width:16px;text-align:center;">${icon}</span><span>${lbl}</span>`;
      row.addEventListener('mouseenter',()=>row.style.background='var(--background-modifier-hover)');
      row.addEventListener('mouseleave',()=>row.style.background='');
      row.addEventListener('click',ev=>{ev.stopPropagation();this.closeMenu();fn();});
      menu.appendChild(row);
    };
    item('✏️','Edit Label',       ()=>this._startEdgeLabelEdit(edge.from,edge.to));
    if(edge.label)item('🗑️','Remove Label',async()=>{delete edge.label;await this.save();this.draw();},true);
    item('❌','Delete Connection', async()=>{this.edges=this.edges.filter(e=>!(e.from===edge.from&&e.to===edge.to));await this.save();this.draw();},true);
    document.body.appendChild(menu);this._menu=menu;
    const mr=menu.getBoundingClientRect();
    if(mr.right>window.innerWidth)menu.style.left=(e.clientX-mr.width-4)+'px';
    if(mr.bottom>window.innerHeight)menu.style.top=(e.clientY-mr.height)+'px';
  }

  closeMenu(){this._menu?.remove();this._menu=null;}

  async createMd(name){
    const safe=name.replace(/[\\/:*?"<>|]/g,'-');
    const folder=(this.PS.notesFolder||'').trim().replace(/\/+$/,'');
    const path=folder?`${folder}/${safe}.md`:`${safe}.md`;
    if(folder&&!this.app.vault.getAbstractFileByPath(folder)){try{await this.app.vault.createFolder(folder);}catch(e){}}
    if(!this.app.vault.getAbstractFileByPath(path))await this.app.vault.create(path,`# ${name}\n\n`);
    return path;
  }

  async _createAndEdit(parent,siblingOf){
    const id=`n${Date.now()}`;
    this.nodes.push({id,name:`__new_${id}`,file:''});
    if(parent)this.edges.push({from:parent.id,to:id});
    else if(siblingOf){const pe=this.edges.find(e=>e.to===siblingOf.id);const pn=pe?this.nodes.find(n=>n.id===pe.from):null;if(pn)this.edges.push({from:pn.id,to:id});}
    this.draw();await this._startInlineEdit(id,true);
  }

  async addNode(parent){await this._createAndEdit(parent,null);}
  async addChildNode(node){await this._createAndEdit(node,null);}
  async addParentNode(child){
    const id=`n${Date.now()}`;this.nodes.push({id,name:`__new_${id}`,file:''});
    this.edges.push({from:id,to:child.id});this.draw();await this._startInlineEdit(id,true);
  }
  async addSiblingNode(node){await this._createAndEdit(null,node);}

  async deleteNode(node){
    this.nodes=this.nodes.filter(n=>n.id!==node.id);this.edges=this.edges.filter(e=>e.from!==node.id&&e.to!==node.id);
    delete this._manualPos[node.id];await this.save();this.draw();
  }
  async deleteSubtree(node){
    const del=new Set();const collect=id=>{del.add(id);this.edges.filter(e=>e.from===id).forEach(e=>collect(e.to));};collect(node.id);
    this.nodes=this.nodes.filter(n=>!del.has(n.id));this.edges=this.edges.filter(e=>!del.has(e.from)&&!del.has(e.to));
    del.forEach(id=>delete this._manualPos[id]);await this.save();this.draw();
  }
  async openFile(node){
    const file=this.app.vault.getAbstractFileByPath(node.file);
    if(file instanceof TFile){const leaf=this.app.workspace.getLeaf('tab');await leaf.openFile(file);}
    else new Notice(`Note not found: ${node.file}`);
  }
  async exportOutline(){
    const ci=new Set(this.edges.map(e=>e.to)),roots=this.nodes.filter(n=>!ci.has(n.id));
    const lines=['# TreFlex Export',''];
    const write=(node,d)=>{lines.push('  '.repeat(d)+`- [[${node.name}]]`);this.edges.filter(e=>e.from===node.id).forEach(e=>{const ch=this.nodes.find(n=>n.id===e.to);if(ch)write(ch,d+1);});};
    roots.forEach(r=>write(r,0));
    const path='TreFlex Export.md',content=lines.join('\n');
    const ex=this.app.vault.getAbstractFileByPath(path);
    if(ex instanceof TFile)await this.app.vault.modify(ex,content);else await this.app.vault.create(path,content);
    new Notice('✅ Exported to "TreFlex Export.md"');
    const leaf=this.app.workspace.getLeaf('tab');
    const f=this.app.vault.getAbstractFileByPath(path);if(f instanceof TFile)await leaf.openFile(f);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Settings tab
// ══════════════════════════════════════════════════════════════════════════════
class TreFlexSettingTab extends PluginSettingTab{
  constructor(app,plugin){super(app,plugin);this.plugin=plugin;}
  display(){
    const{containerEl}=this;containerEl.empty();
    containerEl.createEl('h2',{text:'TreFlex'});

    containerEl.createEl('h3',{text:'Interface'});
    new Setting(containerEl).setName('Toolbar position').setDesc('Where the toolbar sits. Reopening the view applies the change.')
      .addDropdown(dd=>{dd.addOption('top','Top (default)');dd.addOption('right','Right');
        dd.setValue(this.plugin.pluginSettings.toolbarPosition||'top');
        dd.onChange(async v=>{this.plugin.pluginSettings.toolbarPosition=v;await this.plugin.savePluginSettings();});});

    new Setting(containerEl).setName('Show edge labels by default').setDesc('Toggle any time via the toolbar tag icon.')
      .addToggle(t=>t.setValue(this.plugin.pluginSettings.showEdgeLabels!==false)
        .onChange(async v=>{this.plugin.pluginSettings.showEdgeLabels=v;await this.plugin.savePluginSettings();}));

    containerEl.createEl('h3',{text:'Files'});
    new Setting(containerEl).setName('Notes folder').setDesc('Folder for new topic notes. Blank = vault root.  e.g. Maps/Topics')
      .addText(t=>t.setPlaceholder('Maps/Topics').setValue(this.plugin.pluginSettings.notesFolder||'')
        .onChange(async v=>{this.plugin.pluginSettings.notesFolder=v.trim();await this.plugin.savePluginSettings();}));
    new Setting(containerEl).setName('Auto-backlink').setDesc('Appends [[name]] into parent note when adding child/sibling.')
      .addToggle(t=>t.setValue(!!this.plugin.pluginSettings.autoBacklink)
        .onChange(async v=>{this.plugin.pluginSettings.autoBacklink=v;await this.plugin.savePluginSettings();}));

    containerEl.createEl('h3',{text:'Colours'});
    new Setting(containerEl).setName('Colour mode').setDesc('Per level: each depth gets its own colour.  Uniform: all nodes share one colour.')
      .addDropdown(dd=>{dd.addOption('per-level','Per level');dd.addOption('uniform','Uniform');
        dd.setValue(this.plugin.pluginSettings.colourMode||'per-level');
        dd.onChange(async v=>{this.plugin.pluginSettings.colourMode=v;await this.plugin.savePluginSettings();this.display();});});

    const mode=this.plugin.pluginSettings.colourMode||'per-level';
    if(mode==='uniform'){
      const uc=this.plugin.pluginSettings.uniformColour||{bg:'#5B21B6',text:'#fff'};
      const us=new Setting(containerEl).setName('Node colour').setDesc('Applied to all nodes at every depth.');
      const sw=us.nameEl.createEl('span');sw.style.cssText=`display:inline-block;width:48px;height:17px;border-radius:3px;background:${uc.bg};margin-left:10px;vertical-align:middle;border:1px solid ${darken(uc.bg,18)};`;
      us.addColorPicker(cp=>cp.setValue(uc.bg).onChange(async v=>{this.plugin.pluginSettings.uniformColour={bg:v,text:autoText(v)};await this.plugin.savePluginSettings();sw.style.background=v;sw.style.borderColor=darken(v,18);}));
    }else{
      new Setting(containerEl).setName('Preset palette').setDesc('Quick-apply a full palette. Fine-tune individual levels below.')
        .addDropdown(dd=>{PRESETS.forEach((p,i)=>dd.addOption(String(i),p.name));
          dd.setValue(String(this.plugin.pluginSettings.presetIndex||0));
          dd.onChange(async v=>{const idx=parseInt(v);this.plugin.pluginSettings.presetIndex=idx;this.plugin.pluginSettings.palette=PRESETS[idx].colors.map(c=>({...c}));await this.plugin.savePluginSettings();this.display();});});

      const palette=this.plugin.pluginSettings.palette;
      containerEl.createEl('p',{text:'Levels beyond the last configured entry automatically inherit its colour.'}).style.cssText='font-size:11.5px;color:var(--text-muted);margin:4px 0 10px;';

      palette.forEach((c,i)=>{
        const s=new Setting(containerEl).setName(i===0?'Root':`L${i}`);
        const sw=s.nameEl.createEl('span');sw.style.cssText=`display:inline-block;width:46px;height:16px;border-radius:3px;background:${c.bg};margin-left:10px;vertical-align:middle;border:1px solid ${darken(c.bg,18)};`;
        s.addColorPicker(cp=>cp.setValue(c.bg).onChange(async v=>{palette[i]={bg:v,text:autoText(v)};await this.plugin.savePluginSettings();sw.style.background=v;sw.style.borderColor=darken(v,18);}));
        if(i>=2)s.addButton(btn=>btn.setButtonText('Remove').setWarning().onClick(async()=>{palette.splice(i,1);await this.plugin.savePluginSettings();this.display();}));
      });
      new Setting(containerEl).setName('Add level').setDesc('Pre-configure colour for the next depth level.')
        .addButton(btn=>btn.setButtonText('+ Add Level').onClick(async()=>{palette.push({...palette[palette.length-1]});await this.plugin.savePluginSettings();this.display();}));
    }

    containerEl.createEl('h3',{text:'Quick reference'});
    const ul=containerEl.createEl('ul');ul.style.cssText='font-size:12px;color:var(--text-muted);line-height:1.9;';
    ['Click ＋ Add Root → type name inline → Enter to confirm, Escape to cancel.',
     'Hover any node: top + = parent, bottom + = child, left/right + = sibling.',
     'Double-click a node to open its linked note in a new tab.',
     'Double-click any edge to add or edit its label. Right-click an edge for options.',
     'Edge label toggle: tag icon in toolbar (or set default above).',
     '🔗 Vault Sync scans [[wikilinks]] — markdown only, all attachments skipped.',
     'Minimap (corner) — click anywhere to jump to that area of the map.',
     'Toolbar chevron collapses/expands the toolbar to save canvas space.',
    ].forEach(t=>ul.createEl('li',{text:t}));
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Plugin
// ══════════════════════════════════════════════════════════════════════════════
const DEFAULT_SETTINGS={
  notesFolder:'',autoBacklink:false,presetIndex:0,
  palette:PRESETS[0].colors.map(c=>({...c})),
  colourMode:'per-level',uniformColour:{bg:'#5B21B6',text:'#fff'},
  toolbarPosition:'top',toolbarMinimized:false,showEdgeLabels:true,
};

class TreFlexPlugin extends Plugin{
  async onload(){
    await this.loadPluginSettings();
    this.registerView(VIEW_TYPE,leaf=>new TreFlexView(leaf,this));
    this.addRibbonIcon('workflow','Open TreFlex',()=>this.activateView());
    this.addCommand({id:'open-treflex',name:'Open TreFlex',callback:()=>this.activateView()});
    this.addSettingTab(new TreFlexSettingTab(this.app,this));
  }
  async loadPluginSettings(){
    const raw=await this.loadData();
    this.pluginSettings=Object.assign({},DEFAULT_SETTINGS,raw?.__pluginSettings||{});
    if(!this.pluginSettings.palette||this.pluginSettings.palette.length<2)
      this.pluginSettings.palette=PRESETS[this.pluginSettings.presetIndex||0].colors.map(c=>({...c}));
  }
  async savePluginSettings(){
    const current=await this.loadData()||{};current.__pluginSettings=this.pluginSettings;await this.saveData(current);
  }
  async activateView(){
    const ex=this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if(ex.length){this.app.workspace.revealLeaf(ex[0]);return;}
    const leaf=this.app.workspace.getLeaf('tab');
    await leaf.setViewState({type:VIEW_TYPE,active:true});
    leaf.setPinned(true);this.app.workspace.revealLeaf(leaf);
  }
  onunload(){}
}

module.exports=TreFlexPlugin;
