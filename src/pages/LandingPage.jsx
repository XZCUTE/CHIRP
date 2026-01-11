import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getDatabase, ref, get } from 'firebase/database';
import CustomCaptcha from '../components/CustomCaptcha';
import { auth } from '../firebase';
import { checkRateLimit } from '../utils/rateLimiter';

const LandingPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [rateLimitLockout, setRateLimitLockout] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const db = getDatabase();

  // Debugging Feature: Rate Limit Test
  useEffect(() => {
    Object.defineProperty(window, 'debugtest', {
      get: () => ({
        get run() {
          console.log('Running rate limit test: Simulating 76 requests...');
          let blocked = false;
          for (let i = 0; i < 80; i++) { // Try 80 to be sure
            const result = checkRateLimit('login');
            if (!result.allowed) {
              console.warn(`Request ${i + 1} blocked! Rate limit triggered. Remaining: ${result.remainingSeconds}s`);
              blocked = true;
              setError(`DEBUG: Rate limit triggered on request ${i + 1}. Blocked for ${result.remainingSeconds}s`);
              setRateLimitLockout(true);
              setTimeout(() => setRateLimitLockout(false), result.remainingSeconds * 1000);
              break; // Stop once blocked
            } else {
              console.log(`Request ${i + 1} allowed.`);
            }
          }
          if (blocked) {
            console.log('%c Defense system triggered successfully! ', 'background: #222; color: #bada55');
          } else {
            console.log('Test Complete: Limit not reached.');
          }
          return 'Executing Rate Limit Test...';
        }
      }),
      configurable: true
    });

    return () => {
      delete window.debugtest;
    };
  }, []);

  // Check rate limit on mount
  useEffect(() => {
    const rateLimit = checkRateLimit('login');
    if (!rateLimit.allowed) {
      setRateLimitLockout(true);
      setError(`Too many attempts. Please try again in ${rateLimit.remainingSeconds} seconds.`);
      setTimeout(() => setRateLimitLockout(false), rateLimit.remainingSeconds * 1000);
    }
  }, []);

  useEffect(() => {
    if (location.state?.message) {
      setInfoMessage(location.state.message);
    }
  }, [location]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setLoading(true);

    // Rate Limiting Check
    const rateLimit = checkRateLimit('login');
    if (!rateLimit.allowed) {
      setRateLimitLockout(true);
      setError(`Too many attempts. Please try again in ${rateLimit.remainingSeconds} seconds.`);
      setTimeout(() => setRateLimitLockout(false), rateLimit.remainingSeconds * 1000);
      setLoading(false);
      return;
    }

    // CAPTCHA Validation
    if (!isCaptchaValid) {
      setError('Please verify the security code.');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        await signOut(auth);
        setInfoMessage('Please verify your email address before logging in.');
        return;
      }

      navigate('/home');
    } catch (err) {
      console.error(err);
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    // Rate Limiting Check
    const rateLimit = checkRateLimit('login');
    if (!rateLimit.allowed) {
      setRateLimitLockout(true);
      setError(`Too many attempts. Please try again in ${rateLimit.remainingSeconds} seconds.`);
      setTimeout(() => setRateLimitLockout(false), rateLimit.remainingSeconds * 1000);
      setLoading(false);
      return;
    }

    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user exists in database
      const userRef = ref(db, 'users/' + user.uid);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        // User exists, proceed to home
        navigate('/home');
      } else {
        // New user, redirect to signup to complete registration
        navigate('/signup', { 
          state: { 
            googleUser: {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL
            } 
          } 
        });
      }
    } catch (err) {
      console.error('Google Sign-In Error:', err);
      setError('Failed to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-container page-transition">
      {rateLimitLockout && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          pointerEvents: 'all'
        }}>
          <img 
            src="https://i.imgur.com/B7wZ3gm.gif" 
            alt="Access Denied" 
            style={{ maxWidth: '90%', maxHeight: '90%' }} 
          />
          <h2 style={{ color: '#ff4d4d', marginTop: '20px', fontFamily: 'monospace' }}>
            ACCESS DENIED: RATE LIMIT EXCEEDED
          </h2>
          <p style={{ color: '#bbb', fontFamily: 'monospace' }}>
            Please wait before retrying...
          </p>
        </div>
      )}
      <div className="landing-content">
        {/* Left Side: Branding */}
        <div className="branding-section">
            <h1 className="branding-logo">CHIRP</h1>
            <p className="branding-tagline">
              Connect with fellow cyber enthusiasts, share security tips, and explore the digital world safely on CHIRP.
            </p>
          </div>

        {/* Right Side: Login Form */}
        <div className="login-card-section">
          <div className="login-card">
            {infoMessage && (
              <div style={{ 
                color: '#D2691E', 
                backgroundColor: 'rgba(210, 105, 30, 0.1)', 
                padding: '10px', 
                borderRadius: '5px', 
                marginBottom: '10px', 
                textAlign: 'center',
                border: '1px solid #D2691E'
              }}>
                {infoMessage}
              </div>
            )}
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleLogin} className="auth-form">
              <input
                type="email"
                placeholder="Email or phone number"
                className="login-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              
              {/* Custom CAPTCHA */}
              <CustomCaptcha onValidate={setIsCaptchaValid} />

              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? 'Logging in...' : 'Log In'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', margin: '15px 0' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#333' }}></div>
                <span style={{ padding: '0 10px', color: '#666', fontSize: '12px' }}>OR</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#333' }}></div>
              </div>

              <button 
                type="button" 
                onClick={handleGoogleLogin} 
                className="google-btn"
                disabled={loading}
              >
                <img 
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                  alt="Google" 
                />
                Continue with Google
              </button>
            </form>
            
            <Link to="/forgot-password" className="forgot-password">Forgot password?</Link>
            
            <div className="divider"></div>
            
            <Link to="/signup" className="create-account-btn">
              Create new account
            </Link>
          </div>
          <p className="create-page-text">
            <strong>Start your journey</strong> with us.
          </p>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-acronym-list">
            <div className="footer-acronym-item">
              <span className="footer-letter">C</span><span className="footer-word-rest">ybersecurity</span>
            </div>
            <div className="footer-acronym-item">
              <span className="footer-letter">H</span><span className="footer-word-rest">acking</span>
            </div>
            <div className="footer-acronym-item">
              <span className="footer-letter">I</span><span className="footer-word-rest">nformation</span>
            </div>
            <div className="footer-acronym-item">
              <span className="footer-letter">R</span><span className="footer-word-rest">isk</span>
            </div>
            <div className="footer-acronym-item">
              <span className="footer-letter">P</span><span className="footer-word-rest">latform</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
