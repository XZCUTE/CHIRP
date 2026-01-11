import React, { useState, useEffect } from 'react';
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

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Hide Navbar on Landing Page, Signup Page, and Forgot Password Page
  const hideNavbar = location.pathname === '/' || location.pathname === '/signup' || location.pathname === '/forgot-password' || location.pathname === '/connections';

  return (
    <div className="App">
      {!hideNavbar && <Navbar />}
      <div className={!hideNavbar ? "main-content-wrapper" : ""}>
        {children}
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthGuard>
        <Layout>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/home" element={<CapyHome />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/connections" element={<Cappies />} />
            <Route path="/devs" element={<CapyDEVS />} />
            {/* Fallback to Landing Page */}
            <Route path="*" element={<LandingPage />} />
          </Routes>
        </Layout>
      </AuthGuard>
    </Router>
  );
}

export default App;
