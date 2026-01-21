import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { getDatabase, ref, onValue, get } from 'firebase/database';
import { auth } from '../firebase';
import InitialsAvatar from './InitialsAvatar';

const Navbar = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(auth.currentUser);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Notification State
  const [requests, setRequests] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

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

  // Fetch Friend Requests
  useEffect(() => {
    if (!user) {
      setRequests([]);
      return;
    }
    const db = getDatabase();
    const requestsRef = ref(db, `users/${user.uid}/friendRequests`);
    const unsubscribe = onValue(requestsRef, async (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const reqPromises = Object.keys(data).map(async (senderId) => {
           try {
             const userSnapshot = await get(ref(db, `users/${senderId}`));
             const userData = userSnapshot.val();
             return { uid: senderId, name: userData?.displayName || 'Unknown Capy' };
           } catch (e) {
             return { uid: senderId, name: 'Unknown Capy' };
           }
        });
        const resolvedRequests = await Promise.all(reqPromises);
        setRequests(resolvedRequests);
      } else {
        setRequests([]);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Click Outside Handler for Notifications
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
            <input 
              type="text" 
              placeholder="Find anything" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="nav-search-ask-btn" onClick={handleSearch}>
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
          <div className="nav-notification-wrapper" ref={notifRef} style={{position: 'relative'}}>
            <button 
              className="icon-btn" 
              title="Notifications" 
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              {requests.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '0',
                  right: '0',
                  background: 'var(--capy-accent)',
                  color: 'white',
                  borderRadius: '50%',
                  padding: '2px 5px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  minWidth: '16px',
                  textAlign: 'center'
                }}>{requests.length}</span>
              )}
            </button>

            {showNotifications && (
              <div className="notification-dropdown" style={{
                 position: 'absolute',
                 top: '120%',
                 right: '-50px',
                 width: '280px',
                 backgroundColor: 'var(--capy-card-bg)',
                 border: '1px solid var(--capy-border)',
                 borderRadius: '12px',
                 padding: '12px',
                 zIndex: 1000,
                 boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                 backdropFilter: 'blur(10px)'
              }}>
                 <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid var(--capy-border)'}}>
                    <h4 style={{margin: 0, fontSize: '14px', fontWeight: '600'}}>Friend Requests</h4>
                    {requests.length > 0 && <span style={{fontSize: '12px', color: 'var(--capy-text-secondary)'}}>{requests.length} new</span>}
                 </div>
                 
                 {requests.length > 0 ? (
                   <div style={{display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto'}}>
                     {requests.map(req => (
                       <div key={req.uid} onClick={() => { setShowNotifications(false); navigate('/connections?tab=requests'); }} style={{
                          padding: '10px',
                          borderRadius: '8px',
                          background: 'rgba(255,255,255,0.05)',
                          cursor: 'pointer',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'background 0.2s'
                       }}
                       onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                       onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                       >
                          <span style={{width: '8px', height: '8px', borderRadius: '50%', background: 'var(--capy-accent)'}}></span>
                          <span><strong style={{color: 'var(--capy-accent)'}}>{req.name}</strong> sent a request.</span>
                       </div>
                     ))}
                     <div onClick={() => { setShowNotifications(false); navigate('/connections?tab=requests'); }} style={{
                        textAlign: 'center',
                        fontSize: '12px',
                        color: 'var(--capy-accent)',
                        cursor: 'pointer',
                        marginTop: '4px',
                        paddingTop: '8px',
                        borderTop: '1px solid var(--capy-border)',
                        fontWeight: '500'
                     }}>
                       View all requests →
                     </div>
                   </div>
                 ) : (
                   <div style={{padding: '20px 0', textAlign: 'center', color: 'var(--capy-text-secondary)', fontSize: '13px'}}>
                     <div style={{fontSize: '24px', marginBottom: '8px'}}>🦦</div>
                     No pending requests
                   </div>
                 )}
              </div>
            )}
          </div>
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
