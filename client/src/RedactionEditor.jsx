import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, LockKeyhole, Plus, Shield, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react';
import { assessPrivacyRisk } from './privacyRisk.js';
import { mapPointerToPixels, moveRegion, resizeRegion } from './editorGeometry.js';
import { saveWork } from './workStore.js';

export default function RedactionEditor({ work, onContinue, onChooseFile }) {
  const pages = work.kind === 'pdf' ? work.pages : [{ page: 1, width: work.width, height: work.height, preview: work.image }];
  const [detections, setDetections] = useState(work.detections || []);
  const [manual, setManual] = useState(work.manual || []);
  const [drawing, setDrawing] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [draft, setDraft] = useState(null);
  const state = useRef({ detections: work.detections || [], manual: work.manual || [] });
  const history = useRef([]);
  const redoHistory = useRef([]);
  const pointer = useRef(null);
  const dragged = useRef(false);
  const page = pages[pageIndex];
  const allItems = [...detections.map((item) => ({ ...item, type: 'detection' })), ...manual.map((item) => ({ ...item, type: 'manual' }))];
  const selected = allItems.filter((item) => item.selected);
  const risk = assessPrivacyRisk({ detections, manual, pagesExpected: pages.length, pagesScanned: work.pagesScanned ?? pages.length });
  const current = allItems.filter((item) => (item.page || 1) === page.page);
  const fitWidth = 550 * page.width / page.height;

  function commit(next) {
    history.current.push(state.current);
    if (history.current.length > 50) history.current.shift();
    redoHistory.current = [];
    state.current = next;
    setDetections(next.detections);
    setManual(next.manual);
  }
  function restore(source, target) {
    if (!source.current.length) return;
    target.current.push(state.current);
    const next = source.current.pop();
    state.current = next;
    setDetections(next.detections);
    setManual(next.manual);
  }
  function applyAll(value) {
    commit({ detections: state.current.detections.map((item) => ({ ...item, selected: value })), manual: state.current.manual.map((item) => ({ ...item, selected: value })) });
  }
  function applyCategory(category) {
    commit({ detections: state.current.detections.map((item) => item.category === category ? { ...item, selected: true } : item), manual: state.current.manual });
  }
  function toggle(item) {
    const key = item.type === 'manual' ? 'manual' : 'detections';
    commit({ ...state.current, [key]: state.current[key].map((entry) => entry.id === item.id ? { ...entry, selected: !entry.selected } : entry) });
  }
  function remove(item) { commit({ ...state.current, manual: state.current.manual.filter((entry) => entry.id !== item.id) }); }
  function pos(event, element, dimensions) {
    return mapPointerToPixels(event.clientX, event.clientY, element.getBoundingClientRect(), dimensions);
  }
  function beginDraw(event) {
    if (!drawing || event.button !== 0) return;
    const origin = pos(event, event.currentTarget, page);
    if (!origin) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { mode: 'draw', origin, page: page.page, pointerId: event.pointerId };
  }
  function beginEdit(event, item, mode) {
    if (drawing || event.button !== 0) return;
    event.stopPropagation();
    const canvas = event.currentTarget.closest('.image-canvas');
    const origin = pos(event, canvas, page);
    if (!origin) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { mode, origin, page: page.page, pointerId: event.pointerId, item, type: item.type };
    dragged.current = false;
  }
  function onMove(event) {
    const action = pointer.current;
    if (!action || action.pointerId !== event.pointerId || action.page !== page.page) return;
    const point = pos(event, event.currentTarget, page);
    if (!point) return;
    if (Math.abs(point.x - action.origin.x) + Math.abs(point.y - action.origin.y) > 3) dragged.current = true;
    if (action.mode === 'draw') {
      setDraft({ page: page.page, x: Math.min(action.origin.x, point.x), y: Math.min(action.origin.y, point.y), width: Math.abs(point.x - action.origin.x), height: Math.abs(point.y - action.origin.y) });
      return;
    }
    const item = action.item;
    setDraft(action.mode === 'move'
      ? moveRegion(item, point.x-action.origin.x, point.y-action.origin.y, page)
      : resizeRegion(item, point.x-action.origin.x, point.y-action.origin.y, page));
  }
  function onUp(event) {
    const action = pointer.current;
    if (!action || action.pointerId !== event.pointerId || action.page !== page.page) return;
    const point = pos(event, event.currentTarget, page);
    pointer.current = null;
    setDraft(null);
    if (!point) return;
    if (action.mode === 'draw') {
      const width = Math.abs(point.x-action.origin.x), height = Math.abs(point.y-action.origin.y);
      if (width < 8 || height < 8) return;
      const item = { id: 'manual-' + Date.now(), page: page.page, category: 'manual', label: 'Manual selection', x: Math.min(action.origin.x,point.x), y: Math.min(action.origin.y,point.y), width, height, selected: true };
      commit({ ...state.current, manual: [...state.current.manual, item] });
    } else if (dragged.current) {
      const item = action.item;
      const updated = action.mode === 'move'
        ? moveRegion(item, point.x-action.origin.x, point.y-action.origin.y, page)
        : resizeRegion(item, point.x-action.origin.x, point.y-action.origin.y, page);
      const key = action.type === 'manual' ? 'manual' : 'detections';
      commit({ ...state.current, [key]: state.current[key].map((entry) => entry.id === item.id ? updated : entry) });
    }
  }
  function keyboardResize(event, item) {
    const directions = { ArrowRight: [1,0], ArrowLeft: [-1,0], ArrowDown: [0,1], ArrowUp: [0,-1] };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const amount = event.shiftKey ? 10 : 1;
    const key = item.type === 'manual' ? 'manual' : 'detections';
    const nextItem = resizeRegion(item, direction[0]*amount, direction[1]*amount, page);
    commit({ ...state.current, [key]: state.current[key].map((entry) => entry.id === item.id ? nextItem : entry) });
  }
  function styleFor(item) { return { left: (item.x/page.width*100)+'%', top: (item.y/page.height*100)+'%', width: (item.width/page.width*100)+'%', height: (item.height/page.height*100)+'%' }; }
  function continueReview() { const next = { ...work, detections, manual }; saveWork(next); onContinue(next); }

  return <div className="page-enter">
    <div className="page-title-row"><div><div className="eyebrow page-eyebrow"><span className="live-dot"/>REVIEW DETECTIONS</div><h1>Does this look right?</h1><p>Review every page. Add a box anywhere OCR missed information.</p></div><div className="step-indicator"><span className="step-done"><Check size={13}/><small>Upload</small></span><i/><span className="step-active">02 <small>Review</small></span><i/><span>03 <small>Redact</small></span></div></div>
    <div className="editor-warning" role="note"><Shield size={17}/><span><strong>OCR may miss details.</strong> This preview shows selections only. Inspect small print, handwriting, images, and all pages yourself.</span></div>
    <div className="review-layout"><section className="review-image-panel">
      <div className="panel-heading"><span className="panel-step">02</span><div><h3>{work.kind==='pdf'?'Document review':'Image review'}</h3><p>{drawing?'Drag on the page to draw. Escape cancels.':'Drag a box to move it; use its corner to resize.'}</p></div><button className={'manual-toggle '+(drawing?'manual-on':'')} aria-pressed={drawing} onClick={()=>{pointer.current=null;setDraft(null);setDrawing(!drawing);}}>{drawing?<X size={14}/>:<Plus size={14}/ >}{drawing?'Cancel drawing':'Add a box'}</button></div>
      <div className="editor-toolbar" role="toolbar" aria-label="Redaction editor controls"><div className="editor-actions"><button className="button-secondary" onClick={()=>restore(history,redoHistory)} disabled={!history.current.length}>Undo</button><button className="button-secondary" onClick={()=>restore(redoHistory,history)} disabled={!redoHistory.current.length}>Redo</button><button className="button-secondary" onClick={()=>applyCategory('email')}>Select email</button><button className="button-secondary" onClick={()=>applyCategory('phone')}>Select phone</button><button className="button-secondary" onClick={()=>applyCategory('identifier')}>Select identifiers</button><button className="button-secondary" onClick={()=>applyAll(true)}>Select all</button><button className="button-secondary" onClick={()=>applyAll(false)}>Deselect all</button></div><div className="zoom-controls"><button className="button-secondary" aria-label="Zoom out" onClick={()=>setZoom((n)=>Math.max(.75,n-.25))}>-</button><span>{Math.round(zoom*100)}%</span><button className="button-secondary" aria-label="Zoom in" onClick={()=>setZoom((n)=>Math.min(2,n+.25))}>+</button><button className="button-secondary" onClick={()=>setZoom(1)}>Fit</button></div></div>
      {work.kind==='pdf'&&<div className="page-navigation"><button className="button-secondary" onClick={()=>setPageIndex((i)=>Math.max(0,i-1))} disabled={pageIndex===0}>Previous page</button><strong>Page {page.page} of {pages.length}</strong><button className="button-secondary" onClick={()=>setPageIndex((i)=>Math.min(pages.length-1,i+1))} disabled={pageIndex===pages.length-1}>Next page</button></div>}
      <div className="review-pages"><section className="review-page" key={page.page}><div className="review-page-heading">{work.kind==='pdf'?'Page '+page.page+' of '+pages.length:'Image'}</div><div className={'image-stage '+(drawing?'drawing-mode ':'')+(zoom>1?'editor-zoomed':'')}><div className="image-canvas" style={{aspectRatio:page.width+'/'+page.height,width:zoom===1?'min(100%, '+fitWidth+'px)':(fitWidth*zoom)+'px',maxWidth:zoom===1?'100%':'none'}} onPointerDown={beginDraw} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={()=>{pointer.current=null;setDraft(null);}}><img src={page.preview} alt={(work.kind==='pdf'?'PDF page '+page.page:'Image')+' being reviewed'} draggable="false"/>
        {current.map((item)=>{const visible=draft?.id===item.id?draft:item;const style=styleFor(visible);return item.type==='detection'?<button type="button" key={item.id} className={'detection-box '+item.category+' '+(item.selected?'box-selected':'box-unselected')} style={style} aria-label={(item.selected?'Selected ':'Unselected ')+(item.label||item.category)+' region'} aria-pressed={item.selected} onPointerDown={(event)=>beginEdit(event,item,'move')} onClick={()=>{if(dragged.current){dragged.current=false;return;}if(!drawing)toggle(item);}}><span className="box-label">{item.label}</span><span className="resize-handle" role="button" tabIndex="0" aria-label="Resize region" onPointerDown={(event)=>beginEdit(event,item,'resize')} onKeyDown={(event)=>keyboardResize(event,item)} onClick={(event)=>event.stopPropagation()}/></button>:<div key={item.id} className={'detection-box manual '+(item.selected?'box-selected':'box-unselected')} style={style} onPointerDown={(event)=>beginEdit(event,item,'move')}><span className="box-label">Manual selection</span><button type="button" className="remove-manual" aria-label="Remove manual selection" onPointerDown={(event)=>event.stopPropagation()} onClick={(event)=>{event.stopPropagation();remove(item);}}><X size={12}/></button><span className="resize-handle" role="button" tabIndex="0" aria-label="Resize manual selection" onPointerDown={(event)=>beginEdit(event,item,'resize')} onKeyDown={(event)=>keyboardResize(event,item)} onClick={(event)=>event.stopPropagation()}/></div>;})}
        {draft&&!draft.id&&draft.page===page.page&&<div className="detection-box manual draft-box" style={styleFor(draft)} aria-hidden="true"/>}</div></div><div className="page-dimensions">{page.width} x {page.height} px · {Math.round(zoom*100)}% view</div></section></div>
      <div className="image-legend"><span><i className="legend-dot email-dot"/>Email address</span><span><i className="legend-dot phone-dot"/>Phone number</span><span><i className="legend-dot identifier-dot"/>Identifier</span><span><i className="legend-dot manual-dot"/>Manual selection</span></div>
    </section><aside className="review-side">
      <div className={'risk-card risk-'+risk.level.toLowerCase()}><div className="risk-heading"><ShieldCheck size={17}/><strong>Before-redaction privacy estimate</strong><span className="risk-level">{risk.level} observed risk</span></div><p>{risk.estimateLabel}</p>{risk.contributingCategories.length?<ul>{risk.contributingCategories.map((row)=><li key={row.category}>{row.reason}</li>)}</ul>:<p className="risk-caution">{risk.noDetectionWarning}</p>}<ul className="risk-recommendations">{risk.recommendations.map((text,index)=><li key={index}>{text}</li>)}</ul>{!risk.coverageComplete&&<p className="risk-caution">OCR coverage is incomplete. Inspect unscanned pages manually.</p>}</div>
      <div className="review-summary"><div className="summary-top"><div><div className="eyebrow">YOUR REVIEW</div><h3>{selected.length} {selected.length===1?'region':'regions'} selected</h3></div><div className="selection-count"><Shield size={17}/>{selected.length}</div></div><p>Selected regions will be permanently covered in the output file.</p><div className="detection-list">{allItems.length===0?<div className="no-detections"><Sparkles size={17}/><strong>Nothing detected automatically.</strong><span>No matches does not mean the file is safe. Draw a box around anything you want to hide.</span></div>:allItems.map((item)=><div className="detection-row" key={item.id}><button className="detection-select" aria-pressed={item.selected} onClick={()=>toggle(item)}><span className={'detection-type '+item.category}><span/></span><span className="detection-copy"><strong>{item.label}{work.kind==='pdf'?' · p.'+item.page:''}</strong><small>{item.category==='manual'?'Added by you':item.x+', '+item.y+' · '+item.width+' x '+item.height+' px'}</small></span><span className={'selection-check '+(item.selected?'checked':'')}>{item.selected&&<Check size={12}/>}</span></button>{item.type==='manual'&&<button className="remove-from-list" onClick={()=>remove(item)} aria-label="Delete manual selection"><Trash2 size={14}/></button>}</div>)}</div><button className="button-primary review-continue" disabled={!selected.length} onClick={continueReview}>Review redaction<ArrowRight size={15}/></button><div className="permanent-note"><LockKeyhole size={13}/>Preview boxes are overlays; only the exported file is redacted.</div></div>
      <button className="text-back" onClick={onChooseFile}><ArrowLeft size={14}/>Choose a different file</button>
    </aside></div>
  </div>;
}
