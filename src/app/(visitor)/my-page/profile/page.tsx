'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { User, SessionUser } from '@/types';

export default function ProfileDetailsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState<Partial<User>>({
    email: '',
    name: '',
    contact: '',
    profilePic: null,
    dob: '',
    occupation: '',
    citizenship: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/my-profile')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setProfile(data.data);
        } else {
          setError(data.error || 'Failed to load profile details');
        }
      })
      .catch(err => {
        console.error(err);
        setError('An error occurred while loading profile details');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleInputChange = (field: keyof User, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (limit to 1MB for base64 storage)
    if (file.size > 1024 * 1024) {
      alert("Image is too large. Please select an image under 1MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      setProfile(prev => ({ ...prev, profilePic: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.name?.trim() || !profile.contact?.trim()) {
      setError("Name and contact number are required.");
      return;
    }

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch('/api/my-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      }).then(r => r.json());

      if (res.success) {
        setSuccess(true);
        // Dispatch a custom event to notify layout sidebar to reload session
        window.dispatchEvent(new Event('session-update'));
        setTimeout(() => {
          setSuccess(false);
        }, 3000);
      } else {
        setError(res.error || "Failed to update profile");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <h2 className="page-title">👤 My Profile Details</h2>
        <div className="skeleton" style={{ height: 400 }} />
      </div>
    );
  }

  const avatarChar = profile.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="page-container">
      <div className="back-nav" style={{ marginBottom: 'var(--space-4)' }}>
        <button onClick={() => router.push('/my-page')} className="back-button" aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to My Page
        </button>
      </div>

      <h2 className="page-title">👤 My Profile Details</h2>
      <p className="page-subtitle">Update your profile picture and personal information</p>

      {error && <div className="error-banner animate-fade-in" style={{ marginBottom: 'var(--space-4)', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', color: 'rgb(248, 113, 113)', fontSize: 'var(--font-size-sm)' }}>⚠️ {error}</div>}
      {success && <div className="success-banner animate-fade-in" style={{ marginBottom: 'var(--space-4)', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-md)', color: 'rgb(110, 231, 183)', fontSize: 'var(--font-size-sm)' }}>✅ Profile updated successfully!</div>}

      <div className="card profile-card animate-slide-up">
        <form onSubmit={handleSubmit}>
          {/* Avatar Upload Container */}
          <div className="avatar-section">
            <div className="avatar-wrapper" onClick={handleImageClick}>
              {profile.profilePic ? (
                <img src={profile.profilePic} alt="Profile" className="profile-img" />
              ) : (
                <div className="avatar-placeholder">{avatarChar}</div>
              )}
              <div className="avatar-overlay">
                <span>📸 Upload</span>
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
            <p className="avatar-tip">Tap to upload a profile image (Max 1MB)</p>
          </div>

          {/* Form Fields */}
          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label" htmlFor="profile-email">Email Address (Unique Account ID)</label>
            <input
              id="profile-email"
              type="email"
              className="form-input"
              value={profile.email || ''}
              disabled
              style={{ opacity: 0.6, cursor: 'not-allowed', background: 'rgba(255,255,255,0.03)' }}
            />
          </div>

          {profile.email && (
            <div className="form-group" style={{ marginBottom: 'var(--space-5)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <label className="form-label" style={{ alignSelf: 'flex-start' }}>Profile QR Code (for Redemptor Scan)</label>
              <div style={{ padding: '12px', background: 'white', borderRadius: 'var(--radius-md)', display: 'inline-block', marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(profile.email)}`} 
                  alt="Email QR Code" 
                  style={{ display: 'block', width: '150px', height: '150px' }} 
                />
              </div>
              <p className="avatar-tip" style={{ marginTop: '8px' }}>Present this QR code to the booth redemptor to redeem your voucher.</p>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label" htmlFor="profile-name">Full Name *</label>
            <input
              id="profile-name"
              type="text"
              className="form-input"
              value={profile.name || ''}
              onChange={e => handleInputChange('name', e.target.value)}
              required
              disabled={saving}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label" htmlFor="profile-contact">Contact Number *</label>
            <input
              id="profile-contact"
              type="text"
              className="form-input"
              value={profile.contact || ''}
              onChange={e => handleInputChange('contact', e.target.value)}
              required
              disabled={saving}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label" htmlFor="profile-dob">Date of Birth</label>
            <input
              id="profile-dob"
              type="date"
              className="form-input"
              value={profile.dob || ''}
              onChange={e => handleInputChange('dob', e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label" htmlFor="profile-occupation">Occupation</label>
            <input
              id="profile-occupation"
              type="text"
              className="form-input"
              value={profile.occupation || ''}
              onChange={e => handleInputChange('occupation', e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label" htmlFor="profile-citizenship">Citizenship</label>
            <input
              id="profile-citizenship"
              type="text"
              className="form-input"
              value={profile.citizenship || ''}
              onChange={e => handleInputChange('citizenship', e.target.value)}
              disabled={saving}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={saving}
            style={{ marginTop: 'var(--space-4)', width: '100%', height: 'auto', padding: '12px' }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .profile-card {
          padding: var(--space-6) !important;
          max-width: 500px;
          margin: 0 auto;
        }
        .avatar-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: var(--space-5);
        }
        .avatar-wrapper {
          position: relative;
          width: 96px;
          height: 96px;
          border-radius: 50%;
          overflow: hidden;
          cursor: pointer;
          border: 3px solid var(--color-border);
          background: var(--color-bg-input);
          transition: all 0.2s ease;
        }
        .avatar-wrapper:hover {
          border-color: var(--color-accent-blue);
          transform: scale(1.03);
        }
        .profile-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .avatar-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.2rem;
          font-weight: 700;
          color: var(--color-text-primary);
          background: var(--gradient-primary);
        }
        .avatar-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(0, 0, 0, 0.6);
          color: white;
          font-size: 10px;
          text-align: center;
          padding: 4px 0;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .avatar-wrapper:hover .avatar-overlay {
          opacity: 1;
        }
        .avatar-tip {
          font-size: var(--font-size-xs);
          color: var(--color-text-tertiary);
          margin-top: 8px;
          margin-bottom: 0;
        }
        .back-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          cursor: pointer;
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          transition: background-color 0.2s;
        }
        .back-button:hover {
          background-color: var(--color-bg-input);
          color: var(--color-text-primary);
        }
      `}</style>
    </div>
  );
}
