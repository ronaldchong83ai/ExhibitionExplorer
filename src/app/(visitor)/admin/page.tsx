'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import jsQR from 'jsqr';
import { useRouter } from 'next/navigation';
import type { User, Exhibition, HomePageInfo, StageEvent, Exhibitor, Voucher, Product, PurchaseConversion } from '@/types';
import type { SessionUser } from '@/types';
import { formatDateDDMMMYYYY, formatDatetimeDDMMMYYYY } from '@/lib/date';

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
  | 'facilities'
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
  const [facilities, setFacilities] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<{
    redemptionRates: Array<{ voucherId: string; title: string; count: number }>;
    vouchersPerDay: Array<{ date: string; count: number }>;
    purchaseConversions: Array<{ date: string; value: number }>;
    exhibitorSales: Array<{ exhibitorId: string; name: string; value: number }>;
  } | null>(null);
  const [filterExhibitor, setFilterExhibitor] = useState('');
  const [filterVoucher, setFilterVoucher] = useState('');
  const [selectedMetric, setSelectedMetric] = useState<'daily' | 'exhibitor'>('daily');
  const [redemptionMetric, setRedemptionMetric] = useState<'daily' | 'total'>('total');
  const [selectedChart, setSelectedChart] = useState<'redemption' | 'purchase'>('redemption');
  const [showBookingsModal, setShowBookingsModal] = useState(false);
  const [activeFacilityForBookings, setActiveFacilityForBookings] = useState<any>(null);

  // Sub-list manager states for Voucher requiredScanIds
  const [formScanIds, setFormScanIds] = useState<string[]>([]);
  const [newScanId, setNewScanId] = useState('');
  const [editingScanIdx, setEditingScanIdx] = useState<number | null>(null);
  const [editingScanVal, setEditingScanVal] = useState('');

  // Sub-list manager states for Facility operatingHours daily
  const [formOperatingHours, setFormOperatingHours] = useState<Array<{ date: string; timeFrom: string; timeTo: string }>>([]);
  const [newOpDate, setNewOpDate] = useState('');
  const [newOpTimeFrom, setNewOpTimeFrom] = useState('');
  const [newOpTimeTo, setNewOpTimeTo] = useState('');

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
      if (sec && ['exhibitions', 'home-info', 'stage-events', 'exhibitors', 'facilities', 'products', 'venue-map', 'vouchers', 'analytics', 'roles', 'feedback'].includes(sec)) {
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
    if (!user || (section !== 'exhibitors' && section !== 'analytics') || !selectedExhibition) return;
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
    if (!user || (section !== 'vouchers' && section !== 'analytics') || !selectedExhibition) return;
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

  // Fetch Facilities
  useEffect(() => {
    if (!user || section !== 'facilities' || !selectedExhibition) return;
    const loadFacilities = async () => {
      setLoading(true);
      const d = await fetchData(`/api/facilities?exhibitionId=${selectedExhibition}`);
      if (d.success) setFacilities(d.data);
      setLoading(false);
    };
    loadFacilities();
  }, [section, selectedExhibition, user]);

  // Fetch Analytics
  useEffect(() => {
    if (!user || section !== 'analytics' || !selectedExhibition) return;
    const loadAnalytics = async () => {
      setLoading(true);
      const params = new URLSearchParams({ exhibitionId: selectedExhibition });
      if (filterExhibitor) params.append('exhibitorId', filterExhibitor);
      if (filterVoucher) params.append('voucherId', filterVoucher);
      const d = await fetchData(`/api/admin/analytics?${params.toString()}`);
      if (d.success) setAnalyticsData(d.data);
      setLoading(false);
    };
    loadAnalytics();
  }, [section, selectedExhibition, user, filterExhibitor, filterVoucher]);

  const toLocalDatetimeString = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const pad = (num: number) => String(num).padStart(2, '0');
    const YYYY = date.getFullYear();
    const MM = pad(date.getMonth() + 1);
    const DD = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${YYYY}-${MM}-${DD}T${hh}:${mm}`;
  };

  const saveFacility = async () => {
    if (!formData.facilityName || !formData.facilityName.trim()) {
      alert("Facility Name is required");
      return;
    }
    if (!formData.areaNumber || !formData.areaNumber.trim()) {
      alert("Area / Booth Number is required");
      return;
    }
    if (formOperatingHours.length === 0) {
      alert("At least one operating hour daily record is required");
      return;
    }

    const body = {
      ...formData,
      id: editingId,
      exhibitionId: selectedExhibition,
      operatingHours: formOperatingHours,
      timezoneOffset: new Date().getTimezoneOffset()
    };
    const url = '/api/admin/facilities';
    const d = editingId ? await putData(url, body) : await postData(url, body);
    if (d.success) {
      setShowForm(false);
      const reload = await fetchData(`/api/facilities?exhibitionId=${selectedExhibition}`);
      if (reload.success) setFacilities(reload.data);
    } else {
      alert(d.error || "Failed to save facility");
    }
  };

  const deleteFacility = async (id: string) => {
    if (!confirm("Are you sure you want to delete this facility and all its bookings?")) return;
    const d = await deleteData(`/api/admin/facilities?id=${id}`, {});
    if (d.success) {
      const reload = await fetchData(`/api/facilities?exhibitionId=${selectedExhibition}`);
      if (reload.success) setFacilities(reload.data);
    } else {
      alert(d.error || "Failed to delete facility");
    }
  };

  const deleteExhibitor = async (id: string) => {
    if (!confirm("Are you sure you want to delete this exhibitor profile?")) return;
    const d = await deleteData(`/api/admin/exhibitors?id=${id}`, {});
    if (d.success) {
      const reload = await fetchData(`/api/admin/exhibitors?exhibitionId=${selectedExhibition}`);
      if (reload.success) setExhibitors(reload.data);
    } else {
      alert(d.error || "Failed to delete exhibitor");
    }
  };

  const deleteHomeInfo = async (id: string) => {
    if (!confirm("Are you sure you want to delete this home info record?")) return;
    const d = await deleteData(`/api/admin/home-info?id=${id}`, {});
    if (d.success) {
      const reload = await fetchData(`/api/admin/home-info?exhibitionId=${selectedExhibition}`);
      if (reload.success) setHomeInfos(reload.data);
    } else {
      alert(d.error || "Failed to delete home info");
    }
  };

  const deleteStageEvent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this stage event?")) return;
    const d = await deleteData(`/api/admin/stage-events?id=${id}`, {});
    if (d.success) {
      const reload = await fetchData(`/api/admin/stage-events?exhibitionId=${selectedExhibition}`);
      if (reload.success) setStageEvents(reload.data);
    } else {
      alert(d.error || "Failed to delete stage event");
    }
  };

  const deleteVoucher = async (id: string) => {
    if (!confirm("Are you sure you want to delete this voucher?")) return;
    const d = await deleteData(`/api/admin/vouchers?id=${id}`, {});
    if (d.success) {
      const reload = await fetchData(`/api/admin/vouchers?exhibitionId=${selectedExhibition}`);
      if (reload.success) setVouchers(reload.data);
    } else {
      alert(d.error || "Failed to delete voucher");
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    const d = await deleteData(`/api/admin/users?id=${id}`, {});
    if (d.success) {
      const reload = await fetchData('/api/admin/users');
      if (reload.success) setUsers(reload.data);
    } else {
      alert(d.error || "Failed to delete user");
    }
  };

  const cancelVisitorBooking = async (facilityId: string, timeISO: string) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    try {
      const res = await fetch(`/api/facilities?facilityId=${facilityId}&bookingTime=${encodeURIComponent(timeISO)}`, {
        method: 'DELETE'
      }).then(r => r.json());

      if (res.success) {
        const reload = await fetchData(`/api/facilities?exhibitionId=${selectedExhibition}`);
        if (reload.success) {
          setFacilities(reload.data);
          const updatedFac = reload.data.find((f: any) => f.id === facilityId);
          if (updatedFac) {
            setActiveFacilityForBookings(updatedFac);
          }
        }
      } else {
        alert(res.error || "Failed to cancel booking");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to cancel booking");
    }
  };

  const openForm = (id?: string, initialData?: Record<string, string>, requiredScanIdsArray?: string[], operatingHoursArray?: Array<{ date: string; timeFrom: string; timeTo: string }>) => {
    setEditingId(id || null);
    setFormData(initialData || { enabled: 'true' });
    setFormScanIds(requiredScanIdsArray || []);
    setNewScanId('');
    setEditingScanIdx(null);
    setFormOperatingHours(operatingHoursArray || []);
    setNewOpDate('');
    setNewOpTimeFrom('');
    setNewOpTimeTo('');
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
    if (!formData.title || !formData.title.trim()) {
      alert("Title is required");
      return;
    }
    if (!formData.eventPeriodFrom) {
      alert("Event Period From is required");
      return;
    }
    if (!formData.eventPeriodTo) {
      alert("Event Period To is required");
      return;
    }

    const url = '/api/admin/exhibitions';
    const body = { 
      ...formData, 
      id: editingId, 
      enabled: formData.enabled !== 'false',
      eventPeriodFrom: new Date(formData.eventPeriodFrom).toISOString(),
      eventPeriodTo: new Date(formData.eventPeriodTo).toISOString()
    };
    const d = editingId ? await putData(url, body) : await postData(url, body);
    if (d.success) {
      setShowForm(false);
      const reload = await fetchData(url);
      if (reload.success) setExhibitions(reload.data);
    } else {
      alert(d.error || "Failed to save exhibition");
    }
  };

  const saveHomeInfo = async () => {
    if (!formData.title || !formData.title.trim()) {
      alert("Title is required");
      return;
    }

    const body = { 
      ...formData, 
      id: editingId, 
      exhibitionId: selectedExhibition,
      displayFrom: formData.displayFrom ? new Date(formData.displayFrom).toISOString() : "",
      displayTo: formData.displayTo ? new Date(formData.displayTo).toISOString() : ""
    };
    const d = editingId ? await putData('/api/admin/home-info', body) : await postData('/api/admin/home-info', body);
    if (d.success) {
      setShowForm(false);
      const reload = await fetchData(`/api/admin/home-info?exhibitionId=${selectedExhibition}`);
      if (reload.success) setHomeInfos(reload.data);
    } else {
      alert(d.error || "Failed to save home page info");
    }
  };

  const saveStageEvent = async () => {
    if (!formData.title || !formData.title.trim()) {
      alert("Title is required");
      return;
    }
    if (!formData.eventDate) {
      alert("Date is required");
      return;
    }
    if (!formData.timeFrom) {
      alert("Time From is required");
      return;
    }
    if (!formData.timeTo) {
      alert("Time To is required");
      return;
    }
    if (!formData.stageNumber || !formData.stageNumber.trim()) {
      alert("Stage Number is required");
      return;
    }
    if (formData.timeTo < formData.timeFrom) {
      alert("Time To cannot be earlier than Time From");
      return;
    }

    const body = {
      ...formData,
      id: editingId,
      exhibitionId: selectedExhibition,
      periodFrom: new Date(formData.eventDate + 'T' + formData.timeFrom).toISOString(),
      periodTo: new Date(formData.eventDate + 'T' + formData.timeTo).toISOString(),
      speakerNames: formData.speakerNames?.split(',').map(s => s.trim()) || []
    };
    const d = editingId ? await putData('/api/admin/stage-events', body) : await postData('/api/admin/stage-events', body);
    if (d.success) {
      setShowForm(false);
      const reload = await fetchData(`/api/admin/stage-events?exhibitionId=${selectedExhibition}`);
      if (reload.success) setStageEvents(reload.data);
    } else {
      alert(d.error || "Failed to save stage event");
    }
  };

  const saveExhibitor = async () => {
    if (!formData.name || !formData.name.trim()) {
      alert("Name is required");
      return;
    }
    if (!formData.boothNumber || !formData.boothNumber.trim()) {
      alert("Booth Number is required");
      return;
    }

    const body = { ...formData, id: editingId, exhibitionId: selectedExhibition };
    const d = editingId ? await putData('/api/admin/exhibitors', body) : await postData('/api/admin/exhibitors', body);
    if (d.success) {
      setShowForm(false);
      const reload = await fetchData(`/api/admin/exhibitors?exhibitionId=${selectedExhibition}`);
      if (reload.success) setExhibitors(reload.data);
    } else {
      alert(d.error || "Failed to save exhibitor");
    }
  };

  const saveVoucher = async () => {
    if (!formData.title || !formData.title.trim()) {
      alert("Title is required");
      return;
    }
    if (!formData.displayFrom) {
      alert("Display Period From is required");
      return;
    }
    if (!formData.displayTo) {
      alert("Display Period To is required");
      return;
    }

    const body = { 
      ...formData, 
      id: editingId, 
      exhibitionId: selectedExhibition, 
      requiredScanIds: formScanIds,
      displayFrom: new Date(formData.displayFrom).toISOString(),
      displayTo: new Date(formData.displayTo).toISOString()
    };
    const d = editingId ? await putData('/api/admin/vouchers', body) : await postData('/api/admin/vouchers', body);
    if (d.success) {
      setShowForm(false);
      const reload = await fetchData(`/api/admin/vouchers?exhibitionId=${selectedExhibition}`);
      if (reload.success) setVouchers(reload.data);
    } else {
      alert(d.error || "Failed to save voucher");
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
    { key: 'facilities' as const, label: '🏢 Facilities', needsExhibition: true },
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
              <span className="admin-card-date">{formatDateDDMMMYYYY(ex.eventPeriodFrom)} - {formatDateDDMMMYYYY(ex.eventPeriodTo)}</span>
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
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" onClick={() => { openForm(info.id, { title: info.title, type: info.type, description: info.description || '', displayFrom: info.displayFrom ? toLocalDatetimeString(info.displayFrom) : '', displayTo: info.displayTo ? toLocalDatetimeString(info.displayTo) : '', details: info.details || '' }); }}>Edit</button>
                  <button className="btn btn-icon" onClick={() => deleteHomeInfo(info.id)} style={{ background: 'rgba(255, 107, 107, 0.1)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-sm)', color: 'var(--color-accent-coral)', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    ✕
                  </button>
                </div>
              </div>
              <p className="admin-card-desc">{info.description}</p>
              {info.displayFrom && info.displayTo && (
                <span className="admin-card-date" style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 8 }}>
                  🕒 {formatDatetimeDDMMMYYYY(info.displayFrom)} - {formatDatetimeDDMMMYYYY(info.displayTo)}
                </span>
              )}
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
                  <div className="form-group"><label className="form-label">Date From</label><input className="form-input" type="datetime-local" value={formData.displayFrom || ''} onChange={e => handleFormChange('displayFrom', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Date To</label><input className="form-input" type="datetime-local" value={formData.displayTo || ''} onChange={e => handleFormChange('displayTo', e.target.value)} /></div>
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
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" onClick={() => {
                    const localFrom = toLocalDatetimeString(ev.periodFrom);
                    const localTo = toLocalDatetimeString(ev.periodTo);
                    const [date, timeFrom] = localFrom.split('T');
                    const [, timeTo] = localTo.split('T');
                    openForm(ev.id, { 
                      title: ev.title, 
                      eventDate: date || '', 
                      timeFrom: timeFrom || '', 
                      timeTo: timeTo || '', 
                      stageNumber: ev.stageNumber || '', 
                      speakerNames: ev.speakerNames.join(', '), 
                      details: ev.details || '' 
                    });
                  }}>Edit</button>
                  <button className="btn btn-icon" onClick={() => deleteStageEvent(ev.id)} style={{ background: 'rgba(255, 107, 107, 0.1)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-sm)', color: 'var(--color-accent-coral)', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    ✕
                  </button>
                </div>
              </div>
              <p className="admin-card-desc">{ev.stageNumber} · {ev.speakerNames.join(', ')}</p>
              <span className="admin-card-date" style={{ display: 'block', marginTop: 4, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                🕒 Date: {(() => {
                  const fromFormatted = formatDatetimeDDMMMYYYY(ev.periodFrom);
                  const toFormatted = formatDatetimeDDMMMYYYY(ev.periodTo);
                  const [fromDate, fromTime] = fromFormatted.split(', ');
                  const [toDate, toTime] = toFormatted.split(', ');
                  if (fromDate === toDate) {
                    return `${fromDate}, ${fromTime} - ${toTime}`;
                  }
                  return `${fromFormatted} - ${toFormatted}`;
                })()}
              </span>
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
                  <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={formData.eventDate || ''} onChange={e => handleFormChange('eventDate', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Time From</label><input className="form-input" type="time" value={formData.timeFrom || ''} onChange={e => handleFormChange('timeFrom', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Time To</label><input className="form-input" type="time" value={formData.timeTo || ''} onChange={e => handleFormChange('timeTo', e.target.value)} /></div>
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
                <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      openForm(ex.id, { name: ex.name, description: ex.description || '', boothNumber: ex.boothNumber || '', details: ex.details || '' }); 
                    }}
                  >
                    Edit
                  </button>
                  <button 
                    className="btn btn-icon" 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteExhibitor(ex.id);
                    }} 
                    style={{ background: 'rgba(255, 107, 107, 0.1)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-sm)', color: 'var(--color-accent-coral)', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ✕
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
                    Uploaded at: {formatDatetimeDDMMMYYYY(venueMap.uploadedAt)}
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
                  <button className="btn btn-secondary" onClick={() => { openForm(v.id, { title: v.title, description: v.description || '', details: v.details || '', displayFrom: v.displayFrom ? toLocalDatetimeString(v.displayFrom) : '', displayTo: v.displayTo ? toLocalDatetimeString(v.displayTo) : '' }, v.requiredScanIds); }}>Edit</button>
                  <button className="btn btn-icon" onClick={() => deleteVoucher(v.id)} style={{ background: 'rgba(255, 107, 107, 0.1)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-sm)', color: 'var(--color-accent-coral)', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    ✕
                  </button>
                </div>
              </div>
              <p className="admin-card-desc">{v.description}</p>
              <span className="admin-card-date" style={{ display: 'block', marginTop: 4, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                🕒 Display: {v.displayFrom && v.displayTo ? `${formatDatetimeDDMMMYYYY(v.displayFrom)} - ${formatDatetimeDDMMMYYYY(v.displayTo)}` : 'Always active'}
              </span>
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
                  <div className="form-group"><label className="form-label">Display Period From</label><input className="form-input" type="datetime-local" value={formData.displayFrom || ''} onChange={e => handleFormChange('displayFrom', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Display Period To</label><input className="form-input" type="datetime-local" value={formData.displayTo || ''} onChange={e => handleFormChange('displayTo', e.target.value)} /></div>
                  
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

      {/* ============= FACILITIES ============= */}
      {section === 'facilities' && selectedExhibition && (
        <div className="admin-section animate-fade-in">
          <div className="section-header">
            <h3 className="section-title">Facilities</h3>
            <button className="btn btn-primary" onClick={() => openForm(undefined, { facilityName: '', areaNumber: '' }, undefined, [])}>+ Add</button>
          </div>
          
          {facilities.length === 0 ? (
            <p style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic', textAlign: 'center', padding: 'var(--space-4)' }}>No facilities registered.</p>
          ) : (
            facilities.map(f => (
              <div 
                key={f.id} 
                className="admin-card card" 
                onClick={() => {
                  setActiveFacilityForBookings(f);
                  setShowBookingsModal(true);
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="admin-card-header">
                  <div>
                    <h4 style={{ marginTop: 0 }}>{f.facilityName}</h4>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary" onClick={() => {
                      let ops = [];
                      if (f.operatingHours) {
                        try {
                          ops = JSON.parse(f.operatingHours);
                        } catch (_) {}
                      }
                      openForm(f.id, {
                        facilityName: f.facilityName,
                        areaNumber: f.areaNumber
                      }, undefined, ops);
                    }}>
                      Edit
                    </button>
                    <button className="btn btn-icon" onClick={() => deleteFacility(f.id)} style={{ background: 'rgba(255, 107, 107, 0.1)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-sm)', color: 'var(--color-accent-coral)', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      ✕
                    </button>
                  </div>
                </div>
                <p className="admin-card-desc">📍 Area: {f.areaNumber}</p>
                {(() => {
                  let ops = [];
                  if (f.operatingHours) {
                    try { ops = JSON.parse(f.operatingHours); } catch(_) {}
                  }
                  if (ops.length > 0) {
                    return (
                      <div className="admin-card-date" style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: 4, fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        <span style={{ fontWeight: 600 }}>🕒 Operating Hours:</span>
                        {ops.map((op: any, i: number) => {
                          let niceDate = op.date;
                          try {
                            const d = new Date(op.date);
                            if (!isNaN(d.getTime())) niceDate = formatDateDDMMMYYYY(d);
                          } catch(_) {}
                          return <span key={i} style={{ paddingLeft: '8px' }}>• {niceDate}: {op.timeFrom} - {op.timeTo}</span>;
                        })}
                      </div>
                    );
                  }
                  return (
                    <span className="admin-card-date" style={{ display: 'block', marginTop: 4 }}>
                      🕒 Operating: {formatDatetimeDDMMMYYYY(f.periodFrom)} - {formatDatetimeDDMMMYYYY(f.periodTo)}
                    </span>
                  );
                })()}
                <span className="badge badge-green" style={{ fontSize: '10px', marginTop: 8 }}>
                  Booked slots: {f.bookings?.length || 0}
                </span>
              </div>
            ))
          )}

          {/* Bookings Viewer Modal */}
          {showBookingsModal && activeFacilityForBookings && (
            <>
              <div className="modal-overlay" onClick={() => setShowBookingsModal(false)} />
              <div className="modal-content">
                <div className="modal-handle" />
                <div className="admin-form animate-scale-in" style={{ marginTop: 0 }}>
                  <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-3)' }}>Booked Time Slots: {activeFacilityForBookings.facilityName}</h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Visitor Reservations ({activeFacilityForBookings.bookings?.length || 0})</label>
                    
                    {(!activeFacilityForBookings.bookings || activeFacilityForBookings.bookings.length === 0) ? (
                      <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textAlign: 'center', margin: '12px 0', fontStyle: 'italic' }}>
                        No bookings for this facility yet.
                      </p>
                    ) : (
                      activeFacilityForBookings.bookings.map((booking: any) => {
                        const bTime = new Date(booking.bookingTime);
                        const bTimeEnd = new Date(bTime.getTime() + 15 * 60 * 1000);
                        const slotLabel = `${bTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - ${bTimeEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
                        const dateLabel = formatDateDDMMMYYYY(bTime);

                        return (
                          <div key={booking.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 12px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                              <span style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{booking.user?.name || 'Unknown User'}</span>
                              <span style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{booking.user?.email || ''}</span>
                              <span className="badge badge-blue" style={{ fontSize: '9px', textTransform: 'none', padding: '2px 6px' }}>{dateLabel}, {slotLabel}</span>
                            </div>
                            <button
                              className="btn btn-icon"
                              type="button"
                              onClick={() => cancelVisitorBooking(activeFacilityForBookings.id, booking.bookingTime)}
                              style={{ background: 'rgba(255, 107, 107, 0.1)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-sm)', color: 'var(--color-accent-coral)', fontSize: '12px', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="form-actions" style={{ marginTop: 'var(--space-4)' }}>
                    <button className="btn btn-secondary" type="button" onClick={() => setShowBookingsModal(false)}>Close</button>
                  </div>
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
                  <h4>{editingId ? 'Edit' : 'Add'} Facility</h4>

                  <div className="form-group">
                    <label className="form-label">Facility Name</label>
                    <input className="form-input" value={formData.facilityName || ''} onChange={e => handleFormChange('facilityName', e.target.value)} placeholder="e.g. Lounge Room A" />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Area / Booth Number</label>
                    <input className="form-input" value={formData.areaNumber || ''} onChange={e => handleFormChange('areaNumber', e.target.value)} placeholder="e.g. Zone B, Level 1" />
                  </div>

                  {/* Operating Hours daily sub-records manager */}
                  <div className="form-group" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px', marginTop: '16px' }}>
                    <label className="form-label" style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Daily Operating Hours</span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>({formOperatingHours.length} days)</span>
                    </label>

                    {/* Sub-records list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                      {formOperatingHours.length === 0 ? (
                        <p style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--color-text-tertiary)', margin: 0 }}>No operating hours defined yet.</p>
                      ) : (
                        formOperatingHours.map((op, idx) => {
                          let niceDate = op.date;
                          try {
                            const d = new Date(op.date);
                            if (!isNaN(d.getTime())) {
                              niceDate = formatDateDDMMMYYYY(d);
                            }
                          } catch (_) {}
                          return (
                            <div key={idx} className="subrecord-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                                📅 {niceDate}: <strong style={{ color: 'var(--color-text-primary)' }}>{op.timeFrom} - {op.timeTo}</strong>
                              </span>
                              <button 
                                type="button" 
                                className="btn btn-icon" 
                                onClick={() => setFormOperatingHours(prev => prev.filter((_, i) => i !== idx))}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-accent-coral)', fontSize: '12px' }}
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Add new sub-record entry */}
                    <div className="card" style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.01)', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>Add Operating Day</span>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '120px' }}>
                          <label style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: '2px' }}>Date</label>
                          <input 
                            className="form-input" 
                            type="date" 
                            value={newOpDate} 
                            onChange={e => setNewOpDate(e.target.value)} 
                            style={{ padding: '6px 10px', fontSize: '12px', minHeight: '36px' }}
                          />
                        </div>
                        <div style={{ width: '120px' }}>
                          <label style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: '2px' }}>From</label>
                          <input 
                            className="form-input" 
                            type="time" 
                            value={newOpTimeFrom} 
                            onChange={e => setNewOpTimeFrom(e.target.value)} 
                            style={{ padding: '6px 10px', fontSize: '12px', minHeight: '36px' }}
                          />
                        </div>
                        <div style={{ width: '120px' }}>
                          <label style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: '2px' }}>To</label>
                          <input 
                            className="form-input" 
                            type="time" 
                            value={newOpTimeTo} 
                            onChange={e => setNewOpTimeTo(e.target.value)} 
                            style={{ padding: '6px 10px', fontSize: '12px', minHeight: '36px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            onClick={() => {
                              if (!newOpDate || !newOpTimeFrom || !newOpTimeTo) {
                                alert('Please set Date, Time From, and Time To.');
                                return;
                              }
                              if (newOpTimeFrom >= newOpTimeTo) {
                                alert('Time From must be before Time To.');
                                return;
                              }
                              const overlaps = formOperatingHours.some(op => {
                                if (op.date !== newOpDate) return false;
                                return (newOpTimeFrom < op.timeTo && newOpTimeTo > op.timeFrom);
                              });
                              if (overlaps) {
                                alert('This operating day and time interval overlaps with an existing entry.');
                                return;
                              }
                              setFormOperatingHours(prev => [...prev, { date: newOpDate, timeFrom: newOpTimeFrom, timeTo: newOpTimeTo }]);
                              setNewOpDate('');
                              setNewOpTimeFrom('');
                              setNewOpTimeTo('');
                            }}
                            style={{ padding: '6px 12px', fontSize: '12px', height: '36px' }}
                          >
                            + Add Day
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={saveFacility}>Save</button>
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

          {/* Chart Selector Dropdown */}
          <div className="form-group" style={{ marginBottom: '24px', maxWidth: '320px' }}>
            <label className="form-label" style={{ fontWeight: 600 }}>Select Chart</label>
            <select
              className="form-input"
              value={selectedChart}
              onChange={e => {
                setSelectedChart(e.target.value as 'redemption' | 'purchase');
                setFilterExhibitor('');
                setFilterVoucher('');
              }}
              style={{ padding: '8px 12px', fontSize: '14px' }}
            >
              <option value="redemption">🎫 Voucher Redemption Chart</option>
              <option value="purchase">📈 Purchase Conversion Chart</option>
            </select>
          </div>

          {/* Conditional Filters (Only for Redemption Chart) */}
          {selectedChart === 'redemption' && (
            <div className="analytics-filters card" style={{ padding: '16px', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '150px' }}>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Metrics</label>
                <select 
                  className="form-input" 
                  value={redemptionMetric} 
                  onChange={e => setRedemptionMetric(e.target.value as 'daily' | 'total')}
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                >
                  <option value="total">Total Voucher Redemption</option>
                  <option value="daily">Vouchers per day</option>
                </select>
              </div>
              {redemptionMetric === 'daily' && (
                <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '150px' }}>
                  <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Filter by Voucher</label>
                  <select 
                    className="form-input" 
                    value={filterVoucher} 
                    onChange={e => setFilterVoucher(e.target.value)}
                    style={{ padding: '6px 12px', fontSize: '13px' }}
                  >
                    <option value="">All Vouchers</option>
                    {vouchers.map(v => (
                      <option key={v.id} value={v.id}>{v.title}</option>
                    ))}
                  </select>
                </div>
              )}
              {filterVoucher && redemptionMetric === 'daily' && (
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setFilterVoucher('')}
                  style={{ marginTop: '16px', padding: '6px 12px', fontSize: '12px' }}
                >
                  Clear Filter
                </button>
              )}
            </div>
          )}

          {/* Conditional Filters (Only for Purchase Conversion) */}
          {selectedChart === 'purchase' && (
            <div className="analytics-filters card" style={{ padding: '16px', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '150px' }}>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Metrics</label>
                <select 
                  className="form-input" 
                  value={selectedMetric} 
                  onChange={e => setSelectedMetric(e.target.value as 'daily' | 'exhibitor')}
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                >
                  <option value="daily">Sales per day</option>
                  <option value="exhibitor">Total Sales per Exhibitor</option>
                </select>
              </div>
              {selectedMetric === 'daily' && (
                <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '150px' }}>
                  <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Filter by Exhibitor</label>
                  <select 
                    className="form-input" 
                    value={filterExhibitor} 
                    onChange={e => setFilterExhibitor(e.target.value)}
                    style={{ padding: '6px 12px', fontSize: '13px' }}
                  >
                    <option value="">All Exhibitors</option>
                    {exhibitors.map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {filterExhibitor && selectedMetric === 'daily' && (
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setFilterExhibitor('')}
                  style={{ marginTop: '16px', padding: '6px 12px', fontSize: '12px' }}
                >
                  Clear Filter
                </button>
              )}
            </div>
          )}

          <div className="analytics-grid">
            {/* Redemption Rate Chart (Horizontal) */}
            {selectedChart === 'redemption' && (
              <div className="admin-card card" style={{ padding: '24px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>🎫 Voucher Redemption</h4>
                <p className="admin-card-desc" style={{ marginBottom: '24px' }}>
                  {redemptionMetric === 'total' ? 'Total Voucher Redemption' : 'Vouchers per day'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {redemptionMetric === 'total' ? (
                    (() => {
                      const maxRedemption = analyticsData?.redemptionRates && analyticsData.redemptionRates.length > 0
                        ? Math.max(...analyticsData.redemptionRates.map(r => r.count))
                        : 0;
                      return analyticsData?.redemptionRates && analyticsData.redemptionRates.length > 0 ? (
                        analyticsData.redemptionRates.map(r => (
                          <div key={r.voucherId} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                              <span>{r.title}</span>
                              <span>{r.count}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ flex: 1, height: '18px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-full)', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <div 
                                  style={{ 
                                    width: `${maxRedemption > 0 ? (r.count / maxRedemption) * 100 : 0}%`, 
                                    height: '100%', 
                                    background: 'var(--gradient-primary)', 
                                    borderRadius: 'var(--radius-full)',
                                    transition: 'width 0.5s ease'
                                  }} 
                                />
                              </div>
                              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)', width: '40px', textAlign: 'right' }} />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', textAlign: 'center', padding: '24px' }}>
                          No voucher statistics found
                        </p>
                      );
                    })()
                  ) : (
                    (() => {
                      const maxDailyVouchers = analyticsData?.vouchersPerDay && analyticsData.vouchersPerDay.length > 0
                        ? Math.max(...analyticsData.vouchersPerDay.map(v => v.count))
                        : 0;
                      return analyticsData?.vouchersPerDay && analyticsData.vouchersPerDay.length > 0 ? (
                        analyticsData.vouchersPerDay.map(c => (
                          <div key={c.date} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                              <span>{c.date}</span>
                              <span>{c.count}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ flex: 1, height: '18px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-full)', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <div 
                                  style={{ 
                                    width: `${maxDailyVouchers > 0 ? (c.count / maxDailyVouchers) * 100 : 0}%`, 
                                    height: '100%', 
                                    background: 'var(--gradient-primary)', 
                                    borderRadius: 'var(--radius-full)',
                                    transition: 'width 0.5s ease'
                                  }} 
                                />
                              </div>
                              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)', width: '40px', textAlign: 'right' }} />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', textAlign: 'center', padding: '24px' }}>
                          No voucher daily statistics found
                        </p>
                      );
                    })()
                  )}
                </div>
              </div>
            )}

            {/* Purchase Conversion Chart (Horizontal) */}
            {selectedChart === 'purchase' && (
              <div className="admin-card card" style={{ padding: '24px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>📈 Purchase Conversion</h4>
                <p className="admin-card-desc" style={{ marginBottom: '24px' }}>
                  {selectedMetric === 'daily' ? 'Sales per day' : 'Total Sales per Exhibitor'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {selectedMetric === 'daily' ? (
                    (() => {
                      const maxSales = analyticsData?.purchaseConversions && analyticsData.purchaseConversions.length > 0
                        ? Math.max(...analyticsData.purchaseConversions.map(c => c.value))
                        : 0;
                      return analyticsData?.purchaseConversions && analyticsData.purchaseConversions.length > 0 ? (
                        analyticsData.purchaseConversions.map(c => (
                          <div key={c.date} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                              <span>{c.date}</span>
                              <span>${c.value}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ flex: 1, height: '18px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-full)', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <div 
                                  style={{ 
                                    width: `${maxSales > 0 ? (c.value / maxSales) * 100 : 0}%`, 
                                    height: '100%', 
                                    background: 'var(--gradient-cool)', 
                                    borderRadius: 'var(--radius-full)',
                                    transition: 'width 0.5s ease'
                                  }} 
                                />
                              </div>
                              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)', width: '40px', textAlign: 'right' }} />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', textAlign: 'center', padding: '24px' }}>
                          No sales data found
                        </p>
                      );
                    })()
                  ) : (
                    (() => {
                      const maxExSales = analyticsData?.exhibitorSales && analyticsData.exhibitorSales.length > 0
                        ? Math.max(...analyticsData.exhibitorSales.map(e => e.value))
                        : 0;
                      return analyticsData?.exhibitorSales && analyticsData.exhibitorSales.length > 0 ? (
                        analyticsData.exhibitorSales.map(ex => (
                          <div key={ex.exhibitorId} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                              <span>{ex.name}</span>
                              <span>${ex.value}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ flex: 1, height: '18px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-full)', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <div 
                                  style={{ 
                                    width: `${maxExSales > 0 ? (ex.value / maxExSales) * 100 : 0}%`, 
                                    height: '100%', 
                                    background: 'var(--gradient-cool)', 
                                    borderRadius: 'var(--radius-full)',
                                    transition: 'width 0.5s ease'
                                  }} 
                                />
                              </div>
                              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)', width: '40px', textAlign: 'right' }} />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', textAlign: 'center', padding: '24px' }}>
                          No exhibitor sales data found
                        </p>
                      );
                    })()
                  )}
                </div>
              </div>
            )}
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
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                        <button 
                          className="btn btn-icon" 
                          onClick={() => deleteUser(u.id)} 
                          style={{ background: 'rgba(255, 107, 107, 0.1)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-sm)', color: 'var(--color-accent-coral)', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          disabled={u.id === user?.id}
                        >
                          ✕
                        </button>
                      </div>
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
                          {formatDatetimeDDMMMYYYY(fb.createdAt)}
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
