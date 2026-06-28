'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { SessionUser } from '@/types';
import { formatDateDDMMMYYYY, formatDatetimeDDMMMYYYY } from '@/lib/date';

interface BookingInfo {
  id: string;
  bookingTime: string;
  isMyBooking: boolean;
  user?: {
    name: string;
    email: string;
  } | null;
}

interface FacilityWithBookings {
  id: string;
  exhibitionId: string;
  facilityName: string;
  areaNumber: string;
  periodFrom: string;
  periodTo: string;
  operatingHours?: string;
  createdAt: string;
  bookings: BookingInfo[];
}

export default function FacilityBookingPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [facilities, setFacilities] = useState<FacilityWithBookings[]>([]);
  const [selectedExhibitionId, setSelectedExhibitionId] = useState<string | null>(null);
  const [exhibition, setExhibition] = useState<{ title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null); // Holds facilityId being booked
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Tracks locally selected slots for booking: { [facilityId]: string[] (bookingTime ISO strings) }
  const [selectedSlots, setSelectedSlots] = useState<Record<string, string[]>>({});
  const [selectedFacility, setSelectedFacility] = useState<FacilityWithBookings | null>(null);

  // Keep selectedFacility updated with fresh booking/slot status from backend list
  useEffect(() => {
    if (selectedFacility) {
      const latest = facilities.find(f => f.id === selectedFacility.id);
      if (latest) {
        setSelectedFacility(latest);
      }
    }
  }, [facilities, selectedFacility]);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session').then(r => r.json());
      if (res.success && res.data) {
        setUser(res.data);
      } else {
        router.push('/login');
      }
    } catch (err) {
      console.error('Session load error:', err);
      router.push('/login');
    }
  }, [router]);

  const fetchFacilities = useCallback(async (exhId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/facilities?exhibitionId=${exhId}`).then(r => r.json());
      if (res.success && res.data) {
        setFacilities(res.data);
      } else {
        setError(res.error || 'Failed to load facilities');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while loading facilities.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
    const saved = localStorage.getItem('selectedExhibitionId');
    if (saved) {
      setSelectedExhibitionId(saved);
      fetchFacilities(saved);
      fetch(`/api/home?exhibitionId=${saved}`)
        .then(r => r.json())
        .then(res => {
          if (res.success && res.data && res.data.exhibition) {
            setExhibition(res.data.exhibition);
          }
        })
        .catch(err => console.error(err));
    } else {
      setLoading(false);
    }
  }, [checkAuth, fetchFacilities]);

  // Generate 15-minute slots between periodFrom and periodTo
  const getFacilitySlots = (facility: FacilityWithBookings) => {
    const slots: any[] = [];
    let entries: Array<{ date: string; timeFrom: string; timeTo: string }> = [];
    if (facility.operatingHours) {
      try {
        entries = JSON.parse(facility.operatingHours);
      } catch (_) {}
    }

    if (!entries || entries.length === 0) {
      // Fallback to legacy periodFrom/periodTo
      const current = new Date(facility.periodFrom);
      const end = new Date(facility.periodTo);
      const mins = current.getMinutes();
      const remainder = mins % 15;
      if (remainder !== 0) {
        current.setMinutes(mins + (15 - remainder), 0, 0);
      } else {
        current.setSeconds(0, 0);
      }

      while (current.getTime() + 15 * 60 * 1000 <= end.getTime()) {
        const slotStart = new Date(current);
        const slotEnd = new Date(current.getTime() + 15 * 60 * 1000);
        const timeISO = slotStart.toISOString();
        const existing = facility.bookings.find(b => b.bookingTime === timeISO);

        slots.push({
          timeISO,
          label: `${slotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - ${slotEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`,
          dateLabel: formatDateDDMMMYYYY(slotStart),
          bookedInfo: existing || null
        });

        current.setMinutes(current.getMinutes() + 15);
      }
      return slots;
    }

    for (const entry of entries) {
      const startLocal = new Date(`${entry.date}T${entry.timeFrom}:00`);
      const endLocal = new Date(`${entry.date}T${entry.timeTo}:00`);
      if (isNaN(startLocal.getTime()) || isNaN(endLocal.getTime())) continue;

      const current = new Date(startLocal);
      const end = new Date(endLocal);
      const mins = current.getMinutes();
      const remainder = mins % 15;
      if (remainder !== 0) {
        current.setMinutes(mins + (15 - remainder), 0, 0);
      } else {
        current.setSeconds(0, 0);
      }

      while (current.getTime() + 15 * 60 * 1000 <= end.getTime()) {
        const slotStart = new Date(current);
        const slotEnd = new Date(current.getTime() + 15 * 60 * 1000);
        const timeISO = slotStart.toISOString();
        const existing = facility.bookings.find(b => b.bookingTime === timeISO);

        slots.push({
          timeISO,
          label: `${slotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - ${slotEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`,
          dateLabel: formatDateDDMMMYYYY(slotStart),
          bookedInfo: existing || null
        });

        current.setMinutes(current.getMinutes() + 15);
      }
    }

    slots.sort((a, b) => new Date(a.timeISO).getTime() - new Date(b.timeISO).getTime());
    return slots;
  };

  const handleToggleSlotSelection = (facilityId: string, timeISO: string) => {
    setSelectedSlots(prev => {
      const currentList = prev[facilityId] || [];
      if (currentList.includes(timeISO)) {
        return {
          ...prev,
          [facilityId]: currentList.filter(t => t !== timeISO)
        };
      } else {
        return {
          ...prev,
          [facilityId]: [...currentList, timeISO]
        };
      }
    });
  };

  const handleBookSlots = async (facilityId: string) => {
    const slotsToBook = selectedSlots[facilityId] || [];
    if (slotsToBook.length === 0) return;

    setSubmitting(facilityId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          facilityId, 
          bookingTimes: slotsToBook,
          timezoneOffset: new Date().getTimezoneOffset()
        })
      }).then(r => r.json());

      if (res.success) {
        setSuccess('Your slots have been booked successfully!');
        setSelectedSlots(prev => ({ ...prev, [facilityId]: [] }));
        if (selectedExhibitionId) {
          await fetchFacilities(selectedExhibitionId);
        }
      } else {
        setError(res.error || 'Failed to book slots');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during booking.');
    } finally {
      setSubmitting(null);
    }
  };

  const handleCancelBooking = async (facilityId: string, timeISO: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    setSubmitting(facilityId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/facilities?facilityId=${facilityId}&bookingTime=${encodeURIComponent(timeISO)}`, {
        method: 'DELETE'
      }).then(r => r.json());

      if (res.success) {
        setSuccess('Your booking has been cancelled successfully.');
        if (selectedExhibitionId) {
          await fetchFacilities(selectedExhibitionId);
        }
      } else {
        setError(res.error || 'Failed to cancel booking');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while cancelling booking.');
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <h2 className="page-title">📅 Facility Booking</h2>
        <div className="skeleton" style={{ height: 120, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 180 }} />
      </div>
    );
  }

  if (!selectedExhibitionId) {
    return (
      <div className="page-container">
        <h2 className="page-title">📅 Facility Booking</h2>
        <div className="empty-state card">
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: 'var(--space-3)' }}>🏢</span>
          <p>Please select an active exhibition on the Home page first to browse available facilities.</p>
          <button className="btn btn-primary" onClick={() => router.push('/home')} style={{ marginTop: 'var(--space-3)' }}>
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const renderStyledPageTitle = (title: string) => {
    const colors = ['#F6921E', '#3B82F6', '#10B981'];
    let colorIndex = 0;
    const emojiRegex = /^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}])\s*/u;
    const match = title.match(emojiRegex);
    let emoji = '';
    let text = title;
    if (match) {
      emoji = match[0];
      text = title.slice(emoji.length);
    }
    return (
      <>
        {emoji && <span>{emoji}</span>}
        {text.split('').map((char, idx) => {
          if (char === ' ') {
            return <span key={idx}> </span>;
          }
          const color = colors[colorIndex % colors.length];
          colorIndex++;
          return (
            <span key={idx} style={{ color }}>
              {char}
            </span>
          );
        })}
      </>
    );
  };

  return (
    <div className="page-container">
      <h2 className="page-title" style={{ marginBottom: exhibition ? 4 : 'var(--space-4)' }}>
        {renderStyledPageTitle("📅 Facility Booking")}
      </h2>
      {exhibition && (
        <p className="page-subtitle" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', marginTop: 0, marginBottom: 'var(--space-4)' }}>
          For {exhibition.title}
        </p>
      )}
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
        Reserve meeting rooms, booths, and key workspaces inside the exhibition center.
      </p>

      {error && (
        <div className="error-banner animate-fade-in" style={{ marginBottom: 'var(--space-4)', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', color: 'rgb(248, 113, 113)', fontSize: 'var(--font-size-sm)' }}>
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="success-banner animate-fade-in" style={{ marginBottom: 'var(--space-4)', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-md)', color: 'rgb(110, 231, 183)', fontSize: 'var(--font-size-sm)' }}>
          ✅ {success}
        </div>
      )}

      {facilities.length === 0 ? (
        <div className="empty-state card">
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: 'var(--space-3)' }}>🏢</span>
          <p>No facilities are currently registered for this exhibition.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {facilities.map((facility, index) => (
            <div
              key={facility.id}
              className="card animate-slide-up"
              onClick={() => setSelectedFacility(facility)}
              style={{
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--space-4)',
                background: 'var(--color-bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                animationDelay: `${index * 50}ms`
              }}
            >
              <div>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                  {facility.facilityName}
                </h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', margin: '4px 0 0 0' }}>
                  📍 Area/Booth: <strong style={{ color: 'var(--color-text-primary)' }}>{facility.areaNumber}</strong>
                </p>
                {(() => {
                  let ops = [];
                  if (facility.operatingHours) {
                    try { ops = JSON.parse(facility.operatingHours); } catch(_) {}
                  }
                  if (ops.length > 0) {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-text-tertiary)' }}>🕒 Operating Hours:</span>
                        {ops.map((op: any, i: number) => {
                          let niceDate = op.date;
                          try {
                            const d = new Date(op.date);
                            if (!isNaN(d.getTime())) niceDate = formatDateDDMMMYYYY(d);
                          } catch(_) {}
                          return <span key={i} style={{ paddingLeft: '8px' }}>• {niceDate}: <strong>{op.timeFrom} - {op.timeTo}</strong></span>;
                        })}
                      </div>
                    );
                  }
                  return (
                    <p style={{ color: 'var(--color-text-tertiary)', fontSize: '11px', margin: '4px 0 0 0' }}>
                      🕒 Operating: {new Date(facility.periodFrom).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - {new Date(facility.periodTo).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </p>
                  );
                })()}
              </div>
              <button className="btn btn-secondary" style={{ pointerEvents: 'none', padding: '6px 14px', fontSize: 'var(--font-size-sm)', height: 'auto' }}>
                Book Slots
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Facility Detail & Booking Modal */}
      {selectedFacility && (() => {
        const slots = getFacilitySlots(selectedFacility);
        const facilitySelected = selectedSlots[selectedFacility.id] || [];

        return (
          <>
            <div className="modal-overlay" onClick={() => setSelectedFacility(null)} />
            <div className="modal-content" style={{ maxWidth: '480px' }}>
              <div className="modal-handle" />
              <div className="admin-form animate-scale-in" style={{ marginTop: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: 'var(--space-3)' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                      {selectedFacility.facilityName}
                    </h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', margin: '4px 0 0 0' }}>
                      📍 Area/Booth: <strong style={{ color: 'var(--color-text-primary)' }}>{selectedFacility.areaNumber}</strong>
                    </p>
                    {(() => {
                      let ops = [];
                      if (selectedFacility.operatingHours) {
                        try { ops = JSON.parse(selectedFacility.operatingHours); } catch(_) {}
                      }
                      if (ops.length > 0) {
                        return (
                          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>🕒 Operating Hours:</span>
                            {ops.map((op: any, i: number) => {
                              let niceDate = op.date;
                              try {
                                const d = new Date(op.date);
                                if (!isNaN(d.getTime())) niceDate = formatDateDDMMMYYYY(d);
                              } catch(_) {}
                              return (
                                <span key={i} style={{ fontSize: '11px', color: 'var(--color-text-secondary)', paddingLeft: '4px' }}>
                                  • {niceDate}: {op.timeFrom} - {op.timeTo}
                                </span>
                              );
                            })}
                          </div>
                        );
                      }
                      return (
                        <p style={{ color: 'var(--color-text-tertiary)', fontSize: '11px', margin: '4px 0 0 0' }}>
                          🕒 Operating: {formatDatetimeDDMMMYYYY(selectedFacility.periodFrom)} - {formatDatetimeDDMMMYYYY(selectedFacility.periodTo)}
                        </p>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => setSelectedFacility(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      fontSize: '18px',
                      padding: '4px'
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                  <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                    Available 15-Minute Slots
                  </h4>

                  {slots.length === 0 ? (
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                      No slots generated within the operating period.
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                      {slots.map(slot => {
                        const isSelected = facilitySelected.includes(slot.timeISO);
                        const isBooked = !!slot.bookedInfo;
                        const isMyBooking = slot.bookedInfo?.isMyBooking || false;

                        if (isBooked) {
                          if (isMyBooking) {
                            return (
                              <div
                                key={slot.timeISO}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '8px',
                                  borderRadius: 'var(--radius-md)',
                                  background: 'rgba(59, 130, 246, 0.15)',
                                  border: '1px solid var(--color-accent-blue)',
                                  color: 'var(--color-accent-blue)',
                                  fontSize: 'var(--font-size-xs)',
                                  position: 'relative'
                                }}
                              >
                                <span style={{ fontWeight: 600 }}>{slot.label}</span>
                                <span style={{ fontSize: '9px', opacity: 0.8 }}>{slot.dateLabel}</span>
                                <button
                                  onClick={() => handleCancelBooking(selectedFacility.id, slot.timeISO)}
                                  disabled={submitting === selectedFacility.id}
                                  title="Cancel Booking"
                                  style={{
                                    position: 'absolute',
                                    top: '4px',
                                    right: '4px',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--color-accent-coral)',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    padding: '2px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  ✕
                                </button>
                                <span style={{ fontSize: '8px', marginTop: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>Mine</span>
                              </div>
                            );
                          } else {
                            return (
                              <button
                                key={slot.timeISO}
                                disabled
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '8px',
                                  borderRadius: 'var(--radius-md)',
                                  background: 'var(--color-bg-input)',
                                  border: '1px solid var(--color-border)',
                                  color: 'var(--color-text-tertiary)',
                                  fontSize: 'var(--font-size-xs)',
                                  cursor: 'not-allowed',
                                  opacity: 0.6
                                }}
                              >
                                <span style={{ fontWeight: 500, textDecoration: 'line-through' }}>{slot.label}</span>
                                <span style={{ fontSize: '9px' }}>Booked</span>
                              </button>
                            );
                          }
                        }

                        // Available Slot
                        return (
                          <button
                            key={slot.timeISO}
                            onClick={() => handleToggleSlotSelection(selectedFacility.id, slot.timeISO)}
                            disabled={submitting === selectedFacility.id}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '8px',
                              borderRadius: 'var(--radius-md)',
                              background: isSelected ? 'var(--color-accent-green)' : 'transparent',
                              border: `1px solid ${isSelected ? 'var(--color-accent-green)' : 'var(--color-border)'}`,
                              color: isSelected ? '#ffffff' : 'var(--color-text-primary)',
                              fontSize: 'var(--font-size-xs)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{slot.label}</span>
                            <span style={{ fontSize: '9px', color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--color-text-secondary)' }}>
                              {slot.dateLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="form-actions">
                  <button className="btn btn-secondary" onClick={() => setSelectedFacility(null)}>Close</button>
                  {facilitySelected.length > 0 && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleBookSlots(selectedFacility.id)}
                      disabled={submitting === selectedFacility.id}
                    >
                      {submitting === selectedFacility.id ? 'Booking...' : `Book Selected (${facilitySelected.length})`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
