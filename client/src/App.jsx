import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ArrowDownToLine, ArrowLeft, ArrowRight, BadgeCheck, Bell, Check, ChevronDown, CircleHelp, Clock3, CloudUpload, FileImage, FileText, Fingerprint, History as HistoryIcon, LayoutDashboard, LockKeyhole, LogOut, Menu, Plus, ScanLine, Shield, ShieldCheck, Sparkles, Trash2, Upload, UserRound, X } from 'lucide-react';
import { api, authRequest, getToken } from './api.js';
import { buildVerificationReport } from './verificationReport.js';
import RedactionEditor from './RedactionEditor.jsx';
import { scanImage, scanImages } from './ocr.js';
import { PDF_MAX_BYTES, PDF_MAX_PAGES } from './pdfLimits.js';
import { clearWork, getWork, saveWork } from './workStore.js';

function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('sharesafe_user')); } catch { return null; } });
  const [toast, setToast] = useState('');
  const navigate = useNavigate();
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 3600); return () => clearTimeout(id); }, [toast]);
  function signIn(data) { localStorage.setItem('sharesafe_token', data.token); localStorage.setItem('sharesafe_user', JSON.stringify(data.user)); setUser(data.user); navigate('/dashboard'); }
  function signOut() { clearWork(); localStorage.removeItem('sharesafe_token'); localStorage.removeItem('sharesafe_user'); setUser(null); navigate('/login'); }
  const notify = (message) => setToast(message);
  return <><Routes><Route path="/login" element={!user ? <AuthPage mode="login" onAuth={signIn} /> : <Navigate to="/dashboard" />} /><Route path="/register" element={!user ? <AuthPage mode="register" onAuth={signIn} /> : <Navigate to="/dashboard" />} /><Route path="*" element={user && getToken() ? <Shell user={user} signOut={signOut} notify={notify} /> : <Navigate to="/login" replace />} /></Routes>{toast && <div className="toast"><BadgeCheck size={18} />{toast}<button onClick={() => setToast('')}><X size={15} /></button></div>}</>;
}

function AuthPage({ mode, onAuth }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const register = mode === 'register';
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); const form = new FormData(event.currentTarget); try { const data = await authRequest(register ? 'register' : 'login', Object.fromEntries(form)); onAuth(data); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  return <main className="auth-screen"><div className="auth-aside"><div className="brand"><span className="brand-icon"><Shield size={20} /></span><span>share<span className="brand-light">safe</span></span></div><div className="aside-content"><div className="eyebrow"><span className="live-dot" />PRIVACY, IN YOUR HANDS</div><h1>Your information<br />belongs to <em>you.</em></h1><p>Find personal details in your images. Choose exactly what to hide. Share the rest with confidence.</p><div className="aside-visual"><div className="visual-image"><div className="portrait-placeholder"><UserRound size={66} /></div><div className="scan-line" /><div className="blur-box box-one" /><div className="blur-box box-two" /><div className="corner c1"/><div className="corner c2"/><div className="corner c3"/><div className="corner c4"/></div><div className="visual-label"><span className="live-dot"/>LOCAL OCR · PRIVATE BY DESIGN</div><div className="visual-shield"><LockKeyhole size={17}/></div></div><div className="assurance"><span><Check size={14}/>No files retained</span><span><Check size={14}/>OCR runs locally</span><span><Check size={14}/>You stay in control</span></div></div><div className="aside-foot">PRIVACY SHOULD BE THE DEFAULT.</div></div><section className="auth-main"><div className="auth-mobile-brand"><span className="brand-icon"><Shield size={18}/></span>sharesafe</div><div className="auth-card"><div className="auth-topline">{register ? 'GET STARTED' : 'WELCOME BACK'}</div><h2>{register ? 'Create your account' : 'Good to see you again.'}</h2><p className="auth-sub">{register ? 'A little more privacy starts here.' : 'Your privacy workspace is ready.'}</p><form onSubmit={submit} className="auth-form">{register && <label>Full name<div className="input-wrap"><UserRound size={16}/><input required name="name" minLength="2" maxLength="80" autoComplete="name" placeholder="Jamie Morgan"/></div></label>}<label>Email address<div className="input-wrap"><span className="input-at">@</span><input required type="email" name="email" maxLength="254" autoComplete="email" placeholder="you@example.com"/></div></label><label>Password<div className="input-wrap"><LockKeyhole size={16}/><input required type="password" name="password" minLength={register ? 8 : 1} maxLength="72" autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? 'At least 8 characters' : 'Enter your password'}/></div></label>{error && <div className="form-error">{error}</div>}<button className="button-primary auth-submit" disabled={busy}>{busy ? 'One moment…' : register ? 'Create account' : 'Sign in'}<ArrowRight size={16}/></button></form><div className="auth-switch">{register ? 'Already have an account?' : 'New to ShareSafe?'} <a href={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</a></div><div className="auth-privacy"><LockKeyhole size={14}/>{register ? 'Your account details are protected with secure encryption.' : 'Your information stays yours. Always.'}</div></div><div className="auth-copyright">© 2026 ShareSafe · A more thoughtful way to share.</div></section></main>;
}

function Shell({ user, signOut, notify }) {
  const [mobileOpen, setMobileOpen] = useState(false); const location = useLocation();
  const active = location.pathname.startsWith('/history') ? 'history' : location.pathname.startsWith('/scan') || location.pathname.startsWith('/review') || location.pathname.startsWith('/result') ? 'scan' : 'dashboard';
  const links = [{ id: 'dashboard', label: 'Overview', icon: LayoutDashboard, to: '/dashboard' }, { id: 'scan', label: 'New scan', icon: ScanLine, to: '/scan' }, { id: 'history', label: 'Redaction history', icon: HistoryIcon, to: '/history' }];
  return <div className="app-shell"><aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}><div className="brand side-brand"><span className="brand-icon"><Shield size={19}/></span><span>share<span className="brand-light">safe</span></span><button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={17}/></button></div><div className="workspace-label">WORKSPACE</div><nav className="side-nav">{links.map(({ id, label, icon: Icon, to }) => <a key={id} href={to} onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', to); window.dispatchEvent(new PopStateEvent('popstate')); setMobileOpen(false); }} className={`nav-item ${active === id ? 'nav-active' : ''}`}><Icon size={18}/><span>{label}</span>{id === 'scan' && <span className="nav-plus"><Plus size={13}/></span>}</a>)}</nav><div className="sidebar-bottom"><div className="privacy-card"><div className="privacy-card-icon"><LockKeyhole size={16}/></div><div><strong>Your privacy matters</strong><p>OCR stays in your browser. Originals are never saved.</p></div><ShieldCheck size={16} className="privacy-shield"/></div><button className="user-row" onClick={signOut}><div className="avatar">{user.name?.slice(0,1).toUpperCase()}</div><div className="user-info"><strong>{user.name}</strong><span>{user.email}</span></div><LogOut size={16} className="logout-icon"/></button></div></aside>{mobileOpen && <button className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation"/>}<div className="main-wrap"><header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={19}/></button><div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{active === 'scan' ? 'New scan' : active === 'history' ? 'Redaction history' : 'Overview'}</strong></div><div className="top-actions"><span className="secure-badge"><LockKeyhole size={13}/>Privacy mode on</span><button className="icon-button" title="Help and privacy"><CircleHelp size={18}/></button><div className="top-avatar">{user.name?.slice(0,1).toUpperCase()}</div></div></header><main className="main-content"><Routes><Route path="/dashboard" element={<Dashboard user={user} notify={notify}/>} /><Route path="/scan" element={<Scanner notify={notify}/>} /><Route path="/review" element={<Review notify={notify}/>} /><Route path="/result" element={<Result/>}/><Route path="/history" element={<History/>}/><Route path="*" element={<Navigate to="/dashboard" replace/>}/></Routes></main><footer className="footer"><span>© 2026 ShareSafe · Designed for privacy.</span><span><LockKeyhole size={12}/>Your files are never stored.</span></footer></div></div>;
}

function Dashboard({ user, notify }) {
  const [records, setRecords] = useState([]); const [loading, setLoading] = useState(true);
  useEffect(() => { api('/api/history').then((r) => r.json()).then((d) => setRecords(d.history)).catch((e) => notify(e.message)).finally(() => setLoading(false)); }, []);
  const total = records.reduce((sum, item) => sum + Object.values(item.counts || {}).reduce((a,b) => a+b,0), 0);
  const categoryTotals = records.reduce((totals,item)=>{for(const [key,value] of Object.entries(item.counts||{}))totals[key]=(totals[key]||0)+value;return totals;},{});
  return <div className="page-enter"><div className="welcome-row"><div><div className="eyebrow page-eyebrow"><span className="live-dot"/>YOUR PRIVACY WORKSPACE</div><h1>Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user.name?.split(' ')[0]}<span className="greeting-dot">.</span></h1><p>Everything you need to share with a little more peace of mind.</p></div><a className="button-primary" href="/scan"><Plus size={17}/>New scan<ArrowRight size={15}/></a></div><div className="hero-panel"><div className="hero-copy"><div className="hero-pill"><Sparkles size={13}/>YOUR PRIVACY, PROTECTED</div><h2>Share the moment.<br/><em>Keep the details private.</em></h2><p>Find personal information in any image and permanently cover exactly what you choose.</p><a className="hero-link" href="/scan">Start a new scan <ArrowRight size={16}/></a><div className="hero-meta"><LockKeyhole size={13}/> Private by design <span>·</span> Images never stored</div></div><HeroGraphic/></div><div className="stat-grid"><StatCard icon={ScanLine} title="Files scanned" value={records.length} tone="mint" hint="Redaction sessions"/><StatCard icon={Fingerprint} title="Details protected" value={total} tone="lavender" hint="Information covered"/><StatCard icon={ShieldCheck} title="Privacy status" value="On" tone="peach" hint="Your data is private"/></div><div className="category-breakdown"><strong>Redactions by category</strong><div>{['email','phone','identifier','manual'].map((key)=><span key={key}>{key}: <b>{categoryTotals[key]||0}</b></span>)}</div></div><div className="section-head"><div><h3>Recent activity</h3><p>Your latest redaction sessions.</p></div><a href="/history" className="subtle-link">View history <ArrowRight size={14}/></a></div><div className="activity-card">{loading ? <div className="empty-state"><div className="spinner"/>Loading your activity…</div> : records.length === 0 ? <div className="empty-state"><div className="empty-icon"><FileImage size={21}/></div><strong>Your activity will live here</strong><p>Start with an image to see your redaction history.</p><a href="/scan" className="button-secondary"><ScanLine size={15}/>Start your first scan</a></div> : records.slice(0,4).map((row) => <div className="activity-row" key={row._id}><div className="activity-icon"><FileImage size={17}/></div><div className="activity-main"><strong>File redacted</strong><span>{new Date(row.createdAt).toLocaleString()}</span></div><span className="format-tag">{row.fileType.toUpperCase()}</span><span className="count-pill">{Object.values(row.counts).reduce((a,b)=>a+b,0)} covered</span><BadgeCheck size={17} className="verified-icon"/></div>)}</div></div>;
}
function StatCard({ icon: Icon, title, value, tone, hint }) { return <div className="stat-card"><div className="stat-top"><div className={`stat-icon ${tone}`}><Icon size={18}/></div><Activity size={16} className="stat-trend"/></div><div className="stat-value">{value}</div><div className="stat-title">{title}</div><div className="stat-hint">{hint}</div></div>; }
function HeroGraphic() { return <div className="hero-art"><div className="glow-orb orb-a"/><div className="glow-orb orb-b"/><div className="hero-image"><div className="hero-image-top"><span className="tiny-dot"/><span className="tiny-dot"/><span className="tiny-dot"/><span className="image-label">PERSONAL_IMAGE.JPG</span></div><div className="hero-image-body"><div className="mock-profile"><div className="mock-head"/><div className="mock-body"/></div><div className="mock-lines"><span/><span/><span/><span/></div><div className="redacted redacted-a"/><div className="redacted redacted-b"/><div className="redacted redacted-c"/><span className="match-tag"><ScanLine size={11}/>EMAIL FOUND</span></div></div><div className="mini-shield"><ShieldCheck size={23}/><span>Safely redacted</span><BadgeCheck size={14}/></div><div className="sparkle sparkle-a">✳</div><div className="sparkle sparkle-b">✦</div></div>; }

function Scanner({ notify }) {
  const inputRef = useRef();
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [metadataBusy, setMetadataBusy] = useState(false);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const isPdf = fileType === 'pdf';
  useEffect(() => {
    if (!file || isPdf) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isPdf]);
  useEffect(() => {
    if (!file) { setMetadata(null); return; }
    let cancelled = false;
    setMetadataBusy(true);
    import('./metadata.js').then((module) => isPdf ? module.inspectPdfMetadata(file) : module.inspectImageMetadata(file))
      .then((result) => { if (!cancelled) setMetadata(result); })
      .catch(() => { if (!cancelled) setMetadata({ complete: false, rows: [] }); })
      .finally(() => { if (!cancelled) setMetadataBusy(false); });
    return () => { cancelled = true; };
  }, [file, isPdf]);
  async function selectFile(candidate) {
    setError('');
    if (!candidate) return;
    const bytes = new Uint8Array(await candidate.slice(0, 12).arrayBuffer());
    const png = bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value);
    const jpeg = bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
    const pdf = new TextDecoder().decode(bytes.slice(0,5)) === '%PDF-';
    const type = pdf ? 'pdf' : png ? 'png' : jpeg ? 'jpeg' : '';
    const limit = type === 'pdf' ? PDF_MAX_BYTES : 10 * 1024 * 1024;
    if (!type) { setError('This file does not have a supported PNG, JPEG, or PDF signature.'); return; }
    if (candidate.size > limit) { setError(type === 'pdf' ? 'Choose a PDF smaller than 4 MB.' : 'Choose an image smaller than 10 MB.'); return; }
    clearWork();
    setMetadata(null);
    setFile(candidate);
    setFileType(type);
  }
  async function scan() {
    if (!file) return;
    setBusy(true); setError(''); setProgress(0);
    try {
      const metadataRows = (metadata?.rows || []).map(({ category, found, removalSupported }) => ({ category, found, removalSupported }));
      if (isPdf) {
        const { renderPdfPages } = await import('./pdf.js');
        const rendered = await renderPdfPages(file);
        const scanned = await scanImages(rendered.map((page) => page.blob), (fraction) => setProgress(Math.round(fraction * 100)));
        const pages = rendered.map(({ page, width, height, preview }) => ({ page, width, height, preview }));
        saveWork({ kind: 'pdf', inputFormat: 'pdf', name: file.name, file, pages, detections: scanned.flatMap((result) => result.detections), manual: [], metadataRows, metadataComplete: Boolean(metadata?.complete), pagesScanned: scanned.length });
      } else {
        const { width, height, detections } = await scanImage(file, setProgress);
        saveWork({ kind: 'image', inputFormat: fileType, image: await fileToDataUrl(file), name: file.name, width, height, detections: detections.map((detection) => ({ ...detection, page: 1 })), manual: [], metadataRows, metadataComplete: Boolean(metadata?.complete), pagesScanned: 1 });
      }
      window.history.pushState({}, '', '/review');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (e) {
      setError(e?.message || 'We couldn’t read this file. Try a clear PDF, PNG, or JPEG.');
    } finally { setBusy(false); }
  }
  return <div className="page-enter"><div className="page-title-row"><div><div className="eyebrow page-eyebrow"><span className="live-dot"/>PRIVATE SCAN</div><h1>Let’s take a closer look.</h1><p>Choose a file and we’ll look for personal details, right here in your browser.</p></div><div className="step-indicator"><span className="step-active">01 <small>Upload</small></span><i/><span>02 <small>Review</small></span><i/><span>03 <small>Redact</small></span></div></div><div className="scan-layout"><section className="upload-panel"><div className="panel-heading"><span className="panel-step">01</span><div><h3>Choose your document or image</h3><p>A sharp, clear file makes for a more careful scan.</p></div></div>{!file ? <button className="dropzone" onClick={() => inputRef.current?.click()} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{e.preventDefault();selectFile(e.dataTransfer.files[0]);}}><input ref={inputRef} type="file" accept="image/png,image/jpeg,application/pdf,.pdf" hidden onChange={(e)=>selectFile(e.target.files[0])}/><span className="upload-icon"><CloudUpload size={24}/></span><strong>Drop your file here, or <em>browse</em></strong><span>PDF · PNG · JPEG</span><span className="privacy-note"><LockKeyhole size={13}/>Your file stays in this browser until you choose to redact.</span></button> : <div className="selected-preview">{isPdf ? <div className="selected-pdf-preview"><FileText size={40}/><strong>PDF document</strong><span>{file.name}</span><small>{(file.size/1024/1024).toFixed(2)} MB · Ready to scan · up to {PDF_MAX_PAGES} pages</small></div> : <img src={preview} alt="Selected image preview"/>}<div className="selected-overlay"><div><strong>{file.name}</strong><span>{(file.size/1024/1024).toFixed(2)} MB · Ready to scan</span></div><button onClick={()=>{setFile(null);setFileType('');setMetadata(null);setError('');}} aria-label="Remove selected file"><Trash2 size={16}/></button></div></div>}{file && <MetadataSummary metadata={metadata} loading={metadataBusy}/>}{error && <div className="inline-error" role="alert">{error}</div>}<div className="upload-foot"><div><ShieldCheck size={15}/><span><strong>100% in your control</strong><small>Your original file is never saved to our servers.</small></span></div>{file && <button className="button-primary" onClick={scan} disabled={busy||metadataBusy}>{busy ? <><div className="button-spinner"/>Scanning {progress}%</> : metadataBusy ? 'Inspecting metadata…' : <><ScanLine size={16}/>Scan for details<ArrowRight size={14}/></>}</button>}</div></section><aside className="scan-aside"><div className="aside-lock"><div className="aside-lock-icon"><LockKeyhole size={18}/></div><span className="secure-label">PRIVATE BY DESIGN</span><h3>Your file stays yours.</h3><p>Optical character recognition runs locally in your browser. No text or file is uploaded during the scan.</p><div className="check-list"><span><Check size={14}/>OCR runs on this device</span><span><Check size={14}/>Your original isn’t stored</span><span><Check size={14}/>You choose what to hide</span></div></div><div className="support-note"><CircleHelp size={16}/><span><strong>A little tip</strong><br/>Use a clear, well-lit document with readable text for the best results.</span></div></aside></div><div className="format-note"><span className="format-icon"><FileText size={16}/></span><span><strong>PDF, PNG & JPEG supported</strong><small>PDFs are scanned locally and redacted into a flattened, image-only PDF. Up to {PDF_MAX_PAGES} pages and 4 MB.</small></span><BadgeCheck size={16}/></div></div>;
}
function MetadataSummary({ metadata, loading }) {
  return <section className="metadata-summary" aria-live="polite"><div className="metadata-summary-head"><strong>Local metadata inspection</strong><span>{loading?'Checking…':'Values stay hidden'}</span></div>{loading?<p>Checking supported privacy-related fields in your browser.</p>:!metadata?.complete?<p>Inspection was incomplete. Review metadata warnings after redaction.</p>:<><ul>{metadata.rows.map((row)=><li key={row.category}><span><strong>{row.category}</strong><small>{row.explanation}</small></span><span className={row.found?'metadata-found':'metadata-clear'}>{row.found?'Found':'Not found'}</span></li>)}</ul><p>Supported metadata is stripped during redaction and checked in the generated output. This does not make a file anonymous or completely safe.</p></>}</section>;
}
function fileToDataUrl(file) { return new Promise((resolve,reject)=>{const reader=new FileReader(); reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);}); }

function Review() {
  const navigate = useNavigate();
  const work = useMemo(getWork, []);
  if (!work) return <Navigate to="/scan" replace/>;
  return <RedactionEditor work={work} onContinue={() => navigate('/result')} onChooseFile={() => navigate('/scan')} />;
}

function Result() {
  const work = useMemo(getWork, []);
  const [busy, setBusy] = useState(false); const [url, setUrl] = useState(''); const [error, setError] = useState('');
  const [counts, setCounts] = useState({ email: 0, phone: 0, identifier: 0, manual: 0 }); const [report, setReport] = useState(null);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  if (!work) return <Navigate to="/scan" replace/>;
  const isPdf = work.kind === 'pdf';
  const selected = (work.detections || []).filter((item) => item.selected).length + (work.manual || []).filter((item) => item.selected).length;
  async function redact() {
    setBusy(true); setError('');
    const chosen = [...(work.detections || []).filter((item) => item.selected), ...(work.manual || []).filter((item) => item.selected)];
    const summary = { email: 0, phone: 0, identifier: 0, manual: 0 };
    chosen.forEach((item) => { summary[item.category] += 1; });
    const regions = chosen.map(({ category, x, y, width, height, page }) => ({ category, x, y, width, height, page: page || 1 }));
    const form = new FormData();
    if (isPdf) form.append('image', work.file, work.name);
    else form.append('image', await (await fetch(work.image)).blob(), work.name);
    form.append('regions', JSON.stringify(regions));
    try {
      const response = await api('/api/redact', { method: 'POST', body: form });
      if (response.headers.get('X-Redaction-Verified') !== 'true') throw new Error('The output could not be verified. Please try again.');
      const checks = (response.headers.get('X-Redaction-Checks') || '').split(',').filter(Boolean);
      const output = await response.blob();
      if (isPdf ? output.type !== 'application/pdf' : output.type !== 'image/png') throw new Error('The output format was not valid. Please try again.');
      const verificationReport = await buildVerificationReport({ work, counts: summary, output, checks });
      setUrl(URL.createObjectURL(output)); setCounts(summary); setReport(verificationReport);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const fileLabel = isPdf ? 'PDF' : 'PNG';
  return <div className="page-enter"><div className="page-title-row"><div><div className="eyebrow page-eyebrow"><span className="live-dot"/>FINAL STEP</div><h1>Your privacy, your call.</h1><p>One last look before we create the redacted {fileLabel.toLowerCase()}.</p></div><div className="step-indicator"><span className="step-done"><Check size={13}/><small>Upload</small></span><i/><span className="step-done"><Check size={13}/><small>Review</small></span><i/><span className="step-active">03 <small>Redact</small></span></div></div>{!url?<div className="result-layout"><div className="final-image-card"><div className="final-image-head"><div><h3>{isPdf?'PDF page previews':'Image preview'}</h3><p>{work.name}{isPdf?` · ${work.pages.length} pages`:''}</p></div><span className="format-tag">{isPdf?'PDF':'PNG'}</span></div><div className={`final-preview ${isPdf?'final-preview-pages':''}`}>{isPdf ? work.pages.slice(0, 4).map((page)=><img key={page.page} src={page.preview} alt={`Original PDF page ${page.page}`}/>) : <img src={work.image} alt="Original image for final confirmation"/>}<span className="preview-badge"><Sparkles size={13}/>Ready to redact</span></div><div className="final-image-foot"><LockKeyhole size={14}/>Original file stays in this session only.</div></div><aside className="final-action-card"><div className="final-lock"><ShieldCheck size={22}/></div><div className="eyebrow">READY TO PROTECT</div><h3>{selected} selected {selected===1?'region':'regions'}</h3><p>ShareSafe will permanently cover selected areas and create a flattened, image-only {fileLabel}.</p><div className="category-summary">{['email','phone','identifier','manual'].filter((key)=>summaryCount(work,key)>0).map((key)=><div className="category-line" key={key}><span>{key==='email'?'Email addresses':key==='phone'?'Phone numbers':key==='identifier'?'Identifiers':'Manual selections'}</span><strong>{summaryCount(work,key)}</strong></div>)}</div>{error&&<div className="inline-error">{error}</div>}<button className="button-primary redact-button" onClick={redact} disabled={busy||selected===0}>{busy?<><div className="button-spinner"/>Redacting…</>:<><Shield size={16}/>Redact & create {fileLabel}<ArrowRight size={15}/></>}</button><button className="text-back centered" onClick={()=>{window.history.pushState({},'','/review');window.dispatchEvent(new PopStateEvent('popstate'));}}><ArrowLeft size={14}/>Back to review</button><div className="final-disclaimer"><LockKeyhole size={13}/>{isPdf?'The PDF was rebuilt from page images; text, annotations, attachments, and source metadata checks ran.':'The image was flattened and supported source metadata checks ran.'} OCR may miss details; review every page before sharing.</div></aside></div>:<div className="success-card"><div className="success-mark"><BadgeCheck size={30}/></div><div className="eyebrow">REDACTION COMPLETE</div><h2>Your {fileLabel.toLowerCase()} is ready to share.</h2><p>The selected areas were covered in a new flattened output. The checks below describe what the server verified; they do not prove that OCR found every sensitive detail.</p><div className={`success-preview ${isPdf?'success-pdf-preview':''}`}>{isPdf?<div className="pdf-output-link"><FileText size={38}/><strong>Flattened PDF is ready</strong><a href={url} target="_blank" rel="noreferrer">Open redacted PDF preview</a></div>:<img src={url} alt="Verified redacted image preview"/>}<div className="success-verified"><ShieldCheck size={14}/>{report?.postRedactionVerification.status==='verified'?'Server checks passed':'Verification incomplete'} · flattened output</div></div><div className="success-counts">{Object.entries(counts).filter(([,count])=>count).map(([key,count])=><span key={key}>{count} {key==='email'?'email':key==='phone'?'phone':key==='identifier'?'identifier':'manual'}{count>1?'s':''}</span>)}</div>{report&&<VerificationReportView report={report}/>}<a className="button-primary download-button" href={url} download={`sharesafe-redacted.${isPdf?'pdf':'png'}`}><ArrowDownToLine size={17}/>Download redacted {fileLabel}</a><button className="text-back centered" onClick={()=>{clearWork();window.history.pushState({},'','/scan');window.dispatchEvent(new PopStateEvent('popstate'));}}>Start another scan<ArrowRight size={14}/></button></div>}</div>;
}
function VerificationReportView({ report }) {
  function download() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'sharesafe-verification-report.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  return <section className="verification-report"><div className="verification-report-head"><ShieldCheck size={18}/><div><strong>Post-redaction verification: {report.postRedactionVerification.status}</strong><span>Output format and selected region counts recorded.</span></div></div><div className="verification-checks"><strong>Completed checks</strong>{report.postRedactionVerification.completedChecks.length?<ul>{report.postRedactionVerification.completedChecks.map((item)=><li key={item}><Check size={13}/>{item.replaceAll('-', ' ')}</li>)}</ul>:<p>No server verification checks were reported.</p>}<strong>Not verified automatically</strong><ul>{report.postRedactionVerification.notPerformedChecks.map((item,index)=><li key={index}>{item}</li>)}</ul></div><p className="report-hash"><strong>Output SHA-256</strong><code>{report.outputSha256}</code><small>{report.integrityHashNote}</small></p><p className="risk-caution">Human review is still required. A hash checks file integrity; it does not prove the output has no sensitive information.</p><button className="button-secondary report-download" onClick={download}>Download JSON report</button></section>;
}

function summaryCount(work, category) { return [...(work.detections || []), ...(work.manual || [])].filter((item) => item.selected && item.category === category).length; }

function History(){
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');
  const [format,setFormat]=useState('all');
  const [category,setCategory]=useState('all');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  useEffect(()=>{api('/api/history').then(r=>r.json()).then(d=>setRows(d.history)).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
  const filtered=rows.filter((row)=>{
    const localDate=new Date(row.createdAt);localDate.setMinutes(localDate.getMinutes()-localDate.getTimezoneOffset());const day=localDate.toISOString().slice(0,10);
    const categories=Object.keys(row.counts||{}).filter((key)=>row.counts[key]>0);
    const query=(search+' '+row.fileType+' '+categories.join(' ')).toLowerCase();
    return (format==='all'||row.fileType===format)&&(category==='all'||Boolean(row.counts?.[category]))&&(!from||day>=from)&&(!to||day<=to)&&(!search||query.includes(search.toLowerCase().trim()));
  });
  return <div className="page-enter"><div className="page-title-row"><div><div className="eyebrow page-eyebrow"><span className="live-dot"/>YOUR ACTIVITY</div><h1>Redaction history</h1><p>Search and filter the 100 most recent sessions for this account.</p></div><a className="button-primary" href="/scan"><Plus size={16}/>New scan</a></div>
    <div className="history-report"><div className="report-icon"><ShieldCheck size={20}/></div><div><strong>A private record, with only the essentials.</strong><p>This report stores file type, timestamp, and category counts. No files, text, or personal values are kept.</p></div><span className="report-badge"><LockKeyhole size={13}/>PRIVATE</span></div>
    <div className="history-card"><div className="history-table-head"><div><h3>Your sessions</h3><p>Up to 100 recent redactions.</p></div><span className="count-pill">{filtered.length} shown · {rows.length} total</span></div>
      <div className="history-filters"><label>Search<input type="search" value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Format or category"/></label><label>Format<select value={format} onChange={(event)=>setFormat(event.target.value)}><option value="all">All formats</option><option value="pdf">PDF</option><option value="png">PNG</option><option value="jpeg">JPEG</option></select></label><label>Category<select value={category} onChange={(event)=>setCategory(event.target.value)}><option value="all">All categories</option><option value="email">Email</option><option value="phone">Phone</option><option value="identifier">Identifier</option><option value="manual">Manual</option></select></label><label>From<input type="date" value={from} onChange={(event)=>setFrom(event.target.value)}/></label><label>To<input type="date" value={to} onChange={(event)=>setTo(event.target.value)}/></label></div>
      {error?<div className="empty-state"><strong>Couldn’t load history.</strong><p>{error}</p></div>:loading?<div className="empty-state"><div className="spinner"/>Loading your history…</div>:!filtered.length?<div className="empty-state"><div className="empty-icon"><Clock3 size={21}/></div><strong>{rows.length?'No sessions match those filters':'No redactions yet'}</strong><p>{rows.length?'Try different search or filter values.':'Once you redact a file, your session will appear here.'}</p>{rows.length>0?<button className="button-secondary" onClick={()=>{setSearch('');setFormat('all');setCategory('all');setFrom('');setTo('');}}>Clear filters</button>:<a className="button-secondary" href="/scan"><ScanLine size={15}/>Start a scan</a>}</div>:<div className="history-table">{filtered.map((row)=><div className="history-row" key={row._id}><div className="history-file-icon"><FileImage size={18}/></div><div className="history-main"><strong>Redacted file</strong><span>{new Date(row.createdAt).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})} · {new Date(row.createdAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</span></div><span className="format-tag">{row.fileType.toUpperCase()}</span><div className="history-categories">{Object.entries(row.counts||{}).filter(([,n])=>n).map(([key,count])=><span key={key}>{count} {key}</span>)}</div><span className="verified-history"><BadgeCheck size={15}/>Done</span></div>)}</div>}</div>
    <div className="privacy-report-foot"><LockKeyhole size={13}/>Only you can see this history. Originals and extracted text are never stored.</div></div>;
}

export default App;
