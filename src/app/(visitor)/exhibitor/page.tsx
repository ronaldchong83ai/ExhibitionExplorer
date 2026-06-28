'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Exhibition, Exhibitor } from '@/types';
import { formatDateDDMMMYYYY } from '@/lib/date';

export default function ExhibitorPage() {
  const router = useRouter();
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [selectedExhibition, setSelectedExhibition] = useState<Exhibition | null>(null);
  
  // Profiles list state
  const [profiles, setProfiles] = useState<Exhibitor[]>([]);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileFormData, setProfileFormData] = useState({
    name: '',
    description: '',
    boothNumber: '',
    details: '',
    imageUrl: '',
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 1. Fetch exhibitions on mount
  useEffect(() => {
    const fetchExhibitions = async () => {
      try {
        const res = await fetch('/api/home');
        const data = await res.json();
        if (data.success && data.data) {
          setExhibitions(data.data.exhibitions || []);
        }
      } catch (err) {
        console.error('Failed to load exhibitions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchExhibitions();
  }, []);

  // 2. Fetch profiles when selectedExhibition changes
  useEffect(() => {
    if (!selectedExhibition) return;
    
    const fetchExhibitorData = async () => {
      setLoading(true);
      try {
        const profileRes = await fetch(`/api/exhibitor/profile?exhibitionId=${selectedExhibition.id}`);
        const profileData = await profileRes.json();
        if (profileData.success) {
          setProfiles(profileData.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch exhibitor data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchExhibitorData();
  }, [selectedExhibition]);

  // Handle Image Conversion to Base64
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setProfileFormData(prev => ({ ...prev, imageUrl: base64String }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Save Profile Handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExhibition) return;

    setSubmitting(true);
    try {
      const url = '/api/exhibitor/profile';
      const method = editingProfileId ? 'PUT' : 'POST';
      const body = editingProfileId 
        ? { id: editingProfileId, ...profileFormData }
        : { exhibitionId: selectedExhibition.id, ...profileFormData };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh profiles list
        const profileRes = await fetch(`/api/exhibitor/profile?exhibitionId=${selectedExhibition.id}`);
        const profileData = await profileRes.json();
        if (profileData.success) {
          setProfiles(profileData.data || []);
        }
        setShowProfileForm(false);
        setEditingProfileId(null);
        setProfileFormData({ name: '', description: '', boothNumber: '', details: '', imageUrl: '' });
      } else {
        alert(data.error || 'Failed to save profile');
      }
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Add/Edit Form
  const handleOpenProfileForm = (p?: Exhibitor) => {
    if (p) {
      setEditingProfileId(p.id);
      setProfileFormData({
        name: p.name,
        description: p.description,
        boothNumber: p.boothNumber,
        details: p.details,
        imageUrl: p.imageUrl,
      });
    } else {
      setEditingProfileId(null);
      setProfileFormData({
        name: '',
        description: '',
        boothNumber: '',
        details: '',
        imageUrl: '',
      });
    }
    setShowProfileForm(true);
  };

  if (loading && exhibitions.length === 0) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ height: 100, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 100, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 100 }} />
      </div>
    );
  }

  // --- 1. Exhibition Selection List view ---
  if (!selectedExhibition) {
    return (
      <div className="page-container">
        <h2 className="page-title">💼 Exhibitor Dashboard</h2>
        <p className="page-subtitle">Select an exhibition below to manage your profiles.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {exhibitions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💼</div>
              <p className="empty-state-text">No exhibitions registered in the system.</p>
            </div>
          ) : (
            exhibitions.map((ex, idx) => (
              <div
                key={ex.id}
                className={`card card-interactive animate-slide-up stagger-${Math.min(idx + 1, 5)}`}
                onClick={() => setSelectedExhibition(ex)}
                style={{ padding: 'var(--space-5)', cursor: 'pointer', border: '1px solid var(--color-border-accent)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <h3 style={{ margin: 0, fontWeight: 600, fontSize: 'var(--font-size-lg)' }}>{ex.title}</h3>
                  {ex.enabled === false && <span className="badge badge-coral">Disabled</span>}
                </div>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-3)' }}>{ex.description}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-accent-cyan)', fontWeight: 500 }}>
                  <span>📅 {formatDateDDMMMYYYY(ex.eventPeriodFrom)} — {formatDateDDMMMYYYY(ex.eventPeriodTo)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // --- 2. Exhibition Specific Dashboard View ---
  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <button className="btn btn-secondary" onClick={() => setSelectedExhibition(null)} style={{ fontSize: 'var(--font-size-sm)' }}>
          ← Select Exhibition
        </button>
        {selectedExhibition.enabled === false && <span className="badge badge-coral">Disabled Exhibition</span>}
      </div>

      <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, margin: 0, marginBottom: '2px', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        {selectedExhibition.title}
      </h2>
      <p style={{ margin: 0, color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-5)' }}>
        Dashboard for managing your exhibitor credentials. Click on an exhibitor profile to manage its products.
      </p>

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : (
        <div className="animate-fade-in">
          {showProfileForm ? (
            <form onSubmit={handleSaveProfile} className="card" style={{ padding: 'var(--space-5)', border: '1px solid var(--color-border-accent)' }}>
              <h3 style={{ margin: '0 0 var(--space-4)' }}>{editingProfileId ? 'Edit' : 'Register'} Exhibitor Profile</h3>
              
              <div className="form-group">
                <label className="form-label">Title / Company Name</label>
                <input
                  className="form-input"
                  value={profileFormData.name}
                  onChange={e => setProfileFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  placeholder="e.g., NeuraTech Solutions"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Booth Number</label>
                <input
                  className="form-input"
                  value={profileFormData.boothNumber}
                  onChange={e => setProfileFormData(prev => ({ ...prev, boothNumber: e.target.value }))}
                  placeholder="e.g., A-101"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Profile Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                  id="profile-image-upload"
                />
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <label htmlFor="profile-image-upload" className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
                    Choose File
                  </label>
                  {profileFormData.imageUrl && (
                    <img 
                      src={profileFormData.imageUrl} 
                      alt="Preview" 
                      style={{ width: '60px', height: '60px', borderRadius: 'var(--radius-md)', objectFit: 'cover', border: '1px solid var(--color-border)' }} 
                    />
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Short Description</label>
                <textarea
                  className="form-textarea"
                  value={profileFormData.description}
                  onChange={e => setProfileFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter a brief tag-line or summary..."
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Details / Full Profile Info</label>
                <textarea
                  className="form-textarea"
                  value={profileFormData.details}
                  onChange={e => setProfileFormData(prev => ({ ...prev, details: e.target.value }))}
                  placeholder="Enter detailed company services, products introduction..."
                  rows={5}
                />
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowProfileForm(false); setEditingProfileId(null); }} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 600 }}>My List of Exhibitors</h3>
                <button className="btn btn-primary" onClick={() => handleOpenProfileForm()}>
                  + Add
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {profiles.length === 0 ? (
                  <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                    <div className="empty-state-icon">🏢</div>
                    <h3 style={{ margin: 'var(--space-4) 0 var(--space-2)' }}>No Exhibitor Info Registered</h3>
                    <p className="empty-state-text" style={{ marginBottom: 'var(--space-4)' }}>
                      You have not registered any exhibitor profile for this exhibition yet.
                    </p>
                    <button className="btn btn-primary" onClick={() => handleOpenProfileForm()}>
                      + Register Exhibitor Profile
                    </button>
                  </div>
                ) : (
                  profiles.map((p, idx) => (
                    <div 
                      key={p.id} 
                      className={`card card-interactive animate-scale-in stagger-${Math.min(idx + 1, 5)}`}
                      onClick={() => router.push(`/exhibitors/${p.id}`)}
                      style={{ padding: 'var(--space-4)', border: '1px solid var(--color-border-accent)', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', gap: '16px', marginBottom: 'var(--space-3)' }}>
                        {p.imageUrl ? (
                          <img 
                            src={p.imageUrl} 
                            alt={p.name} 
                            style={{ width: '60px', height: '60px', borderRadius: 'var(--radius-md)', objectFit: 'cover', border: '1px solid var(--color-border)' }} 
                          />
                        ) : (
                          <div style={{ width: '60px', height: '60px', borderRadius: 'var(--radius-md)', background: 'var(--gradient-cool)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.5rem', color: 'white' }}>
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 700 }}>{p.name}</h3>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                className="btn btn-secondary" 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  handleOpenProfileForm(p); 
                                }} 
                                style={{ padding: '2px 8px', fontSize: 'var(--font-size-xs)' }}
                              >
                                ✏️ Edit
                              </button>
                              <button 
                                className="btn btn-icon" 
                                onClick={async (e) => { 
                                  e.stopPropagation(); 
                                  if (!confirm("Are you sure you want to delete this exhibitor profile?")) return;
                                  try {
                                    const res = await fetch(`/api/exhibitor/profile?id=${p.id}`, { method: 'DELETE' }).then(r => r.json());
                                    if (res.success) {
                                      const profileRes = await fetch(`/api/exhibitor/profile?exhibitionId=${selectedExhibition.id}`);
                                      const profileData = await profileRes.json();
                                      if (profileData.success) {
                                        setProfiles(profileData.data || []);
                                      }
                                    } else {
                                      alert(res.error || 'Failed to delete profile');
                                    }
                                  } catch (err) {
                                    console.error(err);
                                    alert('Error deleting profile');
                                  }
                                }} 
                                style={{ background: 'rgba(255, 107, 107, 0.1)', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: 'var(--radius-sm)', color: 'var(--color-accent-coral)', width: '24px', height: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                          <span className="badge badge-green" style={{ display: 'inline-block', marginTop: '4px' }}>Booth {p.boothNumber || 'N/A'}</span>
                          <p style={{ margin: '8px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                            {p.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
