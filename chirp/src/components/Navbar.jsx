import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

const Navbar = () => {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
            <div style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '50%', 
              background: '#8B4513', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'white',
              fontSize: '14px'
            }}>
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
              ) : (
                <span>{user?.displayName?.charAt(0) || 'U'}</span>
              )}
            </div>
            <span>{user?.displayName?.split(' ')[0] || 'User'}</span>
          </Link>

          {/* Icons */}
          <button className="icon-btn" title="Notifications">
            <span>🔔</span>
          </button>
          <button className="icon-btn" onClick={handleLogoutClick} title="Logout">
            <span>🚪</span>
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
