import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDatabase, ref, onValue, push, set, update, remove, query, orderByChild, startAt, endAt, get, serverTimestamp, limitToLast } from 'firebase/database';
import { auth } from '../firebase';
import './Cappies.css';
import CapyModal from './CapyModal';
import InitialsAvatar from './InitialsAvatar';

const Cappies = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('friends'); // friends, requests, find
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  // Chat State
  const [activeChat, setActiveChat] = useState(null); // The friend object we are chatting with
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

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

  // Chat Logic
  useEffect(() => {
    if (!user || !activeChat) {
      setMessages([]);
      return;
    }

    const chatId = [user.uid, activeChat.uid].sort().join('_');
    const messagesRef = query(ref(db, `chats/${chatId}/messages`), limitToLast(50));

    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setMessages(msgList);
      } else {
        setMessages([]);
      }
    });

    return () => unsubscribe();
  }, [user, activeChat, db]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clear active chat if friend is removed
  useEffect(() => {
    if (activeChat && !friends.find(f => f.uid === activeChat.uid)) {
      setActiveChat(null);
    }
  }, [friends, activeChat]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !activeChat) return;

    const chatId = [user.uid, activeChat.uid].sort().join('_');
    const messagesRef = ref(db, `chats/${chatId}/messages`);

    try {
      await push(messagesRef, {
        text: newMessage,
        senderId: user.uid,
        timestamp: serverTimestamp(),
        senderName: user.displayName || 'User'
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

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

  const menuItems = [
    { 
      label: 'CapyHome', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg> 
    },
    { 
      label: 'Connections', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> 
    },
    { 
      label: 'CapyDEVS', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg> 
    },
    { 
      label: 'Reels', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg> 
    },
    { 
      label: 'Activities', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> 
    },
    { 
      label: 'Learn', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg> 
    },
    { 
      label: 'Offers', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg> 
    },
    { 
      label: 'Recruit', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg> 
    },
    { 
      label: 'Crew', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> 
    },
    { 
      label: 'Play', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"></rect><path d="M6 12h4m-2-2v4M15 11h.01M18 13h.01"></path></svg> 
    },
    { 
      label: 'Settings', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.09a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.09a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg> 
    },
  ];

  return (
    <div className="cappies-page-wrapper page-transition">
      <aside className="cappies-sidebar">
        <div className="sidebar-menu">
          {menuItems.map((item) => (
            <div 
              key={item.label}
              className={`sidebar-item ${item.label === 'Connections' ? 'active' : ''}`}
              onClick={() => {
                if (item.label === 'CapyHome') navigate('/home');
                else if (item.label === 'Connections') navigate('/connections');
                else if (item.label === 'CapyDEVS') navigate('/devs');
                else if (item.label === 'Profile') navigate('/profile');
              }}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </div>
          ))}
        </div>
      </aside>
      <div className="cappies-container">
      <div className="cappies-header">
        <h2 className="cappies-title">🐾 Cappies</h2>
        <div className="cappies-tabs">
          <button 
            className={`cappies-tab ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            Messages
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
          <div className="cappies-chat-container">
            {/* Left Sidebar - Friend List */}
            <div className="chat-sidebar">
              <div className="chat-sidebar-header">
                Connections
              </div>
              <div className="chat-friends-list">
                {friends.length > 0 ? (
                  friends.map(friend => (
                    <div 
                      key={friend.uid} 
                      className={`chat-friend-item ${activeChat?.uid === friend.uid ? 'active' : ''}`}
                      onClick={() => setActiveChat(friend)}
                    >
                      {friend.photoURL ? (
                        <img 
                          src={friend.photoURL} 
                          alt={friend.displayName} 
                          className="chat-avatar" 
                        />
                      ) : (
                        <InitialsAvatar 
                          name={friend.displayName} 
                          uid={friend.uid} 
                          className="chat-avatar"
                          size={40}
                          fontSize="16px"
                        />
                      )}
                      <div className="chat-friend-info">
                        <span className="chat-friend-name">{friend.displayName || 'Unknown Capy'}</span>
                        <span className="chat-friend-status">Connected</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{padding: '20px', textAlign: 'center', color: 'var(--capy-text-secondary)'}}>
                    No connections yet. Go find some!
                  </div>
                )}
              </div>
            </div>

            {/* Right Main - Chat Area */}
            {activeChat ? (
              <div className="chat-window">
                <div className="chat-window-header">
                  {activeChat.photoURL ? (
                    <img 
                      src={activeChat.photoURL} 
                      alt={activeChat.displayName} 
                      className="chat-header-avatar" 
                    />
                  ) : (
                    <InitialsAvatar 
                      name={activeChat.displayName} 
                      uid={activeChat.uid} 
                      className="chat-header-avatar"
                      size={40}
                      fontSize="16px"
                    />
                  )}
                  <span className="chat-header-name">{activeChat.displayName}</span>
                  <div style={{flex: 1}}></div>
                  <button 
                    className="capy-btn-secondary" 
                    style={{padding: '4px 8px', fontSize: '12px'}}
                    onClick={() => removeFriend(activeChat.uid)}
                  >
                    Remove Connection
                  </button>
                </div>

                <div className="chat-messages">
                  {messages.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`message-bubble ${msg.senderId === user.uid ? 'sent' : 'received'}`}
                    >
                      {msg.text}
                      <span className="message-time">
                        {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                      </span>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <form className="chat-input-area" onSubmit={handleSendMessage}>
                  <input 
                    type="text" 
                    className="chat-input" 
                    placeholder="Type a message..." 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                  <button 
                    type="submit" 
                    className="chat-send-btn"
                    disabled={!newMessage.trim()}
                  >
                    ➤
                  </button>
                </form>
              </div>
            ) : (
              <div className="empty-chat-state">
                <div className="empty-chat-icon">💬</div>
                <h3>Your Messages</h3>
                <p>Select a connection to start chatting</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="cappies-grid">
            {requests.length > 0 ? (
              requests.map(req => (
                <div key={req.uid} className="capy-user-card">
                   {req.photoURL ? (
                     <img src={req.photoURL} alt={req.displayName} className="capy-user-avatar" />
                   ) : (
                     <InitialsAvatar 
                       name={req.displayName} 
                       uid={req.uid} 
                       className="capy-user-avatar"
                       size={80}
                     />
                   )}
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
                  {result.photoURL ? (
                     <img src={result.photoURL} alt={result.displayName} className="capy-user-avatar" />
                  ) : (
                     <InitialsAvatar 
                       name={result.displayName} 
                       uid={result.uid} 
                       className="capy-user-avatar"
                       size={80}
                     />
                  )}
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
    </div>
  );
};

export default Cappies;
