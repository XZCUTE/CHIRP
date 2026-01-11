import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import InitialsAvatar from './InitialsAvatar';

const Navbar = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(auth.currentUser);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    // Listen for profile updates
    const handleProfileUpdate = () => {
      if (auth.currentUser) {
        // Force state update by creating a new object reference
        setUser({ ...auth.currentUser }); 
      }
    };
    window.addEventListener('profileUpdated', handleProfileUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, []);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  return (
    <>
      <nav className="navbar">
        {/* Left: Logo */}
        <div className="nav-left">
          <Link to="/home" className="nav-logo">
            CHIRP
          </Link>
        </div>

        {/* Center: Search */}
        <div className="nav-center">
          <div className="nav-search">
            <div className="nav-search-logo-wrapper">
              <img src="/Chirp.png" alt="Chirp" />
            </div>
            <input type="text" placeholder="Find anything" />
            <button className="nav-search-ask-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D2691E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <span>Search</span>
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="nav-right">
          {/* Profile */}
          <Link to="/profile" className="nav-profile-link">
            <div className="nav-profile-avatar">
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt="Profile" 
                />
              ) : (
                <InitialsAvatar 
                  name={user?.displayName || user?.email} 
                  uid={user?.uid} 
                  size={32}
                  fontSize="14px"
                />
              )}
            </div>
            <span className="nav-profile-text">Profile</span>
          </Link>

          {/* Icons */}
          <button className="icon-btn" title="Notifications">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </button>
          <button className="icon-btn" onClick={handleLogoutClick} title="Logout">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </nav>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Log Out?</h3>
            <p>Are you sure you want to leave the capy party? 🦦</p>
            <div className="modal-actions">
              <button className="capy-btn" style={{ background: '#3A3B3C' }} onClick={cancelLogout}>Cancel</button>
              <button className="capy-btn capy-btn-accent" onClick={confirmLogout}>Log Out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
