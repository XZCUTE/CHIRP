import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Check your inbox! We sent a password reset link to your email.');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        setError('That email address is not registered with CHIRP.');
      } else {
        setError('Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-container page-transition">
      <div className="login-card-section">
        <div className="login-card" style={{ maxWidth: '450px', gap: '20px', padding: '30px' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 className="signup-header">Reset Password</h1>
            <p className="signup-subtitle">Don't worry, it happens to the best of us.</p>
          </div>
          
          <div className="divider"></div>

          {message && (
            <div style={{ 
              color: '#4caf50', 
              backgroundColor: 'rgba(76, 175, 80, 0.1)', 
              padding: '10px', 
              borderRadius: '5px', 
              textAlign: 'center',
              border: '1px solid #4caf50'
            }}>
              {message}
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleResetPassword} className="auth-form" style={{ gap: '15px' }}>
            <div>
              <label className="signup-label">Email address</label>
              <input 
                type="email" 
                className="login-input" 
                placeholder="Enter your email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>

            <button type="submit" className="create-account-btn" disabled={loading}>
              {loading ? 'Sending Link...' : 'Send Reset Link'}
            </button>
          </form>
          
          <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '15px' }}>
            <Link to="/login" style={{ color: '#D2691E', textDecoration: 'none', fontWeight: 'bold' }}>
              Back to Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
