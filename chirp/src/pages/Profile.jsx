import React, { useState, useEffect } from 'react';
import { getDatabase, ref, onValue, update, query, orderByChild, equalTo } from 'firebase/database';
import { auth } from '../firebase';
import './Profile.css';
import CapyModal from '../components/CapyModal';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [friendsCount, setFriendsCount] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ displayName: '', bio: '', role: '' });
  
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
        
        // Fetch User Data
        const userRef = ref(db, `users/${currentUser.uid}`);
        onValue(userRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            setProfileData(data);
            setEditForm({
              displayName: data.displayName || currentUser.displayName || '',
              bio: data.bio || '',
              role: data.role || 'GreenCapy 🟢'
            });
            
            // Count friends
            if (data.friends) {
              setFriendsCount(Object.keys(data.friends).length);
            } else {
              setFriendsCount(0);
            }
          }
        });

        // Fetch User Posts
        const postsRef = ref(db, 'posts');
        // Note: For better performance, use: query(postsRef, orderByChild('authorId'), equalTo(currentUser.uid))
        // And ensure .indexOn: ["authorId"] is in rules
        onValue(postsRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const userPosts = Object.entries(data)
              .map(([key, value]) => ({ id: key, ...value }))
              .filter(post => post.authorId === currentUser.uid)
              .sort((a, b) => b.timestamp - a.timestamp);
            setPosts(userPosts);
          } else {
            setPosts([]);
          }
        });

      } else {
        setUser(null);
        setProfileData(null);
      }
    });

    return () => unsubscribe();
  }, [db]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!user) return;

    try {
      await update(ref(db, `users/${user.uid}`), {
        displayName: editForm.displayName,
        bio: editForm.bio,
        role: editForm.role
      });
      setIsEditing(false);
      // Optional: Update Auth profile
      // await updateProfile(user, { displayName: editForm.displayName });
    } catch (error) {
      console.error("Error updating profile:", error);
      showModal({ message: "Failed to update profile.", title: "Error" });
    }
  };

  if (!user || !profileData) {
    return <div className="profile-container">Loading...</div>;
  }

  return (
    <div className="profile-container">
      {/* Header */}
      <div className="profile-header">
        <div className="profile-cover"></div>
        <div className="profile-info-section">
          <div className="profile-avatar-wrapper">
            <img 
              src={profileData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
              alt="Profile" 
              className="profile-avatar" 
            />
          </div>
          
          <div className="profile-actions">
            {isEditing ? (
              <>
                <button className="cancel-btn" onClick={() => setIsEditing(false)}>Cancel</button>
                <button className="save-btn" onClick={handleUpdateProfile}>Save Changes</button>
              </>
            ) : (
              <button className="edit-profile-btn" onClick={() => setIsEditing(true)}>Edit Profile</button>
            )}
          </div>

          <div className="profile-details">
            {isEditing ? (
              <form className="edit-form">
                <div className="edit-input-group">
                  <label>Display Name</label>
                  <input 
                    type="text" 
                    className="edit-input" 
                    value={editForm.displayName} 
                    onChange={(e) => setEditForm({...editForm, displayName: e.target.value})}
                  />
                </div>
                <div className="edit-input-group">
                  <label>Role (Tag)</label>
                  <select 
                    className="edit-input" 
                    value={editForm.role}
                    onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                  >
                    <option value="GreenCapy 🟢">GreenCapy 🟢 (Beginner)</option>
                    <option value="BlueCapy 🔵">BlueCapy 🔵 (Defender)</option>
                    <option value="RedCapy 🔴">RedCapy 🔴 (Attacker)</option>
                    <option value="WhiteCapy ⚪">WhiteCapy ⚪ (Ethical)</option>
                    <option value="PurpleCapy 🟣">PurpleCapy 🟣 (Mixed)</option>
                  </select>
                </div>
                <div className="edit-input-group">
                  <label>Bio</label>
                  <textarea 
                    className="edit-textarea" 
                    value={editForm.bio} 
                    onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                  />
                </div>
              </form>
            ) : (
              <>
                <h1 className="profile-name">{profileData.displayName}</h1>
                <span className="profile-role">{profileData.role || 'GreenCapy 🟢'}</span>
                <p className="profile-bio">{profileData.bio || 'No bio yet.'}</p>
              </>
            )}

            <div className="profile-stats">
              <div className="stat-item">
                <span className="stat-value">{posts.length}</span>
                <span className="stat-label">Posts</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{friendsCount}</span>
                <span className="stat-label">Cappies</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">0</span>
                <span className="stat-label">Following</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="profile-content">
        {/* Main Feed */}
        <div className="profile-feed">
          <h3 className="sidebar-title">My Posts</h3>
          {posts.length > 0 ? (
            posts.map(post => (
              <div key={post.id} className="capy-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--capy-text)' }}>{post.author}</span>
                  <span style={{ color: 'var(--capy-text-secondary)', fontSize: '12px' }}>
                    {new Date(post.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <p style={{ color: 'var(--capy-text)', margin: '0 0 10px 0' }}>{post.content}</p>
                {post.image && (
                   <img src={post.image} alt="Post" style={{ width: '100%', borderRadius: '8px', marginTop: '10px' }} />
                )}
                <div style={{ display: 'flex', gap: '15px', marginTop: '15px', borderTop: '1px solid var(--capy-border)', paddingTop: '10px' }}>
                   <span style={{ color: 'var(--capy-text-secondary)' }}>👍 {post.likes || 0}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="capy-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--capy-text-secondary)' }}>
              No posts yet.
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="profile-sidebar">
          <div className="sidebar-box">
            <h3 className="sidebar-title">About</h3>
            <p style={{ color: 'var(--capy-text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
              Joined: {new Date(user.metadata.creationTime).toLocaleDateString()}
            </p>
            <p style={{ color: 'var(--capy-text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
              Email: {user.email}
            </p>
          </div>
        </div>
      </div>
      <CapyModal {...modalConfig} onClose={closeModal} />
    </div>
  );
};

export default Profile;
