import React, { useState, useEffect } from 'react';
import { getDatabase, ref, onValue, push, set, update, remove, query, orderByChild, startAt, endAt, get } from 'firebase/database';
import { auth } from '../firebase';
import './Cappies.css';
import CapyModal from './CapyModal';

const Cappies = () => {
  const [activeTab, setActiveTab] = useState('friends'); // friends, requests, find
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  // Modal State
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'alert',
    message: '',
    onConfirm: null,
    title: ''
  });

  const showModal = ({ type = 'alert', message, onConfirm = null, title = '' }) => {
    setModalConfig({ isOpen: true, type, message, onConfirm, title });
  };

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const db = getDatabase();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Listen for friends
        const friendsRef = ref(db, `users/${currentUser.uid}/friends`);
        onValue(friendsRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            // Fetch details for each friend
            const friendPromises = Object.keys(data).map(async (friendId) => {
              const userSnapshot = await get(ref(db, `users/${friendId}`));
              return { uid: friendId, ...userSnapshot.val() };
            });
            Promise.all(friendPromises).then(setFriends);
          } else {
            setFriends([]);
          }
        });

        // Listen for requests
        const requestsRef = ref(db, `users/${currentUser.uid}/friendRequests`);
        onValue(requestsRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
             const reqPromises = Object.keys(data).map(async (senderId) => {
              const userSnapshot = await get(ref(db, `users/${senderId}`));
              return { uid: senderId, ...userSnapshot.val() };
            });
            Promise.all(reqPromises).then(setRequests);
          } else {
            setRequests([]);
          }
        });
      } else {
        setUser(null);
        setFriends([]);
        setRequests([]);
      }
    });

    return () => unsubscribe();
  }, [db]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      // Simple search by display name
      // Note: This requires .indexOn: ["displayName"] in Firebase rules for better performance
      const usersRef = ref(db, 'users');
      const q = query(usersRef, orderByChild('displayName'), startAt(searchQuery), endAt(searchQuery + "\uf8ff"));
      
      const snapshot = await get(q);
      const results = [];
      snapshot.forEach((childSnapshot) => {
        const userData = childSnapshot.val();
        if (childSnapshot.key !== user.uid) { // Don't show self
           results.push({ uid: childSnapshot.key, ...userData });
        }
      });
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (targetUid) => {
    if (!user) return;
    try {
      await set(ref(db, `users/${targetUid}/friendRequests/${user.uid}`), {
        timestamp: Date.now(),
        status: 'pending'
      });
      showModal({ message: 'Friend request sent!', title: 'Success' });
    } catch (error) {
      console.error("Error sending request:", error);
    }
  };

  const acceptRequest = async (requesterUid) => {
    if (!user) return;
    try {
      // Add to my friends
      await set(ref(db, `users/${user.uid}/friends/${requesterUid}`), true);
      // Add me to their friends
      await set(ref(db, `users/${requesterUid}/friends/${user.uid}`), true);
      // Remove request
      await remove(ref(db, `users/${user.uid}/friendRequests/${requesterUid}`));
    } catch (error) {
      console.error("Error accepting request:", error);
    }
  };

  const rejectRequest = async (requesterUid) => {
    if (!user) return;
    try {
      await remove(ref(db, `users/${user.uid}/friendRequests/${requesterUid}`));
    } catch (error) {
      console.error("Error rejecting request:", error);
    }
  };

  const removeFriend = async (friendUid) => {
      if(!user) return;
      if(window.confirm("Are you sure you want to remove this Cappie?")) {
          try {
              await remove(ref(db, `users/${user.uid}/friends/${friendUid}`));
              await remove(ref(db, `users/${friendUid}/friends/${user.uid}`));
          } catch (error) {
              console.error("Error removing friend:", error);
          }
      }
  }

  return (
    <div className="cappies-container">
      <div className="cappies-header">
        <h2 className="cappies-title">🐾 Cappies</h2>
        <div className="cappies-tabs">
          <button 
            className={`cappies-tab ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            My Cappies ({friends.length})
          </button>
          <button 
            className={`cappies-tab ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            Requests ({requests.length})
          </button>
          <button 
            className={`cappies-tab ${activeTab === 'find' ? 'active' : ''}`}
            onClick={() => setActiveTab('find')}
          >
            Find Cappies
          </button>
        </div>
      </div>

      <div className="cappies-content">
        {activeTab === 'friends' && (
          <div className="cappies-grid">
            {friends.length > 0 ? (
              friends.map(friend => (
                <div key={friend.uid} className="capy-user-card">
                  <img src={friend.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.uid}`} alt={friend.displayName} className="capy-user-avatar" />
                  <h3 className="capy-user-name">{friend.displayName || 'Unknown Capy'}</h3>
                  <span className="capy-user-role">{friend.role || 'Capy User'}</span>
                  <div className="capy-user-actions">
                    <button className="capy-btn-secondary" onClick={() => removeFriend(friend.uid)}>Remove</button>
                    <button className="capy-btn-primary">Message</button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <span className="empty-icon">😢</span>
                <p>No Cappies yet. Go find some friends!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="cappies-grid">
            {requests.length > 0 ? (
              requests.map(req => (
                <div key={req.uid} className="capy-user-card">
                   <img src={req.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.uid}`} alt={req.displayName} className="capy-user-avatar" />
                  <h3 className="capy-user-name">{req.displayName || 'Unknown Capy'}</h3>
                  <span className="capy-user-role">{req.role || 'Capy User'}</span>
                  <div className="capy-user-actions">
                    <button className="capy-btn-primary" onClick={() => acceptRequest(req.uid)}>Accept</button>
                    <button className="capy-btn-secondary" onClick={() => rejectRequest(req.uid)}>Decline</button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <span className="empty-icon">📭</span>
                <p>No pending friend requests.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'find' && (
          <div>
            <form onSubmit={handleSearch} className="cappies-search-box">
              <input 
                type="text" 
                className="cappies-search-input" 
                placeholder="Search by name..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="cappies-search-btn" disabled={loading}>
                {loading ? 'Searching...' : 'Search'}
              </button>
            </form>

            <div className="cappies-grid">
              {searchResults.map(result => (
                <div key={result.uid} className="capy-user-card">
                   <img src={result.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${result.uid}`} alt={result.displayName} className="capy-user-avatar" />
                  <h3 className="capy-user-name">{result.displayName || 'Unknown Capy'}</h3>
                  <span className="capy-user-role">{result.role || 'Capy User'}</span>
                  <div className="capy-user-actions">
                    {friends.some(f => f.uid === result.uid) ? (
                        <button className="capy-btn-secondary" disabled>Already Friends</button>
                    ) : (
                        <button className="capy-btn-primary" onClick={() => sendFriendRequest(result.uid)}>Add Cappie</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
             {searchResults.length === 0 && !loading && searchQuery && (
                 <div className="empty-state">
                    <p>No capybaras found matching "{searchQuery}"</p>
                 </div>
             )}
          </div>
        )}
      </div>
      <CapyModal {...modalConfig} onClose={closeModal} />
    </div>
  );
};

export default Cappies;
