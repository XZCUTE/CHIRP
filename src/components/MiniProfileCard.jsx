import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getDatabase, ref, onValue, set, update, get, remove, push } from 'firebase/database';
import { auth } from '../firebase';
import InitialsAvatar from './InitialsAvatar';
import './MiniProfileCard.css';

const MiniProfileCard = ({ targetUid, position, onClose, initialName, initialAvatar }) => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ posts: 0, score: 0 });
  const [requestStatus, setRequestStatus] = useState(null); // 'none', 'pending', 'friends'
  const [isMe, setIsMe] = useState(false);
  const db = getDatabase();
  const currentUser = auth.currentUser;

  // Calculate card style directly in render to ensure it's always up-to-date
  const getCardStyle = () => {
    if (!position) return { display: 'none' };
    
    const cardWidth = 350;
    const padding = 20;
    let x = position.x;
    let y = position.y;

    // Adjust for horizontal bounds
    if (x + cardWidth > window.innerWidth - padding) {
      // If no space on right, flip to left of the element
      // We need to approximate the element width or just shift it left by cardWidth + elementWidth
      // Since we don't have element width here, we just clamp to window edge
      x = window.innerWidth - cardWidth - padding;
    }
    
    if (x < padding) x = padding;

    // Adjust for vertical bounds
    const cardHeight = 400; // Estimated height
    if (y + cardHeight > window.innerHeight - padding) {
      // If no space below, flip to top
      y = y - cardHeight;
      // If that puts it off top, just clamp to bottom edge
      if (y < padding) {
        y = window.innerHeight - cardHeight - padding;
      }
    }
    if (y < padding) y = padding;

    return {
      position: 'fixed',
      top: `${y}px`,
      left: `${x}px`,
      margin: 0,
      zIndex: 3001,
      backgroundColor: '#18191a',
      opacity: 1,
      display: 'block',
      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.8)',
      pointerEvents: 'auto'
    };
  };

  useEffect(() => {
    if (!targetUid) return;
    setIsMe(currentUser?.uid === targetUid);

    // Fetch target user data
    const userRef = ref(db, `users/${targetUid}`);
    const unsubscribeUser = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      setProfileData(data || {});
      setLoading(false);
    });

    // Fetch All Posts to calculate user stats
    const postsRef = ref(db, 'posts');
    const unsubscribePosts = onValue(postsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const userPosts = Object.values(data).filter(post => post.authorId === targetUid);
        const totalScore = userPosts.reduce((acc, post) => acc + (post.score || 0), 0);
        setStats({
          posts: userPosts.length,
          score: totalScore
        });
      } else {
        setStats({ posts: 0, score: 0 });
      }
    });

    return () => {
      unsubscribeUser();
      unsubscribePosts();
    };
  }, [targetUid, currentUser, isMe, db]);

  // Separate effect for relationship status
  useEffect(() => {
    if (!currentUser || !targetUid || isMe) return;

    const friendsRef = ref(db, `users/${currentUser.uid}/friends/${targetUid}`);
    const requestRef = ref(db, `users/${targetUid}/friendRequests/${currentUser.uid}`);
    
    let isFriend = false;

    // Listen to Friend Status
    const unsubFriends = onValue(friendsRef, (snapshot) => {
      if (snapshot.exists()) {
        isFriend = true;
        setRequestStatus('friends');
      } else {
        isFriend = false;
        // If not friend, check request status immediately (handled by other listener, but check if we need to reset)
        // We defer to the request listener
      }
    });

    // Listen to Request Status
    const unsubRequest = onValue(requestRef, (snapshot) => {
      // If we just initiated an action (like Add Cappy), ignore the very next update if it's "null"/empty,
      // because that might be a stale read or initial state before our write propagates locally.
      // Actually, Firebase local writes are synchronous. 
      // The issue might be that we are setting "pending" optimistically, and then this listener fires with "none" from the server state?
      
      if (actionInProgress.current) {
        // If we are in the middle of an action, we trust our optimistic update more than the listener for a moment.
        // But we need to reset this flag eventually.
        setTimeout(() => { actionInProgress.current = false; }, 500);
        
        // If snapshot exists, it confirms our action, so we can accept it.
        if (snapshot.exists()) {
           setRequestStatus(prev => prev === 'friends' ? 'friends' : 'pending');
           actionInProgress.current = false; // Sync established
        }
        // If snapshot does NOT exist, it might be the "old" state. Ignore it if we expect it to exist.
        return;
      }

      if (snapshot.exists()) {
         setRequestStatus(prev => prev === 'friends' ? 'friends' : 'pending');
      } else {
         setRequestStatus(prev => prev === 'friends' ? 'friends' : 'none');
      }
    });

    return () => {
      unsubFriends();
      unsubRequest();
    };
  }, [currentUser, targetUid, isMe, db]);

  // Track if we are currently performing an action to prevent listener jitter
  const actionInProgress = useRef(false);

  const handleAddCappy = async (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!currentUser || isMe) return;

    // Optimistic UI update: Show "Request Sent" immediately
    setRequestStatus('pending');
    actionInProgress.current = true;

    try {
      // 1. Add to target's friendRequests
      await set(ref(db, `users/${targetUid}/friendRequests/${currentUser.uid}`), {
        timestamp: Date.now(),
        status: 'pending',
        senderName: currentUser.displayName || 'A Capy',
        senderAvatar: currentUser.photoURL || null
      });

      // 2. Add a notification for the target
      const notificationRef = ref(db, `notifications/${targetUid}`);
      const newNotificationRef = push(notificationRef);
      await set(newNotificationRef, {
        type: 'friend_request',
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'A Capy',
        senderAvatar: currentUser.photoURL || null,
        timestamp: Date.now(),
        read: false
      });
      
    } catch (error) {
      console.error("Error sending friend request:", error);
      // Revert if failed
      setRequestStatus('none');
    }
  };

  const handleCancelRequest = async (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!currentUser || isMe) return;

    // Optimistic UI update: Show "Add Cappy" immediately
    setRequestStatus('none');

    try {
      // Remove request from target's friendRequests
      await remove(ref(db, `users/${targetUid}/friendRequests/${currentUser.uid}`));
      
      // We don't necessarily need to remove the notification, but we could if we tracked its ID.
      // For now, just removing the request is enough to reset the state.
    } catch (error) {
      console.error("Error canceling friend request:", error);
      // Revert if failed
      setRequestStatus('pending');
    }
  };

  if (loading) return null;
  if (!profileData) return null;

  const displayName = profileData.displayName || initialName || 'Capy User';
  const avatarURL = profileData.photoURL || profileData.avatar || initialAvatar;
  const coverURL = profileData.coverPhotoURL || profileData.coverURL;

  return createPortal(
    <div className="mini-profile-overlay" onClick={onClose}>
      <div 
        className="mini-profile-card" 
        onClick={(e) => e.stopPropagation()}
        style={getCardStyle()}
      >
        <div  
          className="mini-cover" 
          style={{ 
            backgroundImage: coverURL ? `url(${coverURL})` : 'none',
            backgroundColor: !coverURL ? 'var(--capy-accent)' : 'transparent'
          }}
        />
        <div className="mini-info-section">
          <div className="mini-avatar-wrapper">
            {avatarURL ? (
              <img src={avatarURL} alt={displayName} className="mini-avatar" />
            ) : (
              <InitialsAvatar name={displayName} uid={targetUid} size={80} className="mini-avatar" />
            )}
          </div>
          
          <div className="mini-details">
            <div className="mini-name-row">
              <h2 className="mini-name">{displayName}</h2>
              <span className="mini-role">{profileData.role || 'Green Hat 🟢'}</span>
            </div>
            <p className="mini-bio">{profileData.bio || 'CAPYBARA!'}</p>
            
            <div className="mini-stats">
              <div className="mini-stat-item">
                <span className="mini-stat-value">{stats.posts}</span>
                <span className="mini-stat-label">Posts</span>
              </div>
              <div className="mini-stat-item">
                <span className="mini-stat-value">{profileData.friends ? Object.keys(profileData.friends).length : 0}</span>
                <span className="mini-stat-label">Cappies</span>
              </div>
              <div className="mini-stat-item">
                <span className="mini-stat-value">{stats.score}</span>
                <span className="mini-stat-label">Total Score</span>
              </div>
            </div>

            <div className="mini-actions">
              {!isMe && (
                <>
                  {requestStatus === 'none' && (
                    <button className="add-cappy-btn" onClick={handleAddCappy}>Add Cappy</button>
                  )}
                  {requestStatus === 'pending' && (
                    <button 
                      className="add-cappy-btn pending" 
                      onClick={handleCancelRequest}
                      style={{ cursor: 'pointer', opacity: 1 }}
                      onMouseEnter={(e) => e.target.textContent = 'Cancel Request'}
                      onMouseLeave={(e) => e.target.textContent = 'Request Sent'}
                    >
                      Request Sent
                    </button>
                  )}
                  {requestStatus === 'friends' && (
                    <button className="add-cappy-btn friends">Friends</button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MiniProfileCard;
