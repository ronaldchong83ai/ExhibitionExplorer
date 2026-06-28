'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [exhibitionTitle, setExhibitionTitle] = useState('Sports & Style Festival 2026 Singapore');
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugOtp, setDebugOtp] = useState('');

  useEffect(() => {
    fetch('/api/home')
      .then(res => res.json())
      .then(d => {
        if (d.success && d.data?.exhibition?.title) {
          setExhibitionTitle(d.data.exhibition.title);
        }
      })
      .catch(() => {});
  }, []);

  const renderStyledTitle = (title: string) => {
    const colors = ['#F6921E', '#3B82F6', '#10B981'];
    let colorIndex = 0;
    return (
      <span style={{ display: 'inline-block' }}>
        {title.split('').map((char, idx) => {
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
      </span>
    );
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (data.success) {
        setStep(2);
        setSuccessMessage(data.message || 'OTP has been sent to your email.');
        if (data.debugOtp) {
          setDebugOtp(data.debugOtp);
        }
      } else {
        setError(data.error || 'Failed to send OTP. Please check your email.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMessage('Password reset successfully! Redirecting to login...');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        setError(data.error || 'Failed to reset password.');
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
        {/* Logo Area */}
        <div className="auth-logo">
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
              {renderStyledTitle(exhibitionTitle)}
            </h2>
          </div>
          <h1 className="auth-title">Exhibition Explorer</h1>
          <p className="auth-subtitle" style={{ marginTop: '8px' }}>Reset Your Password</p>
        </div>

        {/* Step 1: Request OTP */}
        {step === 1 && (
          <form onSubmit={handleSendOtp} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="forgot-email">Email Address</label>
              <input
                id="forgot-email"
                type="email"
                className="form-input"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {error && <div className="auth-error" style={{ marginBottom: '16px' }}>{error}</div>}

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
              id="send-otp-submit"
            >
              {loading ? <span className="loading-spinner" /> : 'Send OTP'}
            </button>
          </form>
        )}

        {/* Step 2: Verify OTP and Reset Password */}
        {step === 2 && (
          <form onSubmit={handleResetPassword} className="auth-form">
            {successMessage && (
              <div 
                className="auth-success" 
                style={{ 
                  backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                  border: '1px solid var(--color-success)', 
                  color: 'var(--color-success)', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  fontSize: 'var(--font-size-sm)',
                  marginBottom: '16px',
                  textAlign: 'center'
                }}
              >
                {successMessage}
              </div>
            )}

            {debugOtp && (
              <div 
                style={{ 
                  backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                  border: '1px solid var(--color-primary)', 
                  color: 'var(--color-primary)', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  fontSize: 'var(--font-size-sm)',
                  marginBottom: '16px',
                  textAlign: 'center',
                  fontWeight: 500
                }}
              >
                💡 [Sandbox Test Tool] Your OTP code is: <strong style={{ fontSize: '16px', textDecoration: 'underline' }}>{debugOtp}</strong>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="otp-input">Enter OTP</label>
              <input
                id="otp-input"
                type="text"
                className="form-input"
                placeholder="Enter the 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                maxLength={6}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="new-password">New Password</label>
              <input
                id="new-password"
                type="password"
                className="form-input"
                placeholder="Enter new password (min 6 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
              <input
                id="confirm-password"
                type="password"
                className="form-input"
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {error && <div className="auth-error" style={{ marginBottom: '16px' }}>{error}</div>}

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
              id="reset-password-submit"
            >
              {loading ? <span className="loading-spinner" /> : 'Reset Password'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link 
            href="/login" 
            style={{ 
              color: 'var(--color-text-secondary)', 
              fontSize: 'var(--font-size-sm)', 
              textDecoration: 'none'
            }}
            id="back-to-login-link"
          >
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
