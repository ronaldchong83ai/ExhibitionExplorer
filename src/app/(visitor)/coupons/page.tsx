'use client';

import { useState, useEffect } from 'react';
import type { Exhibition, SessionUser } from '@/types';

interface VoucherWithProgress {
  id: string;
  title: string;
  description: string;
  details: string;
  requiredScanIds: string[];
  collectedCount: number;
  totalRequired: number;
  isComplete: boolean;
  isCollected?: boolean;
}

export default function CouponsPage() {
  const [vouchers, setVouchers] = useState<VoucherWithProgress[]>([]);
  const [exhibition, setExhibition] = useState<Exhibition | null>(null);
  const [selectedExhibitionId, setSelectedExhibitionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);

  // Voucher Collections Manager states (for Redemptors)
  const [showCollectionsModal, setShowCollectionsModal] = useState(false);
  const [activeVoucherForCollections, setActiveVoucherForCollections] = useState<any>(null);
  const [collectedVisitors, setCollectedVisitors] = useState<any[]>([]);
  const [newVisitorEmail, setNewVisitorEmail] = useState('');
  const [collectionsLoading, setCollectionsLoading] = useState(false);

  // Load session user and selected exhibition from localStorage
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.success) setUser(data.data);
      })
      .catch(err => console.error("Session load error:", err));

    const saved = localStorage.getItem('selectedExhibitionId');
    if (saved) setSelectedExhibitionId(saved);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedExhibitionId) {
      params.set('exhibitionId', selectedExhibitionId);
    }
    fetch(`/api/coupons?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setVouchers(data.data.vouchers || []);
          setExhibition(data.data.exhibition || null);
        }
      })
      .catch(err => {
        console.error("Failed to load coupons:", err);
      })
      .finally(() => setLoading(false));
  }, [selectedExhibitionId]);

  const openCollectionsManager = async (v: any) => {
    setActiveVoucherForCollections(v);
    setShowCollectionsModal(true);
    setNewVisitorEmail('');
    setCollectionsLoading(true);
    try {
      const res = await fetch(`/api/vouchers/${v.id}/collections`).then(r => r.json());
      if (res.success) {
        setCollectedVisitors(res.data || []);
      } else {
        alert(res.error || "Failed to load collections");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load collections");
    } finally {
      setCollectionsLoading(false);
    }
  };

  const addVisitorToCollections = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVoucherForCollections || !newVisitorEmail.trim()) return;

    setCollectionsLoading(true);
    try {
      const res = await fetch(`/api/vouchers/${activeVoucherForCollections.id}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newVisitorEmail.trim() })
      }).then(r => r.json());

      if (res.success && res.data) {
        setCollectedVisitors(prev => [res.data, ...prev]);
        setNewVisitorEmail('');
      } else {
        alert(res.error || "Failed to add visitor");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add visitor");
    } finally {
      setCollectionsLoading(false);
    }
  };

  const deleteVisitorFromCollections = async (userId: string) => {
    if (!activeVoucherForCollections) return;
    if (!confirm("Are you sure you want to remove this visitor from the collected list?")) return;

    setCollectionsLoading(true);
    try {
      const res = await fetch(`/api/vouchers/${activeVoucherForCollections.id}/collections?userId=${userId}`, {
        method: 'DELETE'
      }).then(r => r.json());

      if (res.success) {
        setCollectedVisitors(prev => prev.filter(v => v.userId !== userId));
      } else {
        alert(res.error || "Failed to remove visitor");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to remove visitor");
    } finally {
      setCollectionsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <h2 className="page-title">🎫 Coupons & Gifts</h2>
        {[1, 2].map(i => (
          <div key={i} className="skeleton" style={{ height: 140, marginBottom: 12 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="page-container">
      <h2 className="page-title" style={{ marginBottom: exhibition ? 4 : 'var(--space-4)' }}>🎫 Coupons & Gifts</h2>
      {exhibition && (
        <p className="page-subtitle" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', marginTop: 0, marginBottom: 'var(--space-3)' }}>
          For {exhibition.title}
        </p>
      )}
      <p className="page-subtitle" style={{ marginTop: 0, marginBottom: 'var(--space-5)' }}>Collect scans at exhibition booths to redeem rewards!</p>

      {vouchers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎫</div>
          <p className="empty-state-text">No vouchers available</p>
        </div>
      ) : (
        <div className="voucher-list">
          {vouchers.map((v, idx) => {
            const isComplete = v.isComplete || v.isCollected;
            const collectedPercent = v.isCollected ? 100 : (v.collectedCount / v.totalRequired) * 100;
            return (
              <div key={v.id} className={`voucher-card card animate-slide-up stagger-${Math.min(idx + 1, 5)} ${isComplete ? 'complete' : ''} ${v.isCollected ? 'collected' : ''}`}>
                <div className="voucher-header">
                  <span className="voucher-icon">{v.isCollected ? '🎁' : v.isComplete ? '🎉' : '🎫'}</span>
                  <div className="voucher-info">
                    <h3 className="voucher-title">{v.title}</h3>
                    {v.isCollected ? (
                      <span className="badge badge-green">Collected!</span>
                    ) : v.isComplete ? (
                      <span className="badge badge-green">Redeemable!</span>
                    ) : (
                      <span className="badge badge-amber">{v.collectedCount}/{v.totalRequired} scans</span>
                    )}
                  </div>
                </div>
                <p className="voucher-desc">{v.description}</p>
                <div className="progress-bar" style={{ marginTop: 'var(--space-3)' }}>
                  <div className="progress-fill" style={{ width: `${collectedPercent}%` }} />
                </div>
                <p className="voucher-progress-text">
                  {v.isCollected ? 'Voucher collected!' : `${v.collectedCount} of ${v.totalRequired} scans collected`}
                </p>

                {user?.role === 'REDEMPTOR' && (
                  <div className="redemptor-actions" style={{ marginTop: 'var(--space-4)' }}>
                    <button className="btn btn-secondary" onClick={() => openCollectionsManager(v)} style={{ width: '100%', height: 'auto', padding: '8px 16px' }}>
                      ⚙️ Manage Collections
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCollectionsModal && activeVoucherForCollections && (
        <>
          <div className="modal-overlay" onClick={() => setShowCollectionsModal(false)} />
          <div className="modal-content">
            <div className="modal-handle" />
            <div className="admin-form animate-scale-in" style={{ marginTop: 0 }}>
              <h4 style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', marginBottom: 'var(--space-3)' }}>Manage Collections: {activeVoucherForCollections.title}</h4>
              
              {/* Add Visitor Form */}
              <form onSubmit={addVisitorToCollections} style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-4)' }}>
                <input
                  className="form-input"
                  type="email"
                  placeholder="Enter visitor's email..."
                  value={newVisitorEmail}
                  onChange={e => setNewVisitorEmail(e.target.value)}
                  required
                  style={{ flex: 1 }}
                  disabled={collectionsLoading}
                />
                <button className="btn btn-primary" type="submit" disabled={collectionsLoading}>
                  Add
                </button>
              </form>

              {/* Collections List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Collected Visitors ({collectedVisitors.length})</label>
                {collectionsLoading && collectedVisitors.length === 0 ? (
                  <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textAlign: 'center', margin: '12px 0' }}>Loading...</p>
                ) : collectedVisitors.length === 0 ? (
                  <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textAlign: 'center', margin: '12px 0', fontStyle: 'italic' }}>No visitors have collected this yet.</p>
                ) : (
                  collectedVisitors.map(visitor => (
                    <div key={visitor.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 12px', background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
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

      <style jsx>{`
        .voucher-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .voucher-card {
          padding: var(--space-5) !important;
        }
        .voucher-card.complete {
          border-color: rgba(16, 185, 129, 0.3);
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, var(--color-bg-card) 100%);
        }
        .voucher-card.collected {
          border-color: rgba(16, 185, 129, 0.5);
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, var(--color-bg-card) 100%);
        }
        .voucher-header {
          display: flex;
          gap: var(--space-3);
          margin-bottom: var(--space-3);
        }
        .voucher-icon {
          font-size: 2rem;
          flex-shrink: 0;
        }
        .voucher-info {
          flex: 1;
        }
        .voucher-title {
          font-size: var(--font-size-lg);
          font-weight: 600;
          margin-bottom: var(--space-2);
        }
        .voucher-desc {
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          line-height: 1.5;
        }
        .voucher-progress-text {
          text-align: center;
          font-size: var(--font-size-xs);
          color: var(--color-text-tertiary);
          margin-top: var(--space-2);
        }
      `}</style>
    </div>
  );
}
