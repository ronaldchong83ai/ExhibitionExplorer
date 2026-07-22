'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AutoSuggestInput from '@/components/AutoSuggestInput';
import { OCCUPATIONS, CITIZENSHIPS } from '@/lib/constants/profileOptions';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', occupation: '', citizenship: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP Verification States
  const [otp, setOtp] = useState('');
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSuccessMessage, setOtpSuccessMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const isValidEmail = (emailStr: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  const handleSendOtp = async () => {
    setError('');
    setOtpSuccessMessage('');
    setSendingOtp(true);
    try {
      const res = await fetch('/api/auth/register/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setOtpSuccessMessage(data.message || 'OTP sent successfully.');
      } else {
        setError(data.error || 'Failed to send OTP.');
      }
    } catch {
      setError('Network error sending OTP. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    setOtpSuccessMessage('');
    setVerifyingOtp(true);
    try {
      const res = await fetch('/api/auth/register/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, otp }),
      });
      const data = await res.json();
      if (data.success) {
        setIsOtpVerified(true);
        setOtpSuccessMessage('Email verified successfully!');
      } else {
        setError(data.error || 'Invalid or expired OTP.');
      }
    } catch {
      setError('Network error verifying OTP. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isOtpVerified) {
      setError('Please verify your email address using OTP first.');
      return;
    }
    if (!form.occupation.trim()) {
      setError('Occupation is required');
      return;
    }
    if (!form.citizenship.trim()) {
      setError('Citizenship is required');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          occupation: form.occupation,
          citizenship: form.citizenship,
          password: form.password,
        }),
      });
      const data = await res.json();

      if (data.success) {
        router.push('/home');
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container animate-scale-in">
        <div className="auth-logo">
          <button onClick={() => router.push('/login')} className="back-button" aria-label="Go back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Join the exhibition experience</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="reg-name">
              <span style={{ color: '#ef4444', marginRight: '4px' }}>*</span>Full Name
            </label>
            <input
              id="reg-name"
              name="name"
              type="text"
              className="form-input"
              placeholder="Enter your full name"
              value={form.name}
              onChange={handleChange}
              required
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">
              <span style={{ color: '#ef4444', marginRight: '4px' }}>*</span>Email
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                id="reg-email"
                name="email"
                type="email"
                className="form-input"
                placeholder="Enter your email"
                value={form.email}
                onChange={handleChange}
                required
                disabled={isOtpVerified || otpSent}
                autoComplete="email"
                style={{ flex: 1 }}
              />
              {isValidEmail(form.email) && !otpSent && !isOtpVerified && (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sendingOtp}
                  className="btn btn-primary"
                  style={{ whiteSpace: 'nowrap', minWidth: '100px', fontSize: 'var(--font-size-sm)', padding: '0 12px' }}
                >
                  {sendingOtp ? <span className="loading-spinner" style={{ width: '16px', height: '16px', margin: 0 }} /> : 'Send OTP'}
                </button>
              )}
              {isOtpVerified && (
                <span 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    color: 'var(--color-success)', 
                    fontWeight: 600, 
                    fontSize: 'var(--font-size-sm)',
                    padding: '0 12px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid var(--color-success)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  ✓ Verified
                </span>
              )}
            </div>
            {otpSent && !isOtpVerified && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Verification code sent to email, check spam mail if not in Inbox.
                </span>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sendingOtp}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    fontSize: 'var(--font-size-xs)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0
                  }}
                >
                  {sendingOtp ? 'Sending...' : 'Resend Code'}
                </button>
              </div>
            )}
          </div>

          {otpSent && !isOtpVerified && (
            <div className="form-group animate-scale-in" style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
              <label className="form-label" htmlFor="otp-input">Enter OTP</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="otp-input"
                  type="text"
                  className="form-input"
                  placeholder="Enter the 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  style={{ flex: 1, margin: 0 }}
                  required
                />
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={otp.length !== 6 || verifyingOtp}
                  className="btn btn-primary"
                  style={{ whiteSpace: 'nowrap', minWidth: '100px', fontSize: 'var(--font-size-sm)', padding: '0 12px' }}
                >
                  {verifyingOtp ? <span className="loading-spinner" style={{ width: '16px', height: '16px', margin: 0 }} /> : 'Verify'}
                </button>
              </div>
            </div>
          )}

          {otpSuccessMessage && (
            <div 
              style={{ 
                color: isOtpVerified ? 'var(--color-success)' : 'var(--color-primary)', 
                fontSize: 'var(--font-size-sm)', 
                margin: '8px 0', 
                fontWeight: 500,
                textAlign: 'center'
              }}
            >
              {otpSuccessMessage}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="reg-occupation">
              <span style={{ color: '#ef4444', marginRight: '4px' }}>*</span>Occupation
            </label>
            <AutoSuggestInput
              id="reg-occupation"
              name="occupation"
              placeholder="Select or type your occupation"
              value={form.occupation}
              onChange={(val) => setForm(prev => ({ ...prev, occupation: val }))}
              options={OCCUPATIONS}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-citizenship">
              <span style={{ color: '#ef4444', marginRight: '4px' }}>*</span>Citizenship
            </label>
            <AutoSuggestInput
              id="reg-citizenship"
              name="citizenship"
              placeholder="Select or type your citizenship"
              value={form.citizenship}
              onChange={(val) => setForm(prev => ({ ...prev, citizenship: val }))}
              options={CITIZENSHIPS}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">
              <span style={{ color: '#ef4444', marginRight: '4px' }}>*</span>Password
            </label>
            <input
              id="reg-password"
              name="password"
              type="password"
              className="form-input"
              placeholder="At least 6 characters"
              value={form.password}
              onChange={handleChange}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-confirm">
              <span style={{ color: '#ef4444', marginRight: '4px' }}>*</span>Confirm Password
            </label>
            <input
              id="reg-confirm"
              name="confirmPassword"
              type="password"
              className="form-input"
              placeholder="Confirm your password"
              value={form.confirmPassword}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={
              loading || 
              !isOtpVerified || 
              !form.name.trim() || 
              !form.email.trim() || 
              !form.occupation.trim() ||
              !form.citizenship.trim() ||
              !form.password || 
              !form.confirmPassword
            }
            id="register-submit"
          >
            {loading ? <span className="loading-spinner" /> : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link href="/login" className="auth-link">Sign in</Link>
        </p>
      </div>

      <style jsx>{`
        .auth-page {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-4);
          padding-top: calc(var(--space-4) + var(--safe-top));
          background: var(--gradient-dark);
          position: relative;
          overflow: hidden;
        }
        .auth-page::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle at 30% 20%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
                      radial-gradient(circle at 70% 80%, rgba(139, 92, 246, 0.06) 0%, transparent 50%);
          pointer-events: none;
        }
        .auth-container {
          width: 100%;
          max-width: 400px;
          position: relative;
          z-index: 1;
        }
        .auth-logo {
          text-align: center;
          margin-bottom: var(--space-6);
          position: relative;
        }
        .back-button {
          position: absolute;
          left: 0;
          top: 0;
          color: var(--color-text-secondary);
          padding: var(--space-2);
          border-radius: var(--radius-full);
          transition: all var(--transition-fast);
        }
        .back-button:hover {
          background: var(--color-bg-glass);
          color: var(--color-text-primary);
        }
        .auth-title {
          font-size: var(--font-size-2xl);
          font-weight: 800;
          background: var(--gradient-primary);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: var(--space-2);
        }
        .auth-subtitle {
          color: var(--color-text-secondary);
          font-size: var(--font-size-base);
        }
        .auth-form {
          margin-bottom: var(--space-4);
        }
        .auth-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: var(--radius-md);
          padding: var(--space-3) var(--space-4);
          color: var(--color-accent-coral);
          font-size: var(--font-size-sm);
          margin-bottom: var(--space-4);
        }
        .auth-footer {
          text-align: center;
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
        }
        .auth-link {
          color: var(--color-accent-blue);
          font-weight: 600;
        }
        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          display: inline-block;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
