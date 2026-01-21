import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import CustomCaptcha from '../components/CustomCaptcha';
import { auth, db } from '../firebase';
import { checkRateLimit } from '../utils/rateLimiter';
import { useGeo } from '../components/GeoBlocker';

const Signup = () => {
  const { isAllowed } = useGeo();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bDay, setBDay] = useState('1');
  const [bMonth, setBMonth] = useState('Jan');
  const [bYear, setBYear] = useState('2026');
  const [gender, setGender] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);
  const [rateLimitLockout, setRateLimitLockout] = useState(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [googleUser, setGoogleUser] = useState(location.state?.googleUser || null);

  // Pre-fill data if coming from Google Sign-In or if AuthGuard redirected us
  useEffect(() => {
    // If we have state from navigation, use it
    if (location.state?.googleUser) {
      setGoogleUser(location.state.googleUser);
      if (location.state.googleUser.displayName) setFullName(location.state.googleUser.displayName);
      if (location.state.googleUser.email) setEmail(location.state.googleUser.email);
    } 
    // Otherwise check if user is already logged in (e.g. redirected by AuthGuard)
    else if (auth.currentUser) {
      const user = auth.currentUser;
      setGoogleUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      });
      if (user.displayName) setFullName(user.displayName);
      if (user.email) setEmail(user.email);
    }
  }, [location.state]); // Run once or when state changes

  // Debugging Feature: Rate Limit Test
  useEffect(() => {
    Object.defineProperty(window, 'debugtest', {
      get: () => ({
        get run() {
          console.log('Running rate limit test: Simulating 76 requests...');
          let blocked = false;
          for (let i = 0; i < 80; i++) { // Try 80 to be sure
            const result = checkRateLimit('signup');
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
    const rateLimit = checkRateLimit('signup');
    if (!rateLimit.allowed) {
      setRateLimitLockout(true);
      setError(`Too many attempts. Please try again in ${rateLimit.remainingSeconds} seconds.`);
      setTimeout(() => setRateLimitLockout(false), rateLimit.remainingSeconds * 1000);
    }
  }, []);

  // Generate Date Options
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 120 }, (_, i) => currentYear - i);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Stealth Geo-Block
    if (!isAllowed) {
      setError('No Thank!');
      setLoading(false);
      return;
    }

    // Rate Limiting Check
    const rateLimit = checkRateLimit('signup');
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

    // Name Validation
    if (fullName.trim().length <= 3) {
      setError('Name must be more than 3 characters long.');
      setLoading(false);
      return;
    }

    // Password Validation (Skip if Google User)
    if (!googleUser) {
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(password)) {
        setError('Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character (@$!%*?&).');
        setLoading(false);
        return;
      }
    }

    if (!gender) {
      setError('Please select a gender');
      setLoading(false);
      return;
    }

    if (!termsAccepted) {
      setError('You must accept the Terms and Conditions to sign up.');
      setLoading(false);
      return;
    }

    try {
      let uid = '';

      if (googleUser) {
        // Use existing Google User UID
        uid = googleUser.uid;
      } else {
        // 1. Create User in Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        uid = user.uid;

        // 2. Send Verification Email
        await sendEmailVerification(user);
      }

      // 3. Save User Data in Realtime DB
      await set(ref(db, 'users/' + uid), {
        fullName,
        email,
        birthday: `${bDay} ${bMonth} ${bYear}`,
        gender,
        uid: uid,
        createdAt: new Date().toISOString(),
        authProvider: googleUser ? 'google' : 'email'
      });

      if (googleUser) {
         // Google users are already verified and logged in (conceptually), but we need to ensure the session is active.
         // Since we are in the signup flow *after* a redirect from LandingPage where they signed in, 
         // the Auth state should persist. However, onAuthStateChanged in App.jsx might have redirected them if we were not careful.
         // Actually, wait. If they signed in on LandingPage, they are authenticated.
         // If we redirected to Signup, they are still authenticated in Firebase terms.
         // So we can just navigate to home.
         navigate('/home');
      } else {
        console.log('User created:', uid);
        await signOut(auth);
        navigate('/login', { state: { message: 'Account created! Please check your email to verify your account before logging in.' } });
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Oops! This email is already part of the CHIRP crew 🐾');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoginLinkClick = async (e) => {
    // If the user is currently authenticated (e.g. Google user with incomplete profile),
    // we must sign them out before sending them back to the landing page.
    // Otherwise, AuthGuard will see they are logged in (but have no profile) and bounce them back to /signup.
    if (googleUser || auth.currentUser) {
      e.preventDefault();
      try {
        await signOut(auth);
        navigate('/');
      } catch (error) {
        console.error("Error signing out:", error);
      }
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
      <div className="login-card-section">
        <div className="login-card" style={{ maxWidth: '450px', gap: '8px', padding: '15px' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 className="signup-header" style={{ fontSize: '24px' }}>Join the CHIRP</h1>
          <p className="signup-subtitle" style={{ marginTop: '4px', fontSize: '14px' }}>Hop in, it's quick and cozy</p>
        </div>
        
        <div className="divider" style={{ margin: '4px 0' }}></div>

        <div style={{ width: '100%' }}>
          {error && <div className="error-message" style={{ marginBottom: '8px', padding: '6px' }}>{error}</div>}
          
          <form onSubmit={handleSignup} className="auth-form" style={{ gap: '8px' }}>
            
            {/* Name */}
            <div>
              <label className="signup-label">Name</label>
              <input 
                type="text" 
                className="login-input" 
                style={{ padding: '10px' }}
                placeholder="Full name" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                required 
              />
            </div>

            {/* Email */}
            <div>
              <label className="signup-label">Email address</label>
              <input 
                type="email" 
                className="login-input" 
                style={{ padding: '10px', backgroundColor: googleUser ? '#333' : undefined }}
                placeholder="Email address" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                readOnly={!!googleUser}
              />
            </div>

            {/* Password - Only show if NOT a google user */}
            {!googleUser && (
              <div>
                <label className="signup-label">New password</label>
                <input 
                  type="password" 
                  className="login-input" 
                  style={{ padding: '10px' }}
                  placeholder="New password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
              </div>
            )}

            {/* Birthday & Gender Row */}
            <div style={{ display: 'flex', gap: '10px' }}>
              {/* Birthday */}
              <div style={{ flex: 2 }}>
                <label className="signup-label">Date of birth</label>
                <div className="date-selectors" style={{ gap: '5px' }}>
                  <select 
                    className="date-select"
                    style={{ padding: '6px' }}
                    value={bMonth}
                    onChange={(e) => setBMonth(e.target.value)}
                  >
                    {months.map((month) => (
                      <option key={month} value={month}>{month}</option>
                    ))}
                  </select>
                  <select 
                    className="date-select"
                    style={{ padding: '6px' }}
                    value={bDay}
                    onChange={(e) => setBDay(e.target.value)}
                  >
                    {days.map((day) => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                  <select 
                    className="date-select"
                    style={{ padding: '6px' }}
                    value={bYear}
                    onChange={(e) => setBYear(e.target.value)}
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Gender */}
              <div style={{ flex: 1 }}>
                <label className="signup-label">Gender</label>
                <select 
                  className="date-select" 
                  style={{ width: '100%', padding: '6px' }}
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="" disabled>Select</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Custom CAPTCHA */}
            <CustomCaptcha onValidate={setIsCaptchaValid} />

            {/* Terms and Conditions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '5px 0' }}>
              <input 
                type="checkbox" 
                id="terms" 
                checked={termsAccepted} 
                onChange={(e) => setTermsAccepted(e.target.checked)}
                style={{ 
                  width: '16px', 
                  height: '16px', 
                  accentColor: '#D2691E',
                  cursor: 'pointer'
                }}
              />
              <label htmlFor="terms" style={{ color: '#ccc', fontSize: '13px', cursor: 'pointer', userSelect: 'none' }}>
                I agree to the <span style={{ color: '#D2691E', fontWeight: 'bold' }}>Terms</span>
              </label>
            </div>

            <button type="submit" className="create-account-btn" style={{ width: '100%', marginTop: '0', padding: '0', lineHeight: '40px', fontSize: '16px' }} disabled={loading}>
              {loading ? 'Signing up...' : 'Sign Up'}
            </button>
          </form>
          
          <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '14px' }}>
            <span style={{ color: '#bbb' }}>Already have an account? </span>
            <Link 
              to="/" 
              onClick={handleLoginLinkClick}
              style={{ color: '#D2691E', textDecoration: 'none', fontWeight: 'bold' }}
            >
              Log in
            </Link>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', margin: '5px 0 0 0' }}>
               <img src="/2.svg" alt="Capybara Party" style={{ width: '100%', height: 'auto', maxWidth: '120px', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))' }} />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Signup;
