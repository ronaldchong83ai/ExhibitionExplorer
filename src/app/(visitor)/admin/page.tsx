'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import jsQR from 'jsqr';
import { useRouter } from 'next/navigation';
import type { User, Exhibition, HomePageInfo, StageEvent, Exhibitor, Voucher, Product, PurchaseConversion, RequiredScanItem } from '@/types';
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
  | 'feedback'
  | 'about-us';

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
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Voucher Collections Manager states
  const [showCollectionsModal, setShowCollectionsModal] = useState(false);
  const [activeVoucherForCollections, setActiveVoucherForCollections] = useState<Voucher | null>(null);
  const [collectedVisitors, setCollectedVisitors] = useState<any[]>([]);
  const [newVisitorEmail, setNewVisitorEmail] = useState('');
  const [collectionsLoading, setCollectionsLoading] = useState(false);

  // Voucher Scan Logs states
  const [showScanLogsModal, setShowScanLogsModal] = useState(false);
  const [activeVoucherForScans, setActiveVoucherForScans] = useState<Voucher | null>(null);
  const [scanLogs, setScanLogs] = useState<any[]>([]);
  const [scanLogsLoading, setScanLogsLoading] = useState(false);

  // Voucher Manage Scan IDs states
  const [showManageScanIdsModal, setShowManageScanIdsModal] = useState(false);
  const [activeVoucherForScanIds, setActiveVoucherForScanIds] = useState<Voucher | null>(null);
  const [scanItemsList, setScanItemsList] = useState<RequiredScanItem[]>([]);
  const [editingScanItemIdx, setEditingScanItemIdx] = useState<number | null>(null);
  const [editingScanItem, setEditingScanItem] = useState<RequiredScanItem>({ scanId: '', stampImageUrl: '', urlName: '', urlLink: '' });
  const [newScanItem, setNewScanItem] = useState<RequiredScanItem>({ scanId: '', stampImageUrl: '', urlName: '', urlLink: '' });
  const [savingScanIds, setSavingScanIds] = useState(false);

  // About Us editor states & refs
  const [aboutUsContent, setAboutUsContent] = useState('');
  const [aboutUsLoading, setAboutUsLoading] = useState(false);
  const [aboutUsUploadedImages, setAboutUsUploadedImages] = useState<string[]>([]);
  const editorRef = useRef<HTMLDivElement>(null);

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

  // Fetch About Us content
  useEffect(() => {
    if (!user || section !== 'about-us' || !selectedExhibition) return;
    const loadAboutUs = async () => {
      setLoading(true);
      const d = await fetchData(`/api/about-us?exhibitionId=${selectedExhibition}`);
      if (d.success && d.data) {
        setAboutUsContent(d.data.content || '');
      } else {
        setAboutUsContent('');
      }
      setLoading(false);
    };
    loadAboutUs();
  }, [section, selectedExhibition, user]);

  // Fetch About Us uploaded images list
  useEffect(() => {
    if (!user || section !== 'about-us' || !selectedExhibition) return;
    const loadUploadedImages = async () => {
      try {
        const d = await fetchData(`/api/admin/about-us/upload?exhibitionId=${selectedExhibition}`);
        if (d.success && d.data) {
          setAboutUsUploadedImages(d.data);
        }
      } catch (err) {
        console.error("Failed to load uploaded images:", err);
      }
    };
    loadUploadedImages();
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

  const openForm = (id?: string, initialData?: Record<string, any>, requiredScanIdsArray?: string[], operatingHoursArray?: Array<{ date: string; timeFrom: string; timeTo: string }>) => {
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

  const handleFormChange = (key: string, value: any) => {
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
      speakerNames: (formData.speakerNames as string)?.split(',').map((s: string) => s.trim()) || []
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

  const getTrophyPriority = (trophy: string | boolean | undefined | null): number => {
    if (trophy === 'gold' || trophy === true || trophy === 'true') return 3;
    if (trophy === 'silver') return 2;
    if (trophy === 'bronze') return 1;
    return 0;
  };

  const getNextTrophy = (current: string | boolean | undefined | null): string => {
    if (current === 'bronze') return 'silver';
    if (current === 'silver') return 'gold';
    if (current === 'gold') return 'none';
    return 'bronze';
  };

  const getTrophyEmoji = (trophy: string | boolean | undefined | null): string => {
    if (!trophy) return '';
    if (trophy === 'gold' || trophy === true || trophy === 'true') return '🏆';
    if (trophy === 'silver') return '🥈';
    if (trophy === 'bronze') return '🥉';
    return '';
  };

  const getTrophyButtonStyle = (trophy: string | boolean | undefined | null) => {
    if (trophy === 'gold' || trophy === true || trophy === 'true') {
      return {
        color: '#F59E0B',
        background: 'rgba(245, 158, 11, 0.15)',
        title: 'Gold Trophy'
      };
    }
    if (trophy === 'silver') {
      return {
        color: '#94A3B8',
        background: 'rgba(148, 163, 184, 0.15)',
        title: 'Silver Trophy'
      };
    }
    if (trophy === 'bronze') {
      return {
        color: '#B45309',
        background: 'rgba(180, 83, 9, 0.15)',
        title: 'Bronze Trophy'
      };
    }
    return {
      color: 'var(--color-text-tertiary)',
      background: 'rgba(255, 255, 255, 0.05)',
      title: 'Give Trophy'
    };
  };

  const toggleExhibitorTrophy = async (ex: Exhibitor) => {
    try {
      const nextTrophy = getNextTrophy(ex.hasTrophy);
      const res = await putData('/api/admin/exhibitors', {
        id: ex.id,
        hasTrophy: nextTrophy
      });
      if (res.success) {
        setExhibitors(prev => {
          const updated = prev.map(item => item.id === ex.id ? { ...item, hasTrophy: nextTrophy } : item);
          updated.sort((a, b) => {
            const aScore = getTrophyPriority(a.hasTrophy);
            const bScore = getTrophyPriority(b.hasTrophy);
            if (aScore !== bScore) return bScore - aScore;
            return a.boothNumber.localeCompare(b.boothNumber);
          });
          return updated;
        });
      } else {
        alert(res.error || "Failed to update trophy status");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update trophy status");
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

  const openScanLogs = async (v: Voucher) => {
    setActiveVoucherForScans(v);
    setShowScanLogsModal(true);
    setScanLogsLoading(true);
    setScanLogs([]);
    try {
      const res = await fetchData(`/api/admin/vouchers/${v.id}/scans`);
      if (res.success) {
        setScanLogs(res.data || []);
      } else {
        alert(res.error || "Failed to load scan logs");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load scan logs");
    } finally {
      setScanLogsLoading(false);
    }
  };

  const openManageScanIds = (v: Voucher) => {
    setActiveVoucherForScanIds(v);
    let items: RequiredScanItem[] = [];
    if (v.scanItems && Array.isArray(v.scanItems) && v.scanItems.length > 0) {
      items = v.scanItems.map(item => ({
        scanId: item.scanId || '',
        stampImageUrl: item.stampImageUrl || '',
        urlName: item.urlName || '',
        urlLink: item.urlLink || '',
      }));
    } else if (v.requiredScanIds && Array.isArray(v.requiredScanIds) && v.requiredScanIds.length > 0) {
      items = v.requiredScanIds.map(id => ({
        scanId: id,
        stampImageUrl: '',
        urlName: '',
        urlLink: '',
      }));
    }
    setScanItemsList(items);
    setEditingScanItemIdx(null);
    setNewScanItem({ scanId: '', stampImageUrl: '', urlName: '', urlLink: '' });
    setShowManageScanIdsModal(true);
  };

  const handleStampImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEditing: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      alert("Stamp image size must be under 1MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      if (isEditing) {
        setEditingScanItem(prev => ({ ...prev, stampImageUrl: base64 }));
      } else {
        setNewScanItem(prev => ({ ...prev, stampImageUrl: base64 }));
      }
    };
    reader.readAsDataURL(file);
  };

  const addScanItem = () => {
    if (!newScanItem.scanId.trim()) {
      alert('Scan ID is required.');
      return;
    }
    if (scanItemsList.some(item => item.scanId.trim().toLowerCase() === newScanItem.scanId.trim().toLowerCase())) {
      alert('This Scan ID is already in the list.');
      return;
    }
    setScanItemsList(prev => [...prev, {
      scanId: newScanItem.scanId.trim(),
      stampImageUrl: newScanItem.stampImageUrl || '',
      urlName: newScanItem.urlName || '',
      urlLink: newScanItem.urlLink || '',
    }]);
    setNewScanItem({ scanId: '', stampImageUrl: '', urlName: '', urlLink: '' });
  };

  const startScanItemEdit = (idx: number, item: RequiredScanItem) => {
    setEditingScanItemIdx(idx);
    setEditingScanItem({ ...item });
  };

  const saveScanItemEdit = (idx: number) => {
    if (!editingScanItem.scanId.trim()) {
      alert('Scan ID cannot be empty.');
      return;
    }
    setScanItemsList(prev => prev.map((item, i) => i === idx ? {
      scanId: editingScanItem.scanId.trim(),
      stampImageUrl: editingScanItem.stampImageUrl || '',
      urlName: editingScanItem.urlName || '',
      urlLink: editingScanItem.urlLink || '',
    } : item));
    setEditingScanItemIdx(null);
  };

  const deleteScanItem = (idx: number) => {
    setScanItemsList(prev => prev.filter((_, i) => i !== idx));
  };

  const saveManageScanIds = async () => {
    if (!activeVoucherForScanIds) return;
    setSavingScanIds(true);
    try {
      const body = {
        id: activeVoucherForScanIds.id,
        scanItems: scanItemsList,
        requiredScanIds: scanItemsList.map(item => item.scanId),
      };
      const d = await putData('/api/admin/vouchers', body);
      if (d.success) {
        setShowManageScanIdsModal(false);
        const reload = await fetchData(`/api/admin/vouchers?exhibitionId=${selectedExhibition}`);
        if (reload.success) setVouchers(reload.data);
      } else {
        alert(d.error || "Failed to save scan IDs");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save scan IDs");
    } finally {
      setSavingScanIds(false);
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
        alert("Redeem successful!");
        setCollectedVisitors(prev => {
          if (prev.some(v => v.userId === res.data.userId)) return prev;
          const updated = [...prev, res.data];
          updated.sort((a, b) => new Date(a.collectedAt).getTime() - new Date(b.collectedAt).getTime());
          return updated;
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

  // Load content into editor on mount/load/switch
  useEffect(() => {
    if (editorRef.current && section === 'about-us') {
      editorRef.current.innerHTML = aboutUsContent;
    }
  }, [section, loading, aboutUsContent]);

  const saveAboutUs = async () => {
    if (!selectedExhibition) return;
    const finalContent = editorRef.current ? editorRef.current.innerHTML : '';
    setAboutUsLoading(true);
    try {
      const res = await postData('/api/admin/about-us', {
        exhibitionId: selectedExhibition,
        content: finalContent,
      });
      if (res.success) {
        alert("About Us content saved successfully!");
      } else {
        alert(res.error || "Failed to save About Us content");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save content");
    } finally {
      setAboutUsLoading(false);
    }
  };

  const applyFormat = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
  };

  const getSelectedCell = (): HTMLTableCellElement | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    let node: Node | null = selection.getRangeAt(0).startContainer;
    
    while (node && node !== editorRef.current) {
      if (node.nodeName === 'TD' || node.nodeName === 'TH') {
        return node as HTMLTableCellElement;
      }
      node = node.parentNode;
    }
    return null;
  };

  const getSelectedTable = (cell: HTMLTableCellElement): HTMLTableElement | null => {
    let node: Node | null = cell;
    while (node && node !== editorRef.current) {
      if (node.nodeName === 'TABLE') {
        return node as HTMLTableElement;
      }
      node = node.parentNode;
    }
    return null;
  };

  const insertTable = () => {
    const rowsInput = prompt("Enter number of rows:", "2");
    if (!rowsInput) return;
    const colsInput = prompt("Enter number of columns:", "2");
    if (!colsInput) return;

    const rows = parseInt(rowsInput);
    const cols = parseInt(colsInput);
    if (isNaN(rows) || isNaN(cols) || rows <= 0 || cols <= 0) {
      alert("Invalid number of rows or columns.");
      return;
    }

    let tableHtml = `<table style="width: 100%; border-collapse: collapse; margin: 12px 0; border: 1px solid var(--color-border);">`;
    tableHtml += `<tbody>`;
    for (let r = 0; r < rows; r++) {
      tableHtml += `<tr>`;
      for (let c = 0; c < cols; c++) {
        tableHtml += `<td style="border: 1px solid var(--color-border); padding: 8px; min-width: 50px;">Cell</td>`;
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table><p><br></p>`;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    
    if (editorRef.current && !editorRef.current.contains(range.commonAncestorContainer)) {
      editorRef.current.focus();
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = tableHtml;
    const tableNode = tempDiv.firstChild;
    const pNode = tempDiv.lastChild;
    if (tableNode) {
      range.deleteContents();
      range.insertNode(tableNode);
      if (pNode) {
        range.collapse(false);
        range.insertNode(pNode);
      }
    }
  };

  const addRow = () => {
    const cell = getSelectedCell();
    if (!cell) {
      alert("Please click inside a table cell first.");
      return;
    }
    const tr = cell.parentElement as HTMLTableRowElement;
    const table = getSelectedTable(cell);
    if (!tr || !table) return;

    const colCount = tr.cells.length;
    const newRow = table.insertRow(tr.rowIndex + 1);
    for (let i = 0; i < colCount; i++) {
      const newCell = newRow.insertCell(i);
      newCell.innerHTML = "Cell";
      newCell.setAttribute("style", "border: 1px solid var(--color-border); padding: 8px; min-width: 50px;");
    }
  };

  const addColumn = () => {
    const cell = getSelectedCell();
    if (!cell) {
      alert("Please click inside a table cell first.");
      return;
    }
    const table = getSelectedTable(cell);
    if (!table) return;

    const colIndex = cell.cellIndex;
    const rows = table.rows;
    for (let i = 0; i < rows.length; i++) {
      const newCell = rows[i].insertCell(colIndex + 1);
      newCell.innerHTML = "Cell";
      newCell.setAttribute("style", "border: 1px solid var(--color-border); padding: 8px; min-width: 50px;");
    }
  };

  const deleteRow = () => {
    const cell = getSelectedCell();
    if (!cell) {
      alert("Please click inside a table cell first.");
      return;
    }
    const tr = cell.parentElement as HTMLTableRowElement;
    const table = getSelectedTable(cell);
    if (!tr || !table) return;

    table.deleteRow(tr.rowIndex);
    if (table.rows.length === 0) {
      table.remove();
    }
  };

  const deleteColumn = () => {
    const cell = getSelectedCell();
    if (!cell) {
      alert("Please click inside a table cell first.");
      return;
    }
    const table = getSelectedTable(cell);
    if (!table) return;

    const colIndex = cell.cellIndex;
    const rows = table.rows;
    
    const isLastCol = rows[0]?.cells.length <= 1;
    if (isLastCol) {
      table.remove();
      return;
    }

    for (let i = 0; i < rows.length; i++) {
      rows[i].deleteCell(colIndex);
    }
  };

  const deleteTable = () => {
    const cell = getSelectedCell();
    if (!cell) {
      alert("Please click inside a table cell first.");
      return;
    }
    const table = getSelectedTable(cell);
    if (!table) return;

    table.remove();
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
    { key: 'about-us' as const, label: 'ℹ️ About Us', needsExhibition: true },
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
              onClick={() => router.push(`/exhibitors/${ex.id}?fromAdmin=true`)}
              style={{ cursor: 'pointer' }}
            >
              <div className="admin-card-header">
                <h4>
                  {ex.name} {ex.hasTrophy && ex.hasTrophy !== 'none' && <span style={{ marginLeft: 4 }} title="Featured (Trophy)">{getTrophyEmoji(ex.hasTrophy)}</span>}
                  <span className="badge badge-green" style={{ marginLeft: 8 }}>Booth {ex.boothNumber}</span>
                </h4>
                <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                  <button
                    className="btn btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExhibitorTrophy(ex);
                    }}
                    title={getTrophyButtonStyle(ex.hasTrophy).title}
                    style={{ background: getTrophyButtonStyle(ex.hasTrophy).background, border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-sm)', color: getTrophyButtonStyle(ex.hasTrophy).color, width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all var(--transition-fast)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={ex.hasTrophy && ex.hasTrophy !== 'none' ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                      <path d="M4 22h16"/>
                      <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"/>
                      <path d="M12 2a7.7 7.7 0 0 1 7.54 8H4.46A7.7 7.7 0 0 1 12 2z"/>
                    </svg>
                  </button>
                  <button 
                    className="btn btn-icon" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      openForm(ex.id, { name: ex.name, description: ex.description || '', boothNumber: ex.boothNumber || '', details: ex.details || '', hasTrophy: ex.hasTrophy }); 
                    }}
                    title="Edit Exhibitor"
                    style={{ background: 'rgba(246, 146, 30, 0.1)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-sm)', color: '#F6921E', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/>
                    </svg>
                  </button>
                  <button 
                    className="btn btn-icon" 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteExhibitor(ex.id);
                    }} 
                    title="Delete Exhibitor"
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
                  <div className="form-group">
                    <label className="form-label" htmlFor="exhibitor-has-trophy">Trophy Rank</label>
                    <select 
                      className="form-input" 
                      id="exhibitor-has-trophy"
                      value={typeof formData.hasTrophy === 'boolean' ? (formData.hasTrophy ? 'gold' : 'none') : (formData.hasTrophy || 'none')} 
                      onChange={e => handleFormChange('hasTrophy', e.target.value)}
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="none">None</option>
                      <option value="bronze">🥉 Bronze</option>
                      <option value="silver">🥈 Silver</option>
                      <option value="gold">🏆 Gold</option>
                    </select>
                  </div>
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
                    if (file.size > 1024 * 1024) {
                      alert("Image is too large. Please select an image under 1MB.");
                      return;
                    }
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label 
                  htmlFor="venue-map-upload-input" 
                  className="btn btn-primary" 
                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', margin: 0 }}
                >
                  📤 Choose Map Image
                </label>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Max 1MB</span>
              </div>

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
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="btn btn-icon"
                    onClick={() => openCollectionsManager(v)}
                    title="Manage Collections"
                    style={{ background: 'rgba(59, 130, 246, 0.1)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-sm)', color: '#3B82F6', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 12 20 22 4 22 4 12"/>
                      <rect x="2" y="7" width="20" height="5"/>
                      <line x1="12" y1="22" x2="12" y2="7"/>
                      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
                      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                    </svg>
                  </button>
                  <button
                    className="btn btn-icon"
                    onClick={() => { openForm(v.id, { title: v.title, description: v.description || '', details: v.details || '', displayFrom: v.displayFrom ? toLocalDatetimeString(v.displayFrom) : '', displayTo: v.displayTo ? toLocalDatetimeString(v.displayTo) : '' }, v.requiredScanIds); }}
                    title="Edit Voucher"
                    style={{ background: 'rgba(246, 146, 30, 0.1)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-sm)', color: '#F6921E', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/>
                    </svg>
                  </button>
                  <button
                    className="btn btn-icon"
                    onClick={() => openManageScanIds(v)}
                    title="Manage Scan IDs"
                    style={{ background: 'rgba(16, 185, 129, 0.1)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-sm)', color: '#10B981', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                      <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                      <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                      <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                      <rect x="7" y="7" width="10" height="10" rx="1"/>
                    </svg>
                  </button>
                  <button
                    className="btn btn-icon"
                    onClick={() => openScanLogs(v)}
                    title="Scan Logs"
                    style={{ background: 'rgba(139, 92, 246, 0.1)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-sm)', color: '#8B5CF6', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10 9 9 9 8 9"/>
                    </svg>
                  </button>
                  <button
                    className="btn btn-icon"
                    onClick={() => deleteVoucher(v.id)}
                    title="Delete Voucher"
                    style={{ background: 'rgba(255, 107, 107, 0.1)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-sm)', color: 'var(--color-accent-coral)', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <p className="admin-card-desc">{v.description}</p>
              <span className="admin-card-date" style={{ display: 'block', marginTop: 4, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                🕒 Display: {v.displayFrom && v.displayTo ? `${formatDatetimeDDMMMYYYY(v.displayFrom)} - ${formatDatetimeDDMMMYYYY(v.displayTo)}` : 'Always active'}
              </span>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 8 }}>
                <span style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Required scans ({v.requiredScanIds?.length || 0}):</span>
                {(!v.scanItems || v.scanItems.length === 0) ? (
                  <ul style={{ paddingLeft: '16px', margin: '2px 0', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {v.requiredScanIds.map((scanId, sIdx) => (
                      <li key={sIdx}>{scanId}</li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                    {v.scanItems.map((item, sIdx) => (
                      <div key={sIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                        {item.stampImageUrl ? (
                          <img src={item.stampImageUrl} alt={item.scanId} style={{ width: '24px', height: '24px', borderRadius: '4px', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '14px' }}>🏷️</span>
                        )}
                        <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{item.scanId}</span>
                        {item.urlLink && (
                          <a href={item.urlLink.startsWith('http') ? item.urlLink : `https://${item.urlLink}`} target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6', textDecoration: 'none', marginLeft: '2px' }}>
                            🔗 {item.urlName || 'Link'}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                      Add/Scan
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
                            <span style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                              🕒 Collected: {formatDatetimeDDMMMYYYY(visitor.collectedAt)}
                            </span>
                            <span style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                              🎁 Gifted By: {visitor.giftedBy || 'Self-collected'}
                            </span>
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

          {showScanLogsModal && activeVoucherForScans && (
            <>
              <div className="modal-overlay" onClick={() => setShowScanLogsModal(false)} />
              <div className="modal-content">
                <div className="modal-handle" />
                <div className="admin-form animate-scale-in" style={{ marginTop: 0 }}>
                  <h4>Scan Logs: {activeVoucherForScans.title}</h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Scans ({scanLogs.length})</label>
                    {scanLogsLoading && scanLogs.length === 0 ? (
                      <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textAlign: 'center', margin: '12px 0' }}>Loading...</p>
                    ) : scanLogs.length === 0 ? (
                      <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textAlign: 'center', margin: '12px 0', fontStyle: 'italic' }}>No scans recorded for this voucher yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {scanLogs.map(log => (
                          <div key={log.id} style={{ padding: '10px 12px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-sm)' }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{log.email}</span>
                              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{formatDatetimeDDMMMYYYY(log.scannedAt)}</span>
                            </div>
                            <div style={{ wordBreak: 'break-all', fontSize: 'var(--font-size-xs)' }}>
                              <span style={{ color: 'var(--color-text-tertiary)', marginRight: '6px', fontWeight: 600 }}>Scanned ID:</span>
                              <span className="badge badge-blue" style={{ display: 'inline-block', wordBreak: 'break-all', whiteSpace: 'normal', height: 'auto', padding: '4px 8px', lineHeight: '1.4' }}>{log.scanId}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="form-actions" style={{ marginTop: 'var(--space-4)' }}>
                    <button className="btn btn-secondary btn-full" type="button" onClick={() => setShowScanLogsModal(false)}>Close</button>
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
                  
                  <div className="form-actions">
                    <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={saveVoucher}>Save</button>
                  </div>
                </div>
              </div>
            </>
          )}
          {showManageScanIdsModal && activeVoucherForScanIds && (
            <>
              <div className="modal-overlay" onClick={() => setShowManageScanIdsModal(false)} />
              <div className="modal-content" style={{ maxWidth: '540px', width: '90%' }}>
                <div className="modal-handle" />
                <div className="admin-form animate-scale-in" style={{ marginTop: 0 }}>
                  <h4 style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', marginBottom: 'var(--space-1)' }}>
                    🎯 Manage Scan IDs: {activeVoucherForScanIds.title}
                  </h4>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>
                    Add or update required scan IDs, stamp images, and external website links for this voucher.
                  </p>

                  {/* List of Scan Items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', marginBottom: 'var(--space-4)' }}>
                    {scanItemsList.length === 0 ? (
                      <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', fontStyle: 'italic', textAlign: 'center', margin: '12px 0' }}>
                        No scan IDs added yet. Add one below.
                      </p>
                    ) : (
                      scanItemsList.map((item, idx) => (
                        <div key={idx} style={{ padding: '10px 12px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                          {editingScanItemIdx === idx ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                  className="form-input"
                                  placeholder="Scan ID *"
                                  value={editingScanItem.scanId}
                                  onChange={e => setEditingScanItem(prev => ({ ...prev, scanId: e.target.value }))}
                                  style={{ flex: 1, fontSize: 'var(--font-size-sm)' }}
                                />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {editingScanItem.stampImageUrl ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <img src={editingScanItem.stampImageUrl} alt="Stamp" style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover' }} />
                                    <button type="button" className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => setEditingScanItem(prev => ({ ...prev, stampImageUrl: '' }))}>Remove Stamp</button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <label className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      📷 Upload Stamp Image
                                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleStampImageUpload(e, true)} />
                                    </label>
                                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Max 1MB</span>
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                  className="form-input"
                                  placeholder="Name of URL (e.g. Exhibitor Site)"
                                  value={editingScanItem.urlName || ''}
                                  onChange={e => setEditingScanItem(prev => ({ ...prev, urlName: e.target.value }))}
                                  style={{ flex: 1, fontSize: 'var(--font-size-xs)' }}
                                />
                                <input
                                  className="form-input"
                                  placeholder="External URL Link (e.g. https://...)"
                                  value={editingScanItem.urlLink || ''}
                                  onChange={e => setEditingScanItem(prev => ({ ...prev, urlLink: e.target.value }))}
                                  style={{ flex: 1, fontSize: 'var(--font-size-xs)' }}
                                />
                              </div>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                                <button className="btn btn-secondary" type="button" onClick={() => setEditingScanItemIdx(null)} style={{ padding: '4px 10px', fontSize: '11px' }}>Cancel</button>
                                <button className="btn btn-primary" type="button" onClick={() => saveScanItemEdit(idx)} style={{ padding: '4px 12px', fontSize: '11px' }}>Save Item</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                {item.stampImageUrl ? (
                                  <img src={item.stampImageUrl} alt="Stamp" style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover', border: '1px solid var(--color-border)' }} />
                                ) : (
                                  <div style={{ width: '36px', height: '36px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🏷️</div>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>{item.scanId}</span>
                                  {item.urlLink && (
                                    <a href={item.urlLink.startsWith('http') ? item.urlLink : `https://${item.urlLink}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#3B82F6', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      🔗 {item.urlName || item.urlLink}
                                    </a>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn btn-secondary" type="button" onClick={() => startScanItemEdit(idx, item)} style={{ padding: '4px 10px', fontSize: '11px' }}>Edit</button>
                                <button className="btn btn-icon" type="button" onClick={() => deleteScanItem(idx)} style={{ background: 'rgba(255, 107, 107, 0.1)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-sm)', color: 'var(--color-accent-coral)', fontSize: '12px', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add New Scan ID Form */}
                  <div style={{ border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: 'var(--space-4)', background: 'rgba(255,255,255,0.02)' }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>+ Add New Scan Item</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input
                        className="form-input"
                        placeholder="Scan ID * (e.g. BOOTH_01)"
                        value={newScanItem.scanId}
                        onChange={e => setNewScanItem(prev => ({ ...prev, scanId: e.target.value }))}
                        style={{ fontSize: 'var(--font-size-sm)' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {newScanItem.stampImageUrl ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img src={newScanItem.stampImageUrl} alt="Stamp preview" style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover' }} />
                            <button type="button" className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => setNewScanItem(prev => ({ ...prev, stampImageUrl: '' }))}>Remove Stamp</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              📷 Upload Stamp Image
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleStampImageUpload(e, false)} />
                            </label>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Max 1MB</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          className="form-input"
                          placeholder="Name of URL (e.g. Exhibitor Website)"
                          value={newScanItem.urlName || ''}
                          onChange={e => setNewScanItem(prev => ({ ...prev, urlName: e.target.value }))}
                          style={{ flex: 1, fontSize: 'var(--font-size-xs)' }}
                        />
                        <input
                          className="form-input"
                          placeholder="External URL Link (e.g. https://example.com)"
                          value={newScanItem.urlLink || ''}
                          onChange={e => setNewScanItem(prev => ({ ...prev, urlLink: e.target.value }))}
                          style={{ flex: 1, fontSize: 'var(--font-size-xs)' }}
                        />
                      </div>
                      <button className="btn btn-primary" type="button" onClick={addScanItem} style={{ marginTop: '4px', padding: '8px 14px', fontSize: 'var(--font-size-xs)' }}>
                        + Add Scan Item to List
                      </button>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button className="btn btn-secondary" type="button" onClick={() => setShowManageScanIdsModal(false)}>Cancel</button>
                    <button className="btn btn-primary" type="button" onClick={saveManageScanIds} disabled={savingScanIds}>
                      {savingScanIds ? 'Saving...' : 'Save Scan IDs'}
                    </button>
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
      {section === 'about-us' && selectedExhibition && (
        <div className="admin-section animate-fade-in">
          <div className="section-header">
            <h3 className="section-title">ℹ️ Edit About Us Page</h3>
          </div>
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            {/* Rich Text Toolbar */}
            <div className="editor-toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', borderBottom: 'none', borderTopLeftRadius: 'var(--radius-md)', borderTopRightRadius: 'var(--radius-md)', alignItems: 'center' }}>
              
              {/* Font Family Select */}
              <select 
                className="form-input" 
                style={{ width: 'auto', padding: '4px 8px', fontSize: 'var(--font-size-xs)', height: '32px', cursor: 'pointer' }}
                onChange={(e) => applyFormat('fontName', e.target.value)}
                defaultValue="Arial"
              >
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="Georgia">Georgia</option>
                <option value="Outfit">Outfit</option>
                <option value="Inter">Inter</option>
              </select>

              {/* Font Size Select */}
              <select 
                className="form-input" 
                style={{ width: 'auto', padding: '4px 8px', fontSize: 'var(--font-size-xs)', height: '32px', cursor: 'pointer' }}
                onChange={(e) => applyFormat('fontSize', e.target.value)}
                defaultValue="3"
              >
                <option value="1">Small</option>
                <option value="3">Normal</option>
                <option value="5">Large</option>
                <option value="6">Extra Large</option>
              </select>

              {/* Font Color Select */}
              <select 
                className="form-input" 
                style={{ width: 'auto', padding: '4px 8px', fontSize: 'var(--font-size-xs)', height: '32px', cursor: 'pointer' }}
                onChange={(e) => applyFormat('foreColor', e.target.value)}
                defaultValue="#FFFFFF"
              >
                <option value="#FFFFFF">White</option>
                <option value="#F6921E">Orange</option>
                <option value="#3B82F6">Blue</option>
                <option value="#10B981">Green</option>
                <option value="#FF6B6B">Coral</option>
                <option value="#000000">Black</option>
              </select>

              {/* Bold, Italic, Underline Toggles */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', minWidth: '32px', height: '32px', fontWeight: 'bold' }} onClick={() => applyFormat('bold')}>B</button>
                <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', minWidth: '32px', height: '32px', fontStyle: 'italic' }} onClick={() => applyFormat('italic')}>I</button>
                <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', minWidth: '32px', height: '32px', textDecoration: 'underline' }} onClick={() => applyFormat('underline')}>U</button>
              </div>

              {/* Table Functions */}
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ width: '32px', height: '32px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} 
                  onClick={insertTable}
                  title="Create Table"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <line x1="9" y1="3" x2="9" y2="21"/>
                    <line x1="15" y1="3" x2="15" y2="21"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="3" y1="15" x2="21" y2="15"/>
                  </svg>
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ width: '32px', height: '32px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} 
                  onClick={addRow}
                  title="Add Row"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="3" y1="11" x2="21" y2="11"/>
                    <line x1="12" y1="15" x2="12" y2="19"/>
                    <line x1="10" y1="17" x2="14" y2="17"/>
                  </svg>
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ width: '32px', height: '32px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} 
                  onClick={addColumn}
                  title="Add Column"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="11" y1="3" x2="11" y2="21"/>
                    <line x1="15" y1="12" x2="19" y2="12"/>
                    <line x1="17" y1="10" x2="17" y2="14"/>
                  </svg>
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ width: '32px', height: '32px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent-coral)' }} 
                  onClick={deleteRow}
                  title="Delete Row"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="3" y1="11" x2="21" y2="11"/>
                    <line x1="10" y1="16" x2="14" y2="16"/>
                  </svg>
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ width: '32px', height: '32px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent-coral)' }} 
                  onClick={deleteColumn}
                  title="Delete Column"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="11" y1="3" x2="11" y2="21"/>
                    <line x1="15" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ width: '32px', height: '32px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent-coral)' }} 
                  onClick={deleteTable}
                  title="Delete Table"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="9" y1="3" x2="9" y2="21"/>
                    <line x1="15" y1="3" x2="15" y2="21"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="3" y1="15" x2="21" y2="15"/>
                    <path d="M18 6l-12 12M6 6l12 12" stroke="var(--color-accent-coral)" strokeWidth="2.5"/>
                  </svg>
                </button>
              </div>

              {/* Insert Image Actions */}
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)', height: '32px' }} 
                  onClick={() => {
                    const url = prompt("Enter image URL:");
                    if (url) applyFormat('insertImage', url);
                  }}
                >
                  🔗 Image URL
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label 
                    className="btn btn-secondary" 
                    style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)', height: '32px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', margin: 0 }}
                  >
                    📁 Upload Image
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 1024 * 1024) {
                          alert("Image is too large. Please select an image under 1MB.");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                          const base64 = event.target?.result as string;
                          if (!base64) return;
                          
                          try {
                            const res = await postData('/api/admin/about-us/upload', {
                              exhibitionId: selectedExhibition,
                              image: base64
                            });
                            if (res.success && res.url) {
                              setAboutUsUploadedImages(prev => [res.url, ...prev]);
                              alert("Upload successful! You can copy the web link from the list below.");
                            } else {
                              alert(res.error || "Failed to upload image.");
                            }
                          } catch (err) {
                            console.error(err);
                            alert("Upload failed.");
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>Max 1MB</span>
                </div>
              </div>
            </div>

            {/* Editable Content Area */}
            <div 
              ref={editorRef}
              contentEditable
              style={{
                background: 'var(--color-bg-input)',
                border: '1px solid var(--color-border)',
                borderBottomLeftRadius: 'var(--radius-md)',
                borderBottomRightRadius: 'var(--radius-md)',
                padding: '16px',
                minHeight: '300px',
                maxHeight: '500px',
                overflowY: 'auto',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-base)',
                lineHeight: 1.7,
                textAlign: 'left',
                outline: 'none'
              }}
            />

            {/* List of Available Image Links */}
            <div style={{ marginTop: 'var(--space-4)', background: 'var(--color-bg-secondary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <h4 style={{ margin: 0, marginBottom: 'var(--space-2)', fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🖼️ Available Image Weblinks
              </h4>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, marginBottom: 'var(--space-3)' }}>
                Upload images using the Upload Image button above, then copy their links to insert them into your text content via the Image URL button.
              </p>
              {aboutUsUploadedImages.length === 0 ? (
                <div style={{ padding: 'var(--space-3)', textAlign: 'center', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--color-border)' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>No uploaded images yet</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                  {aboutUsUploadedImages.map((url, idx) => {
                    const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${url}` : url;
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--color-bg-tertiary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                        <img 
                          src={url} 
                          alt="" 
                          style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-input)' }} 
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <input 
                            className="form-input" 
                            readOnly 
                            value={fullUrl} 
                            style={{ margin: 0, height: '28px', fontSize: '11px', padding: '4px 8px', textOverflow: 'ellipsis', background: 'var(--color-bg-input)' }} 
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 12px', fontSize: 'var(--font-size-xs)', height: '28px', minWidth: '80px' }}
                          onClick={() => {
                            navigator.clipboard.writeText(fullUrl);
                            alert("Weblink copied to clipboard!");
                          }}
                        >
                          Copy Link
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Save Action */}
            <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-primary" 
                onClick={saveAboutUs}
                disabled={aboutUsLoading}
                style={{ padding: '8px 24px' }}
              >
                {aboutUsLoading ? 'Saving...' : 'Save About Us'}
              </button>
            </div>
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
