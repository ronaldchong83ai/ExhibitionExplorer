'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import jsQR from 'jsqr';
import { useRouter } from 'next/navigation';
import type { User, Exhibition, HomePageInfo, StageEvent, Exhibitor, Voucher, Product, PurchaseConversion } from '@/types';
import type { SessionUser } from '@/types';

// ============= ADMIN API CALLS =============
async function fetchData(url: string) {
  const res = await fetch(url);
  return res.json();
}
async function postData(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}
async function putData(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}
async function deleteData(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}

// ============= SECTION TYPE =============
type AdminSection =
  | 'exhibitions'
  | 'home-info'
  | 'stage-events'
  | 'exhibitors'
  | 'products'
  | 'venue-map'
  | 'vouchers'
  | 'analytics'
  | 'roles'
  | 'feedback';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [section, setSection] = useState<AdminSection>('exhibitions');
  const [selectedExhibition, setSelectedExhibition] = useState<string>('');
  const [selectedExhibitor, setSelectedExhibitor] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Data states
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [homeInfos, setHomeInfos] = useState<HomePageInfo[]>([]);
  const [stageEvents, setStageEvents] = useState<StageEvent[]>([]);
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [conversions, setConversions] = useState<PurchaseConversion[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [venueMap, setVenueMap] = useState<any>(null);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);

  // Sub-list manager states for Voucher requiredScanIds
  const [formScanIds, setFormScanIds] = useState<string[]>([]);
  const [newScanId, setNewScanId] = useState('');
  const [editingScanIdx, setEditingScanIdx] = useState<number | null>(null);
  const [editingScanVal, setEditingScanVal] = useState('');

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});

  // Voucher Collections Manager states
  const [showCollectionsModal, setShowCollectionsModal] = useState(false);
  const [activeVoucherForCollections, setActiveVoucherForCollections] = useState<Voucher | null>(null);
  const [collectedVisitors, setCollectedVisitors] = useState<any[]>([]);
  const [newVisitorEmail, setNewVisitorEmail] = useState('');
  const [collectionsLoading, setCollectionsLoading] = useState(false);

  // Scanner states & refs for Admin email scan popup
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const checkAuth = useCallback(async () => {
    const data = await fetchData('/api/auth/session');
    if (data.success && data.data.role === 'ADMIN') {
      setUser(data.data);
    } else {
      router.push('/home');
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sec = params.get('section') as AdminSection | null;
      if (sec && ['exhibitions', 'home-info', 'stage-events', 'exhibitors', 'products', 'venue-map', 'vouchers', 'analytics', 'roles', 'feedback'].includes(sec)) {
        setSection(sec);
      }
      const exhId = params.get('exhibitionId');
      if (exhId) {
        setSelectedExhibition(exhId);
      }
    }
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startScanner = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      setScanning(true);
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play().catch(e => console.error("Play failed:", e));
          
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          animationFrameRef.current = requestAnimationFrame(tick);
        }
      }, 100);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('Could not access camera. Please ensure permissions are granted and you are using HTTPS.');
    }
  };

  const stopScanner = () => {
    setScanning(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {}
  };

  const tick = () => {
    if (!videoRef.current || !canvasRef.current) {
      animationFrameRef.current = requestAnimationFrame(tick);
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          const scannedEmail = code.data.trim();
          stopScanner();
          playBeep();
          
          if (scannedEmail) {
            executeAddVisitor(scannedEmail);
          }
          return;
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(tick);
  };

  // 1. Fetch exhibitions (always load once user is logged in)
  useEffect(() => {
    if (!user) return;
    const loadExhibitions = async () => {
      setLoading(true);
      const d = await fetchData('/api/admin/exhibitions');
      if (d.success) setExhibitions(d.data);
      setLoading(false);
    };
    loadExhibitions();
  }, [user]);

  // 2. Fetch Home Page Info
  useEffect(() => {
    if (!user || section !== 'home-info' || !selectedExhibition) return;
    const loadHomeInfos = async () => {
      setLoading(true);
      const d = await fetchData(`/api/admin/home-info?exhibitionId=${selectedExhibition}`);
      if (d.success) setHomeInfos(d.data);
      setLoading(false);
    };
    loadHomeInfos();
  }, [section, selectedExhibition, user]);

  // 3. Fetch Stage Events
  useEffect(() => {
    if (!user || section !== 'stage-events' || !selectedExhibition) return;
    const loadStageEvents = async () => {
      setLoading(true);
      const d = await fetchData(`/api/admin/stage-events?exhibitionId=${selectedExhibition}`);
      if (d.success) setStageEvents(d.data);
      setLoading(false);
    };
    loadStageEvents();
  }, [section, selectedExhibition, user]);

  // 4. Fetch Exhibitors
  useEffect(() => {
    if (!user || section !== 'exhibitors' || !selectedExhibition) return;
    const loadExhibitors = async () => {
      setLoading(true);
      const d = await fetchData(`/api/admin/exhibitors?exhibitionId=${selectedExhibition}`);
      if (d.success) setExhibitors(d.data);
      setLoading(false);
    };
    loadExhibitors();
  }, [section, selectedExhibition, user]);

  // Fetch Venue Map
  useEffect(() => {
    if (!user || section !== 'venue-map' || !selectedExhibition) return;
    const loadVenueMap = async () => {
      setLoading(true);
      const d = await fetchData(`/api/venue-map?exhibitionId=${selectedExhibition}`);
      if (d.success) setVenueMap(d.data);
      setLoading(false);
    };
    loadVenueMap();
  }, [section, selectedExhibition, user]);

  // 5. Fetch Products
  useEffect(() => {
    if (!user || section !== 'products' || !selectedExhibitor) return;
    const loadProducts = async () => {
      setLoading(true);
      const d = await fetchData(`/api/admin/products?exhibitorId=${selectedExhibitor}`);
      if (d.success) {
        setProducts(d.data.products);
        setConversions(d.data.conversions);
      }
      setLoading(false);
    };
    loadProducts();
  }, [section, selectedExhibitor, user]);

  // 6. Fetch Vouchers
  useEffect(() => {
    if (!user || section !== 'vouchers' || !selectedExhibition) return;
    const loadVouchers = async () => {
      setLoading(true);
      const d = await fetchData(`/api/admin/vouchers?exhibitionId=${selectedExhibition}`);
      if (d.success) setVouchers(d.data);
      setLoading(false);
    };
    loadVouchers();
  }, [section, selectedExhibition, user]);

  // 7. Fetch Users (Roles)
  useEffect(() => {
    if (!user || section !== 'roles') return;
    const loadUsers = async () => {
      setLoading(true);
      const d = await fetchData('/api/admin/users');
      if (d.success) setUsers(d.data);
      setLoading(false);
    };
    loadUsers();
  }, [section, user]);

  // Fetch Feedback
  useEffect(() => {
    if (!user || section !== 'feedback' || !selectedExhibition) return;
    const loadFeedbacks = async () => {
      setLoading(true);
      const d = await fetchData(`/api/feedback?exhibitionId=${selectedExhibition}`);
      if (d.success) setFeedbacks(d.data);
      setLoading(false);
    };
    loadFeedbacks();
  }, [section, selectedExhibition, user]);

  const openForm = (id?: string, initialData?: Record<string, string>, requiredScanIdsArray?: string[]) => {
    setEditingId(id || null);
    setFormData(initialData || { enabled: 'true' });
    setFormScanIds(requiredScanIdsArray || []);
    setNewScanId('');
    setEditingScanIdx(null);
    setShowForm(true);
  };

  const handleFormChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const addScanId = () => {
    if (!newScanId.trim()) return;
    if (formScanIds.includes(newScanId.trim())) {
      alert('This Scan ID is already in the list.');
      return;
    }
    setFormScanIds(prev => [...prev, newScanId.trim()]);
    setNewScanId('');
  };

  const startScanIdEdit = (idx: number, val: string) => {
    setEditingScanIdx(idx);
    setEditingScanVal(val);
  };

  const saveScanIdEdit = (idx: number) => {
    if (!editingScanVal.trim()) return;
    setFormScanIds(prev => prev.map((s, i) => i === idx ? editingScanVal.trim() : s));
    setEditingScanIdx(null);
  };

  const deleteScanId = (idx: number) => {
    setFormScanIds(prev => prev.filter((_, i) => i !== idx));
  };

  const saveExhibition = async () => {
    const url = '/api/admin/exhibitions';
    const body = { ...formData, id: editingId, enabled: formData.enabled !== 'false' };
    const d = editingId ? await putData(url, body) : await postData(url, body);
    if (d.success) {
      setShowForm(false);
      const reload = await fetchData(url);
      if (reload.success) setExhibitions(reload.data);
    }
  };

  const saveHomeInfo = async () => {
    const body = { ...formData, id: editingId, exhibitionId: selectedExhibition };
    const d = editingId ? await putData('/api/admin/home-info', body) : await postData('/api/admin/home-info', body);
    if (d.success) {
      setShowForm(false);
      const reload = await fetchData(`/api/admin/home-info?exhibitionId=${selectedExhibition}`);
      if (reload.success) setHomeInfos(reload.data);
    }
  };

  const saveStageEvent = async () => {
    const body = { ...formData, id: editingId, exhibitionId: selectedExhibition, speakerNames: formData.speakerNames?.split(',').map(s => s.trim()) || [] };
    const d = editingId ? await putData('/api/admin/stage-events', body) : await postData('/api/admin/stage-events', body);
    if (d.success) {
      setShowForm(false);
      const reload = await fetchData(`/api/admin/stage-events?exhibitionId=${selectedExhibition}`);
      if (reload.success) setStageEvents(reload.data);
    }
  };

  const saveExhibitor = async () => {
    const body = { ...formData, id: editingId, exhibitionId: selectedExhibition };
    const d = editingId ? await putData('/api/admin/exhibitors', body) : await postData('/api/admin/exhibitors', body);
    if (d.success) {
      setShowForm(false);
      const reload = await fetchData(`/api/admin/exhibitors?exhibitionId=${selectedExhibition}`);
      if (reload.success) setExhibitors(reload.data);
    }
  };

  const saveVoucher = async () => {
    const body = { ...formData, id: editingId, exhibitionId: selectedExhibition, requiredScanIds: formScanIds };
    const d = editingId ? await putData('/api/admin/vouchers', body) : await postData('/api/admin/vouchers', body);
    if (d.success) {
      setShowForm(false);
      const reload = await fetchData(`/api/admin/vouchers?exhibitionId=${selectedExhibition}`);
      if (reload.success) setVouchers(reload.data);
    }
  };

  const openCollectionsManager = async (v: Voucher) => {
    setActiveVoucherForCollections(v);
    setShowCollectionsModal(true);
    setNewVisitorEmail('');
    setCollectionsLoading(true);
    try {
      const res = await fetchData(`/api/vouchers/${v.id}/collections`);
      if (res.success) {
        setCollectedVisitors(res.data || []);
      } else {
        alert(res.error || "Failed to load voucher collections");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load collections");
    } finally {
      setCollectionsLoading(false);
    }
  };

  const executeAddVisitor = async (emailStr: string) => {
    if (!activeVoucherForCollections || !emailStr) return;

    setCollectionsLoading(true);
    try {
      const res = await postData(`/api/vouchers/${activeVoucherForCollections.id}/collections`, {
        email: emailStr,
      });
      if (res.success && res.data) {
        setCollectedVisitors(prev => {
          if (prev.some(v => v.userId === res.data.userId)) return prev;
          return [res.data, ...prev];
        });
        setNewVisitorEmail('');
      } else {
        alert(res.error || "Failed to add visitor to collection");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add visitor");
    } finally {
      setCollectionsLoading(false);
    }
  };

  const addVisitorToCollections = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVoucherForCollections) return;

    const trimmedEmail = newVisitorEmail.trim();
    if (!trimmedEmail) {
      startScanner();
    } else {
      await executeAddVisitor(trimmedEmail);
    }
  };

  const deleteVisitorFromCollections = async (userId: string) => {
    if (!activeVoucherForCollections) return;
    if (!confirm("Are you sure you want to remove this visitor from the collected list?")) return;

    setCollectionsLoading(true);
    try {
      const res = await deleteData(`/api/vouchers/${activeVoucherForCollections.id}/collections?userId=${userId}`, {});
      if (res.success) {
        setCollectedVisitors(prev => prev.filter(v => v.userId !== userId));
      } else {
        alert(res.error || "Failed to delete collection");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to remove visitor");
    } finally {
      setCollectionsLoading(false);
    }
  };

  if (loading && !user) {
    return <div className="page-container"><div className="skeleton" style={{ height: 200 }} /></div>;
  }

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const MENU_ITEMS = [
    { key: 'exhibitions' as const, label: '📋 Exhibitions', needsExhibition: false },
    { key: 'home-info' as const, label: '🏠 Home Page Info', needsExhibition: true },
    { key: 'stage-events' as const, label: '🎭 Stage Events', needsExhibition: true },
    { key: 'exhibitors' as const, label: '🏢 Exhibitors', needsExhibition: true },
    { key: 'venue-map' as const, label: '🗺️ Venue Map', needsExhibition: true },
    { key: 'vouchers' as const, label: '🎫 Vouchers', needsExhibition: true },
    { key: 'analytics' as const, label: '📊 Analytics', needsExhibition: true },
    { key: 'feedback' as const, label: '💬 Feedback', needsExhibition: true },
    { key: 'roles' as const, label: '👤 Roles', needsExhibition: false },
  ];

  return (
    <div className="page-container" style={{ maxWidth: 640 }}>
      <h2 className="page-title">⚙️ Admin Panel</h2>

      {/* Navigation Menu */}
      <div className="admin-nav">
        {MENU_ITEMS.map(item => (
          <button
            key={item.key}
            className={`admin-nav-btn ${section === item.key ? 'active' : ''} ${item.needsExhibition && !selectedExhibition ? 'disabled' : ''}`}
            onClick={() => {
              if (item.needsExhibition && !selectedExhibition) return;
              setSection(item.key);
              setShowForm(false);
            }}
            disabled={item.needsExhibition && !selectedExhibition}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Exhibition Selector */}
      {section !== 'exhibitions' && section !== 'roles' && (
        <div className="exhibition-selector">
          <label className="form-label">Selected Exhibition:</label>
          <select
            className="form-input"
            value={selectedExhibition}
            onChange={e => { setSelectedExhibition(e.target.value); setSelectedExhibitor(''); }}
          >
            <option value="">Select an exhibition</option>
            {exhibitions.filter(ex => ex.enabled !== false).map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
          </select>
        </div>
      )}

      {/* ============= EXHIBITIONS ============= */}
      {section === 'exhibitions' && (
        <div className="admin-section animate-fade-in">
          <div className="section-header">
            <h3 className="section-title">Exhibitions</h3>
            <button className="btn btn-primary" onClick={() => openForm()}>+ Add</button>
          </div>
          {exhibitions.map(ex => (
            <div key={ex.id} className="admin-card card" onClick={() => { console.log("[Admin] Exhibition card clicked:", ex.id); setSelectedExhibition(ex.id); setSection('home-info'); }}>
              <div className="admin-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4>{ex.title}</h4>
                  {ex.enabled === false && <span className="badge badge-coral" style={{ fontSize: 'var(--font-size-xs)' }}>Disabled</span>}
                </div>
                <button className="btn btn-secondary" onClick={e => { e.stopPropagation(); openForm(ex.id, { title: ex.title, description: ex.description, eventPeriodFrom: ex.eventPeriodFrom?.split('T')[0] || '', eventPeriodTo: ex.eventPeriodTo?.split('T')[0] || '', details: ex.details || '', enabled: String(ex.enabled !== false) }); }}>Edit</button>
              </div>
              <p className="admin-card-desc">{ex.description}</p>
              <span className="admin-card-date">{new Date(ex.eventPeriodFrom).toLocaleDateString()} - {new Date(ex.eventPeriodTo).toLocaleDateString()}</span>
            </div>
          ))}
          {showForm && (
            <>
              <div className="modal-overlay" onClick={() => setShowForm(false)} />
              <div className="modal-content">
                <div className="modal-handle" />
                <div className="admin-form animate-scale-in" style={{ marginTop: 0 }}>
                  <h4>{editingId ? 'Edit' : 'Add'} Exhibition</h4>
                  <div className="form-group"><label className="form-label">Title</label><input className="form-input" value={formData.title || ''} onChange={e => handleFormChange('title', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={formData.description || ''} onChange={e => handleFormChange('description', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Event Period From</label><input className="form-input" type="date" value={formData.eventPeriodFrom || ''} onChange={e => handleFormChange('eventPeriodFrom', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Event Period To</label><input className="form-input" type="date" value={formData.eventPeriodTo || ''} onChange={e => handleFormChange('eventPeriodTo', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Details</label><textarea className="form-textarea" value={formData.details || ''} onChange={e => handleFormChange('details', e.target.value)} /></div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
                    <input 
                      type="checkbox" 
                      id="exhibition-enabled"
                      checked={formData.enabled === 'true'} 
                      onChange={e => handleFormChange('enabled', String(e.target.checked))} 
                      style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    />
                    <label className="form-label" htmlFor="exhibition-enabled" style={{ margin: 0, cursor: 'pointer' }}>Enabled (Selectable by Visitors)</label>
                  </div>
                  <div className="form-actions">
                    <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={saveExhibition}>Save</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ============= HOME INFO ============= */}
      {section === 'home-info' && selectedExhibition && (
        <div className="admin-section animate-fade-in">
          <div className="section-header">
            <h3 className="section-title">Home Page Info</h3>
            <button className="btn btn-primary" onClick={() => openForm()}>+ Add</button>
          </div>
          {homeInfos.map(info => (
            <div key={info.id} className="admin-card card">
              <div className="admin-card-header">
                <div>
                  <span className={`badge ${info.type === 'EVENT_INFO' ? 'badge-blue' : info.type === 'ANNOUNCEMENT' ? 'badge-purple' : 'badge-coral'}`}>{info.type.replace('_', ' ')}</span>
                  <h4 style={{marginTop: 8}}>{info.title}</h4>
                </div>
                <button className="btn btn-secondary" onClick={() => { openForm(info.id, { title: info.title, type: info.type, description: info.description || '', displayFrom: info.displayFrom?.split('T')[0] || '', displayTo: info.displayTo?.split('T')[0] || '', details: info.details || '' }); }}>Edit</button>
              </div>
              <p className="admin-card-desc">{info.description}</p>
            </div>
          ))}
          {showForm && (
            <>
              <div className="modal-overlay" onClick={() => setShowForm(false)} />
              <div className="modal-content">
                <div className="modal-handle" />
                <div className="admin-form animate-scale-in" style={{ marginTop: 0 }}>
                  <h4>{editingId ? 'Edit' : 'Add'} Home Info</h4>
                  <div className="form-group"><label className="form-label">Title</label><input className="form-input" value={formData.title || ''} onChange={e => handleFormChange('title', e.target.value)} /></div>
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select className="form-input" value={formData.type || 'EVENT_INFO'} onChange={e => handleFormChange('type', e.target.value)}>
                      <option value="EVENT_INFO">Event Info</option>
                      <option value="ANNOUNCEMENT">Announcement</option>
                      <option value="IMPORTANT_NOTICE">Important Notice</option>
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={formData.description || ''} onChange={e => handleFormChange('description', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Display From</label><input className="form-input" type="date" value={formData.displayFrom || ''} onChange={e => handleFormChange('displayFrom', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Display To</label><input className="form-input" type="date" value={formData.displayTo || ''} onChange={e => handleFormChange('displayTo', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Details</label><textarea className="form-textarea" value={formData.details || ''} onChange={e => handleFormChange('details', e.target.value)} /></div>
                  <div className="form-actions">
                    <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={saveHomeInfo}>Save</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ============= STAGE EVENTS ============= */}
      {section === 'stage-events' && selectedExhibition && (
        <div className="admin-section animate-fade-in">
          <div className="section-header">
            <h3 className="section-title">Stage Events</h3>
            <button className="btn btn-primary" onClick={() => openForm()}>+ Add</button>
          </div>
          {stageEvents.map(ev => (
            <div key={ev.id} className="admin-card card">
              <div className="admin-card-header">
                <h4>{ev.title}</h4>
                <button className="btn btn-secondary" onClick={() => { openForm(ev.id, { title: ev.title, periodFrom: ev.periodFrom?.substring(0, 16) || '', periodTo: ev.periodTo?.substring(0, 16) || '', stageNumber: ev.stageNumber || '', speakerNames: ev.speakerNames.join(', '), details: ev.details || '' }); }}>Edit</button>
              </div>
              <p className="admin-card-desc">{ev.stageNumber} · {ev.speakerNames.join(', ')}</p>
            </div>
          ))}
          {showForm && (
            <>
              <div className="modal-overlay" onClick={() => setShowForm(false)} />
              <div className="modal-content">
                <div className="modal-handle" />
                <div className="admin-form animate-scale-in" style={{ marginTop: 0 }}>
                  <h4>{editingId ? 'Edit' : 'Add'} Stage Event</h4>
                  <div className="form-group"><label className="form-label">Title</label><input className="form-input" value={formData.title || ''} onChange={e => handleFormChange('title', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Period From</label><input className="form-input" type="datetime-local" value={formData.periodFrom || ''} onChange={e => handleFormChange('periodFrom', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Period To</label><input className="form-input" type="datetime-local" value={formData.periodTo || ''} onChange={e => handleFormChange('periodTo', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Stage Number</label><input className="form-input" value={formData.stageNumber || ''} onChange={e => handleFormChange('stageNumber', e.target.value)} placeholder="e.g., Main Stage" /></div>
                  <div className="form-group"><label className="form-label">Speaker Names (comma separated)</label><input className="form-input" value={formData.speakerNames || ''} onChange={e => handleFormChange('speakerNames', e.target.value)} placeholder="Speaker 1, Speaker 2" /></div>
                  <div className="form-group"><label className="form-label">Details</label><textarea className="form-textarea" value={formData.details || ''} onChange={e => handleFormChange('details', e.target.value)} /></div>
                  <div className="form-actions">
                    <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={saveStageEvent}>Save</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ============= EXHIBITORS ============= */}
      {section === 'exhibitors' && selectedExhibition && (
        <div className="admin-section animate-fade-in">
          <div className="section-header">
            <h3 className="section-title">Exhibitors</h3>
            <button className="btn btn-primary" onClick={() => openForm()}>+ Add</button>
          </div>
          {exhibitors.map(ex => (
            <div 
              key={ex.id} 
              className="admin-card card card-interactive animate-scale-in" 
              onClick={() => router.push(`/exhibitors/${ex.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <div className="admin-card-header">
                <h4>{ex.name} <span className="badge badge-green">Booth {ex.boothNumber}</span></h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      openForm(ex.id, { name: ex.name, description: ex.description || '', boothNumber: ex.boothNumber || '', details: ex.details || '' }); 
                    }}
                  >
                    Edit
                  </button>
                </div>
              </div>
              <p className="admin-card-desc">{ex.description}</p>
            </div>
          ))}
          {showForm && (
            <>
              <div className="modal-overlay" onClick={() => setShowForm(false)} />
              <div className="modal-content">
                <div className="modal-handle" />
                <div className="admin-form animate-scale-in" style={{ marginTop: 0 }}>
                  <h4>{editingId ? 'Edit' : 'Add'} Exhibitor</h4>
                  <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={formData.name || ''} onChange={e => handleFormChange('name', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={formData.description || ''} onChange={e => handleFormChange('description', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Booth Number</label><input className="form-input" value={formData.boothNumber || ''} onChange={e => handleFormChange('boothNumber', e.target.value)} placeholder="e.g., A-101" /></div>
                  <div className="form-group"><label className="form-label">Details</label><textarea className="form-textarea" value={formData.details || ''} onChange={e => handleFormChange('details', e.target.value)} /></div>
                  <div className="form-actions">
                    <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={saveExhibitor}>Save</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ============= PRODUCTS ============= */}
      {section === 'products' && selectedExhibitor && (
        <div className="admin-section animate-fade-in">
          <div className="section-header">
            <h3 className="section-title">Products</h3>
            <button className="btn btn-secondary" onClick={() => setSection('exhibitors')}>← Back</button>
          </div>
          {products.map(p => (
            <div key={p.id} className="admin-card card">
              <h4>{p.title}</h4>
              <p className="admin-card-desc">{p.description}</p>
              {conversions.filter(c => c.productId === p.id).length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <span className="badge badge-amber">Conversions:</span>
                  {conversions.filter(c => c.productId === p.id).map(c => (
                    <span key={c.id} className="chip" style={{ marginLeft: 4 }}>{c.date}: {c.value}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ============= VENUE MAP ============= */}
      {section === 'venue-map' && selectedExhibition && (
        <div className="admin-section animate-fade-in">
          <h3 className="section-title">Venue Map</h3>
          <div className="admin-card card" style={{ padding: 'var(--space-5)' }}>
            <p className="admin-card-desc" style={{ marginBottom: 'var(--space-4)' }}>Upload the floor plan or map image for this exhibition.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const base64String = reader.result as string;
                      setLoading(true);
                      try {
                        const res = await fetch('/api/venue-map', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ exhibitionId: selectedExhibition, imageUrl: base64String }),
                        });
                        const d = await res.json();
                        if (d.success) {
                          setVenueMap(d.data);
                        } else {
                          alert(d.error || 'Failed to save venue map');
                        }
                      } catch (err) {
                        console.error('Error saving map:', err);
                      } finally {
                        setLoading(false);
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                style={{ display: 'none' }}
                id="venue-map-upload-input"
              />
              <label 
                htmlFor="venue-map-upload-input" 
                className="btn btn-primary" 
                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                📤 Choose Map Image
              </label>

              {venueMap?.imageUrl ? (
                <div style={{ width: '100%', maxWidth: '500px', marginTop: '10px', textAlign: 'center' }}>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>
                    Uploaded at: {new Date(venueMap.uploadedAt).toLocaleString()}
                  </p>
                  <img
                    src={venueMap.imageUrl}
                    alt="Venue Map Preview"
                    style={{ width: '100%', height: 'auto', maxHeight: '400px', objectFit: 'contain', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                  />
                </div>
              ) : (
                <div style={{ width: '100%', padding: '40px 20px', border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                  No map uploaded yet for this exhibition. Click button above to choose and upload a map.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============= VOUCHERS ============= */}
      {section === 'vouchers' && selectedExhibition && (
        <div className="admin-section animate-fade-in">
          <div className="section-header">
            <h3 className="section-title">Vouchers</h3>
            <button className="btn btn-primary" onClick={() => openForm(undefined, undefined, [])}>+ Add</button>
          </div>
          {vouchers.map(v => (
            <div key={v.id} className="admin-card card">
              <div className="admin-card-header">
                <h4>{v.title}</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" onClick={() => openCollectionsManager(v)}>Manage</button>
                  <button className="btn btn-secondary" onClick={() => { openForm(v.id, { title: v.title, description: v.description || '', details: v.details || '' }, v.requiredScanIds); }}>Edit</button>
                </div>
              </div>
              <p className="admin-card-desc">{v.description}</p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 4 }}>Required scans: {v.requiredScanIds.join(', ')}</p>
            </div>
          ))}
          {showCollectionsModal && activeVoucherForCollections && (
            <>
              <div className="modal-overlay" onClick={() => setShowCollectionsModal(false)} />
              <div className="modal-content">
                <div className="modal-handle" />
                <div className="admin-form animate-scale-in" style={{ marginTop: 0 }}>
                  <h4>Manage Collections: {activeVoucherForCollections.title}</h4>
                  
                  {/* Add Visitor Form */}
                  <form onSubmit={addVisitorToCollections} style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-4)' }}>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="Enter visitor's email..."
                      value={newVisitorEmail}
                      onChange={e => setNewVisitorEmail(e.target.value)}
                      style={{ flex: 1 }}
                      disabled={collectionsLoading}
                    />
                    <button className="btn btn-primary" type="submit" disabled={collectionsLoading}>
                      Add
                    </button>
                  </form>

                  {/* Collections List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Collected Visitors ({collectedVisitors.length})</label>
                    {collectionsLoading && collectedVisitors.length === 0 ? (
                      <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textAlign: 'center', margin: '12px 0' }}>Loading...</p>
                    ) : collectedVisitors.length === 0 ? (
                      <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textAlign: 'center', margin: '12px 0', fontStyle: 'italic' }}>No visitors have collected this voucher yet.</p>
                    ) : (
                      collectedVisitors.map(visitor => (
                        <div key={visitor.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 12px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{visitor.name}</span>
                            <span style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{visitor.email}</span>
                          </div>
                          <button
                            className="btn btn-icon"
                            type="button"
                            onClick={() => deleteVisitorFromCollections(visitor.userId)}
                            disabled={collectionsLoading}
                            style={{ background: 'rgba(255, 107, 107, 0.1)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-sm)', color: 'var(--color-accent-coral)', fontSize: '12px', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="form-actions" style={{ marginTop: 'var(--space-4)' }}>
                    <button className="btn btn-secondary" type="button" onClick={() => setShowCollectionsModal(false)}>Close</button>
                  </div>
                </div>
              </div>
            </>
          )}

          {scanning && (
            <>
              <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={stopScanner} />
              <div className="modal-content" style={{ zIndex: 1101, maxWidth: '360px' }}>
                <div className="modal-handle" />
                <div className="admin-form animate-scale-in" style={{ marginTop: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <h4 style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', marginBottom: 'var(--space-3)', alignSelf: 'flex-start' }}>
                    📷 Scan Visitor QR Code
                  </h4>
                  
                  {cameraError && (
                    <div className="error-banner animate-fade-in" style={{ marginBottom: 'var(--space-4)', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', color: 'rgb(248, 113, 113)', fontSize: 'var(--font-size-sm)' }}>
                      ⚠️ {cameraError}
                    </div>
                  )}

                  <div className="camera-preview" style={{ margin: 'var(--space-2) auto var(--space-4) auto' }}>
                    <video
                      ref={videoRef}
                      className="camera-video"
                      playsInline
                    />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <div className="scan-frame">
                      <div className="scan-corner tl" />
                      <div className="scan-corner tr" />
                      <div className="scan-corner bl" />
                      <div className="scan-corner br" />
                      <div className="scan-line" />
                    </div>
                  </div>

                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-4)' }}>
                    Align the visitor's profile QR code inside the frame to scan.
                  </p>

                  <button className="btn btn-secondary btn-full" onClick={stopScanner}>
                    Cancel
                  </button>
                </div>
              </div>
            </>
          )}
          {showForm && (
            <>
              <div className="modal-overlay" onClick={() => setShowForm(false)} />
              <div className="modal-content">
                <div className="modal-handle" />
                <div className="admin-form animate-scale-in" style={{ marginTop: 0 }}>
                  <h4>{editingId ? 'Edit' : 'Add'} Voucher</h4>
                  <div className="form-group"><label className="form-label">Title</label><input className="form-input" value={formData.title || ''} onChange={e => handleFormChange('title', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={formData.description || ''} onChange={e => handleFormChange('description', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Details</label><textarea className="form-textarea" value={formData.details || ''} onChange={e => handleFormChange('details', e.target.value)} /></div>
                  
                  <div className="form-group" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: 'var(--space-4)' }}>
                    <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>Required Scan IDs List</label>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', margin: '0 0 var(--space-1) 0' }}>Visitor must scan all these items to unlock the voucher.</p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {formScanIds.length === 0 ? (
                        <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', margin: '4px 0', fontStyle: 'italic' }}>No Scan IDs added yet.</p>
                      ) : (
                        formScanIds.map((sid, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {editingScanIdx === idx ? (
                              <>
                                <input
                                  className="form-input"
                                  value={editingScanVal}
                                  onChange={e => setEditingScanVal(e.target.value)}
                                  style={{ flex: 1, padding: '4px 8px', fontSize: 'var(--font-size-sm)' }}
                                />
                                <button className="btn btn-primary" type="button" onClick={() => saveScanIdEdit(idx)} style={{ padding: '6px 10px', fontSize: 'var(--font-size-xs)', height: 'auto' }}>Save</button>
                                <button className="btn btn-secondary" type="button" onClick={() => setEditingScanIdx(null)} style={{ padding: '6px 10px', fontSize: 'var(--font-size-xs)', height: 'auto' }}>Cancel</button>
                              </>
                            ) : (
                              <>
                                <span className="chip" style={{ flex: 1, padding: '6px 12px', fontSize: 'var(--font-size-sm)', background: 'var(--color-bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>{sid}</span>
                                <button className="btn btn-secondary" type="button" onClick={() => startScanIdEdit(idx, sid)} style={{ padding: '4px 10px', fontSize: 'var(--font-size-xs)', height: 'auto' }}>Edit</button>
                                <button className="btn btn-icon" type="button" onClick={() => deleteScanId(idx)} style={{ background: 'rgba(255, 107, 107, 0.1)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-sm)', color: 'var(--color-accent-coral)', fontSize: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px' }}>
                                  ✕
                                </button>
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <input
                        className="form-input"
                        placeholder="e.g. scan-fc-1"
                        value={newScanId}
                        onChange={e => setNewScanId(e.target.value)}
                        style={{ flex: 1, padding: '6px 10px', fontSize: 'var(--font-size-sm)' }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addScanId(); } }}
                      />
                      <button className="btn btn-primary" type="button" onClick={addScanId} style={{ padding: '6px 14px', fontSize: 'var(--font-size-xs)', height: 'auto' }}>Add</button>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={saveVoucher}>Save</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ============= ANALYTICS ============= */}
      {section === 'analytics' && selectedExhibition && (
        <div className="admin-section animate-fade-in">
          <h3 className="section-title">📊 Analytics</h3>
          <div className="analytics-grid">
            <div className="admin-card card">
              <h4>🎫 Redemption Rate</h4>
              <p className="admin-card-desc">Voucher redemption statistics</p>
              <div className="chart-placeholder">
                <div className="chart-bar" style={{ height: '60%', background: 'var(--gradient-primary)' }}><span>Hello Kitty</span></div>
                <div className="chart-bar" style={{ height: '30%', background: 'var(--gradient-warm)' }}><span>Food Court</span></div>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textAlign: 'center', marginTop: 8 }}>Chart.js integration planned</p>
            </div>
            <div className="admin-card card">
              <h4>📈 Purchase Conversion</h4>
              <p className="admin-card-desc">Sales per exhibitor per day</p>
              <div className="chart-placeholder">
                <div className="chart-bar" style={{ height: '80%', background: 'var(--gradient-cool)' }}><span>Sep 15</span></div>
                <div className="chart-bar" style={{ height: '50%', background: 'var(--gradient-cool)' }}><span>Sep 16</span></div>
                <div className="chart-bar" style={{ height: '90%', background: 'var(--gradient-cool)' }}><span>Sep 17</span></div>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textAlign: 'center', marginTop: 8 }}>Chart.js integration planned</p>
            </div>
          </div>
        </div>
      )}
      {section === 'roles' && (
        <div className="admin-section animate-fade-in">
          <div className="section-header">
            <h3 className="section-title">👤 Manage Roles</h3>
          </div>

          <div className="search-wrapper" style={{ marginBottom: 'var(--space-4)', position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '12px', color: 'var(--color-text-tertiary)' }}>🔍</span>
            <input
              className="form-input"
              placeholder="Search users by name or email..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              style={{ paddingLeft: '36px', width: '100%' }}
            />
          </div>

          <div className="user-list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {filteredUsers.length === 0 ? (
              <p style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: 'var(--space-4)' }}>No users found</p>
            ) : (
              filteredUsers.map(u => (
                <div key={u.id} className="admin-card card" style={{ padding: 'var(--space-4)', cursor: 'default' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h4 style={{ margin: 0, fontWeight: 600, fontSize: 'var(--font-size-base)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</h4>
                      <p style={{ margin: '4px 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>Contact: {u.contact}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                      <span className={`badge ${u.role === 'ADMIN' ? 'badge-blue' : u.role === 'EXHIBITOR' ? 'badge-purple' : u.role === 'REDEMPTOR' ? 'badge-amber' : 'badge-green'}`} style={{ fontSize: 'var(--font-size-xs)' }}>
                        {u.role}
                      </span>
                      <select
                        className="form-input"
                        value={u.role}
                        onChange={async (e) => {
                          const newRole = e.target.value;
                          const res = await putData('/api/admin/users', { userId: u.id, role: newRole });
                          if (res.success) {
                            setUsers(prev => prev.map(usr => usr.id === u.id ? { ...usr, role: newRole as any } : usr));
                          } else {
                            alert(res.error || "Failed to update role");
                          }
                        }}
                        style={{ padding: '4px 8px', fontSize: 'var(--font-size-sm)', minWidth: '110px', height: 'auto', background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
                        disabled={u.id === user?.id}
                      >
                        <option value="VISITOR">Visitor</option>
                        <option value="EXHIBITOR">Exhibitor</option>
                        <option value="REDEMPTOR">Redemptor</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {section === 'feedback' && (
        <div className="admin-section animate-fade-in">
          <div className="section-header">
            <h3 className="section-title">💬 Visitor Feedback</h3>
          </div>
          <div className="feedback-list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {feedbacks.length === 0 ? (
              <p style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: 'var(--space-4)' }}>No feedback submissions yet.</p>
            ) : (
              feedbacks.map((fb: any) => (
                <div key={fb.id} className="admin-card card" style={{ cursor: 'default' }}>
                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div className="sidebar-avatar" style={{ width: '36px', height: '36px', fontSize: 'var(--font-size-base)', borderRadius: 'var(--radius-full)', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: 'white', flexShrink: 0 }}>
                      {fb.userName ? fb.userName.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '4px' }}>
                        <h4 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 600 }}>{fb.userName}</h4>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                          {new Date(fb.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p style={{ margin: '2px 0 8px 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{fb.userEmail}</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {fb.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .admin-nav {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          margin-bottom: var(--space-5);
        }
        .admin-nav-btn {
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          font-weight: 500;
          background: var(--color-bg-glass);
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          transition: all var(--transition-fast);
        }
        .admin-nav-btn.active {
          background: var(--color-accent-blue);
          color: white;
          border-color: var(--color-accent-blue);
        }
        .admin-nav-btn.disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .exhibition-selector {
          margin-bottom: var(--space-5);
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-4);
        }
        .admin-card {
          padding: var(--space-4) !important;
          margin-bottom: var(--space-3);
          cursor: pointer;
        }
        .admin-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-3);
          margin-bottom: var(--space-2);
        }
        .admin-card-header h4 {
          font-size: var(--font-size-base);
          font-weight: 600;
        }
        .admin-card-desc {
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
        }
        .admin-card-date {
          font-size: var(--font-size-xs);
          color: var(--color-text-tertiary);
        }
        .admin-form {
          padding: var(--space-5) !important;
          margin-top: var(--space-4);
          border: 1px solid var(--color-border-accent);
        }
        .admin-form h4 {
          margin-bottom: var(--space-4);
          font-size: var(--font-size-lg);
        }
        .form-actions {
          display: flex;
          gap: var(--space-3);
          justify-content: flex-end;
          margin-top: var(--space-4);
        }
        .admin-section { min-height: 200px; }
        .analytics-grid {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .chart-placeholder {
          display: flex;
          align-items: flex-end;
          gap: var(--space-3);
          height: 150px;
          padding: var(--space-4) var(--space-2);
        }
        .chart-bar {
          flex: 1;
          border-radius: var(--radius-sm) var(--radius-sm) 0 0;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding-bottom: var(--space-2);
          font-size: var(--font-size-xs);
          color: white;
          font-weight: 600;
          min-height: 20px;
        }
        .chart-bar span {
          transform: rotate(-45deg);
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
