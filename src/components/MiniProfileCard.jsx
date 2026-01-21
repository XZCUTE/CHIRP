import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getDatabase, ref, onValue, set, update, get, remove } from 'firebase/database';
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
    const unsubFriends = onValue(friendsRef, (snapshot) => {
      if (snapshot.exists()) {
        setRequestStatus('friends');
      } else {
        const requestRef = ref(db, `users/${targetUid}/friendRequests/${currentUser.uid}`);
        onValue(requestRef, (snapshot) => {
          if (snapshot.exists()) {
            setRequestStatus('pending');
          } else {
            setRequestStatus('none');
          }
        }, { onlyOnce: true });
      }
    });

    return () => unsubFriends();
  }, [currentUser, targetUid, isMe, db]);

  const handleAddCappy = async () => {
    if (!currentUser || isMe) return;

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

      setRequestStatus('pending');
    } catch (error) {
      console.error("Error sending friend request:", error);
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
                    <button className="add-cappy-btn pending" disabled>Request Sent</button>
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
