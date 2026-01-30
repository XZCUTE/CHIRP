import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { getDatabase, ref, get } from 'firebase/database';
import { auth } from './firebase';
import Navbar from './components/Navbar';
import CapyHome from './components/CapyHome';
import Cappies from './components/Cappies';
import CapyDEVS from './components/CapyDEVS';
import LandingPage from './pages/LandingPage';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import Profile from './pages/Profile';
import PhotoViewer from './pages/PhotoViewer';
import Play from './pages/Play';
import PlayAdmin from './pages/PlayAdmin';
import SearchPage from './pages/SearchPage';
import PostPage from './pages/PostPage';
import SettingsPage from './pages/SettingsPage';
import Reels from './pages/Reels';
import Offers from './pages/Offers';
import Activities from './pages/Activities';
import Squads from './pages/Squads';
import Learn from './pages/Learn';
import CapyTips from './pages/CapyTips';
import Chirpy from './pages/Chirpy';
import GeoBlocker from './components/GeoBlocker';
import Antigravity from './components/Antigravity';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import './App.css';

// Component to handle Auth redirects and state
const AuthGuard = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const db = getDatabase();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Define path types
      const isSignupPath = location.pathname === '/signup';
      const publicPaths = ['/', '/forgot-password'];
      const isPublicPath = publicPaths.includes(location.pathname);

      if (user) {
        // User is logged in, check if profile exists in DB
        try {
          const userRef = ref(db, 'users/' + user.uid);
          const snapshot = await get(userRef);
          const profileExists = snapshot.exists();

          if (!profileExists) {
            // Profile is missing (e.g. new Google user)
            // MUST be on /signup to complete profile
            if (!isSignupPath) {
              navigate('/signup');
            }
            // If already on /signup, allow them to stay
          } else {
            // Profile exists
            if (isPublicPath || isSignupPath) {
              // If on public or signup page, redirect to home
              navigate('/home');
            }
            // If on protected page, allow
          }
        } catch (error) {
          console.error("Error checking user profile:", error);
          // In case of error, maybe let them stay or default to safe state?
          // For now, assume if error, we don't redirect blindly.
        }
      } else {
        // User is NOT logged in
        if (!isPublicPath && !isSignupPath) {
          // If on a protected page, redirect to landing
          navigate('/');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate, location]);

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        width: '100vw', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#0f0f0f',
        color: '#D2691E'
      }}>
        <h2>Loading CHIRP...</h2>
      </div>
    );
  }

  return children;
};

// Layout component to conditionally render Navbar
const Layout = ({ children }) => {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const { showAntigravity, antigravityConfig } = useSettings();

  // Scroll to top on base route changes (ignore modal overlays)
  useEffect(() => {
    const isPhotoRoute = location.pathname.startsWith('/photo/');
    const hasBackground = !!location.state?.backgroundLocation;
    const prevPath = prevPathRef.current;
    prevPathRef.current = location.pathname;

    if (isPhotoRoute || hasBackground) return;

    const cameFromPhoto = prevPath.startsWith('/photo/');
    if (cameFromPhoto) {
      const key = 'scroll:' + location.pathname;
      const stored = sessionStorage.getItem(key);
      if (stored) {
        window.scrollTo(0, Number(stored));
        // optional cleanup
        // sessionStorage.removeItem(key);
        return;
      }
    }

    window.scrollTo(0, 0);
  }, [location.pathname, location.state]);

  // Hide Navbar on Landing Page, Signup Page, and Forgot Password Page
  const hideNavbar = location.pathname === '/' || location.pathname === '/signup' || location.pathname === '/forgot-password' || location.pathname === '/connections' || location.pathname === '/settings' || location.pathname === '/play' || location.pathname === '/play/adminaccess' || location.pathname === '/learn' || location.pathname === '/reels' || location.pathname === '/offers' || location.pathname === '/tips' || location.pathname === '/chirpy' || location.pathname.startsWith('/photo/');

  return (
    <div className="App">
      {showAntigravity && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1, pointerEvents: 'none' }}>
          <Antigravity {...antigravityConfig} />
        </div>
      )}
      {!hideNavbar && <Navbar />}
      <div className={!hideNavbar ? "main-content-wrapper" : ""}>
        {children}
      </div>
    </div>
  );
};

function App() {
  return (
    <GeoBlocker>
      <SettingsProvider>
        <Router>
          <AuthGuard>
            <Layout>
              <ModalSwitch />
            </Layout>
          </AuthGuard>
        </Router>
      </SettingsProvider>
    </GeoBlocker>
  );
}

function ModalSwitch() {
  const location = useLocation();
  const state = location.state;
  const backgroundLocation = state && state.backgroundLocation;

  return (
    <>
      <Routes location={backgroundLocation || location}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/home" element={<CapyHome />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/connections" element={<Cappies />} />
        <Route path="/devs" element={<CapyDEVS />} />
        <Route path="/tips" element={<CapyTips />} />
        <Route path="/play" element={<Play />} />
        <Route path="/play/adminaccess" element={<PlayAdmin />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/post/:id" element={<PostPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/reels" element={<Reels />} />
          <Route path="/reels/:reelId" element={<Reels />} />
          <Route path="/activities" element={<Activities />} />
          <Route path="/squads" element={<Squads />} />
          <Route path="/chirpy" element={<Chirpy />} />
          <Route path="/offers" element={<Offers />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/photo/:postId/:index" element={<PhotoViewer />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>

      {backgroundLocation && (
        <Routes>
          <Route path="/photo/:postId/:index" element={<PhotoViewer />} />
        </Routes>
      )}
    </>
  );
}

export default App;
