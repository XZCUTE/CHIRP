import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getDatabase, ref, onValue, update, remove, query, orderByChild, equalTo, push, runTransaction, serverTimestamp } from 'firebase/database';
import { updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import './Profile.css';
import '../components/CapyHome.css';
import CapyModal from '../components/CapyModal';
import InitialsAvatar from '../components/InitialsAvatar';
import { uploadToImgBB, deleteFromImgBB } from '../utils/imgbb';
import { extractColor } from '../utils/colorUtils';

const Profile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [allPosts, setAllPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState({});
  const [activeTab, setActiveTab] = useState('posts');
  const [friendsCount, setFriendsCount] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ displayName: '', bio: '', role: '', birthdate: '' });
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [isAvatarRemoved, setIsAvatarRemoved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Cover Photo State
  const [selectedCover, setSelectedCover] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [isCoverRemoved, setIsCoverRemoved] = useState(false);
  const [themeColor, setThemeColor] = useState(null);
  
  // Post Interaction State
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editContent, setEditContent] = useState('');
  
  // Comment State
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [commentsData, setCommentsData] = useState({});
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [openCommentDropdownId, setOpenCommentDropdownId] = useState(null);
  
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
              role: data.role || 'Green Hat 🟢'
            });
            
            // Count friends
            if (data.friends) {
              setFriendsCount(Object.keys(data.friends).length);
            } else {
              setFriendsCount(0);
            }
          }
        });

        // Fetch Saved Posts
        const savedRef = ref(db, `users/${currentUser.uid}/savedPosts`);
        onValue(savedRef, (snapshot) => {
          const data = snapshot.val() || {};
          setSavedPosts(data);
        });

        // Fetch All Posts (needed for Saves tab and calculating stats)
        const postsRef = ref(db, 'posts');
        onValue(postsRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const postsArray = Object.entries(data)
              .map(([key, value]) => ({ id: key, ...value }))
              .sort((a, b) => b.timestamp - a.timestamp);
            setAllPosts(postsArray);
          } else {
            setAllPosts([]);
          }
        });

      } else {
        setUser(null);
        setProfileData(null);
        setAllPosts([]);
        setSavedPosts({});
      }
    });

    return () => unsubscribe();
  }, [db]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.post-options-container') && 
          !event.target.closest('.comment-options-container')) {
        setOpenDropdownId(null);
        setOpenCommentDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen for comments when a post is expanded
  useEffect(() => {
    if (!activeCommentPostId) return;

    const commentsRef = ref(db, `posts/${activeCommentPostId}/comments_list`);
    const unsubscribe = onValue(commentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedComments = Object.entries(data).map(([key, val]) => ({
          id: key,
          ...val
        })).sort((a, b) => a.timestamp - b.timestamp);
        
        setCommentsData(prev => ({
          ...prev,
          [activeCommentPostId]: loadedComments
        }));
      } else {
        setCommentsData(prev => ({
          ...prev,
          [activeCommentPostId]: []
        }));
      }
    });

    return () => unsubscribe();
  }, [activeCommentPostId, db]);

  const handleAvatarSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.match(/image\/(jpeg|jpg|png|gif|webp)/)) {
      showModal({ message: "Only .jpg, .png, .gif, .webp formats are allowed!", title: "Invalid File" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showModal({ message: "File size must be less than 5MB!", title: "File Too Large" });
      return;
    }

    setSelectedAvatar(file);
    setAvatarPreview(URL.createObjectURL(file));
    
    // Clear input to allow selecting the same file again if needed
    e.target.value = null;
  };

  const handleRemoveAvatar = () => {
    setSelectedAvatar(null);
    setAvatarPreview(null);
    setIsAvatarRemoved(true);
    // Reset file input value
    const fileInput = document.getElementById('avatar-upload');
    if (fileInput) fileInput.value = '';
  };

  const handleCoverSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.match(/image\/(jpeg|jpg|png|gif|webp)/)) {
      showModal({ message: "Only .jpg, .png, .gif, .webp formats are allowed!", title: "Invalid File" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showModal({ message: "File size must be less than 5MB!", title: "File Too Large" });
      return;
    }

    setSelectedCover(file);
    const previewUrl = URL.createObjectURL(file);
    setCoverPreview(previewUrl);
    setIsCoverRemoved(false);
    
    // Extract color for theme
    try {
      const color = await extractColor(previewUrl);
      if (color) setThemeColor(color);
    } catch (err) {
      console.error("Failed to extract color", err);
    }
    
    // Clear input
    e.target.value = null;
  };

  const handleRemoveCover = () => {
    setSelectedCover(null);
    setCoverPreview(null);
    setIsCoverRemoved(true);
    setThemeColor(null); // Reset to default/random
    // Reset file input
    const fileInput = document.getElementById('cover-upload');
    if (fileInput) fileInput.value = '';
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      let photoURL = profileData.photoURL;
      let photoDeleteURL = profileData.photoDeleteURL || null;
      let coverPhotoURL = profileData.coverPhotoURL || null;
      let coverPhotoDeleteURL = profileData.coverPhotoDeleteURL || null;

      // Check if we need to delete the current avatar from ImgBB
      const shouldDeleteOldAvatar = (isAvatarRemoved || selectedAvatar) && photoDeleteURL;
      
      if (shouldDeleteOldAvatar) {
          await deleteFromImgBB(photoDeleteURL);
          photoURL = null;
          photoDeleteURL = null;
      }

      if (selectedAvatar) {
        const uploadData = await uploadToImgBB(selectedAvatar);
        photoURL = uploadData.url;
        photoDeleteURL = uploadData.deleteUrl;
      } else if (isAvatarRemoved) {
        photoURL = null;
        photoDeleteURL = null;
      }

      // Handle Cover Photo
      const shouldDeleteOldCover = (isCoverRemoved || selectedCover) && coverPhotoDeleteURL;

      if (shouldDeleteOldCover) {
        await deleteFromImgBB(coverPhotoDeleteURL);
        coverPhotoURL = null;
        coverPhotoDeleteURL = null;
      }

      if (selectedCover) {
        const uploadData = await uploadToImgBB(selectedCover);
        coverPhotoURL = uploadData.url;
        coverPhotoDeleteURL = uploadData.deleteUrl;
      } else if (isCoverRemoved) {
        coverPhotoURL = null;
        coverPhotoDeleteURL = null;
      }

      await update(ref(db, `users/${user.uid}`), {
        displayName: editForm.displayName,
        bio: editForm.bio,
        role: editForm.role,
        birthdate: editForm.birthdate || null,
        photoURL: photoURL,
        photoDeleteURL: photoDeleteURL,
        coverPhotoURL: coverPhotoURL,
        coverPhotoDeleteURL: coverPhotoDeleteURL,
        themeColor: themeColor || profileData.themeColor || null
      });

      // Update Auth Profile for synchronization
      await updateProfile(user, {
        displayName: editForm.displayName,
        photoURL: photoURL
      });

      // Notify other components (like Navbar) of the update
      window.dispatchEvent(new Event('profileUpdated'));

      setIsEditing(false);
      setSelectedAvatar(null);
      setAvatarPreview(null);
      setIsAvatarRemoved(false);
      setSelectedCover(null);
      setCoverPreview(null);
      setIsCoverRemoved(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      showModal({ message: "Failed to update profile.", title: "Error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProfile = () => {
    showModal({
      type: 'confirm',
      title: 'Delete Account',
      message: 'Are you sure you want to delete your account? This action cannot be undone.',
      onConfirm: async () => {
        try {
          // Delete avatar from ImgBB if exists
          if (profileData.photoDeleteURL) {
            await deleteFromImgBB(profileData.photoDeleteURL);
          }
          
          // Delete user data from Realtime Database
          await remove(ref(db, `users/${user.uid}`));
          
          // Delete user from Authentication
          await user.delete();
          
          // Redirect handled by Auth listener in App.jsx usually, or we can force it
          // navigate('/'); 
        } catch (error) {
          console.error("Error deleting account:", error);
          showModal({ message: "Failed to delete account. Please log in again and try.", title: "Error" });
        }
      }
    });
  };

  if (!user || !profileData) {
    return <div className="profile-container">Loading...</div>;
  }

  const displayAvatarUrl = avatarPreview || (!isAvatarRemoved && (profileData.photoURL || user.photoURL));

  const totalScore = allPosts
    .filter(post => post.authorId === user.uid)
    .reduce((sum, post) => sum + (post.score || 0), 0);

  const getDisplayedPosts = () => {
    if (activeTab === 'posts') {
      return allPosts.filter(post => post.authorId === user.uid && !post.repostOf);
    } else if (activeTab === 'reposts') {
      return allPosts.filter(post => post.authorId === user.uid && post.repostOf);
    } else if (activeTab === 'saves') {
      return allPosts.filter(post => savedPosts[post.id]);
    }
    return [];
  };

  const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes} min. ago`;
    if (hours < 24) return `${hours} hr. ago`;
    return `${days} days ago`;
  };

  const handleVote = (postId, direction) => {
    if (!user) return showModal({ message: "Please login to vote!", title: "Login Required" });
    const postRef = ref(db, `posts/${postId}`);
    runTransaction(postRef, (post) => {
      if (post) {
        if (!post.userVotes) post.userVotes = {};
        const currentVote = post.userVotes[user.uid] || 0;
        
        if (currentVote === direction) {
          post.score = (post.score || 0) - direction;
          post.userVotes[user.uid] = null;
        } else {
          post.score = (post.score || 0) - currentVote + direction;
          post.userVotes[user.uid] = direction;
        }
      }
      return post;
    });
  };

  const handleRepost = async (post) => {
    if (!user) return showModal({ message: "Please login to repost!", title: "Login Required" });
    
    const sourcePost = post.repostData ? post.repostData : post;

    showModal({
      type: 'confirm',
      title: 'Repost Chirp',
      message: "Repost this chirp to your feed?",
      onConfirm: async () => {
        const postRef = ref(db, `posts/${post.id}/shares`);
        runTransaction(postRef, (current) => (current || 0) + 1);

        try {
            const newPost = {
                content: '',
                author: user.displayName || 'Anonymous Capy',
                authorId: user.uid,
                avatar: user.photoURL || null,
                role: 'User',
                timestamp: serverTimestamp(),
                likes: 0,
                comments: 0,
                shares: 0,
                privacy: 'world',
                repostOf: sourcePost.id || post.id,
                repostData: {
                    id: sourcePost.id || post.id,
                    author: sourcePost.author,
                    authorId: sourcePost.authorId,
                    avatar: sourcePost.avatar,
                    content: sourcePost.content,
                    image: sourcePost.image || null,
                    linkPreview: sourcePost.linkPreview || null,
                    timestamp: sourcePost.timestamp
                }
            };
            
            await push(ref(db, 'posts'), newPost);
            closeModal();
        } catch (e) {
            console.error("Repost failed", e);
        }
      }
    });
  };

  const handleSavePost = async (postId) => {
    if (!user) return showModal({ message: "Please login to save posts!", title: "Login Required" });
    
    const isSaved = savedPosts[postId];
    const updates = {};
    if (isSaved) {
      updates[`users/${user.uid}/savedPosts/${postId}`] = null;
    } else {
      updates[`users/${user.uid}/savedPosts/${postId}`] = true;
    }
    
    try {
      await update(ref(db), updates);
    } catch (error) {
      console.error("Error toggling save:", error);
      showModal({ message: "Failed to save/unsave post.", title: "Error" });
    }
  };

  const toggleComments = (postId) => {
    if (activeCommentPostId === postId) {
      setActiveCommentPostId(null);
    } else {
      setActiveCommentPostId(postId);
    }
  };

  const handleSubmitComment = async (postId) => {
    if (!commentText.trim()) return;
    if (!user) return showModal({ message: "Please login to comment!", title: "Login Required" });

    try {
      await push(ref(db, `posts/${postId}/comments_list`), {
        text: commentText,
        author: user.displayName || 'Anonymous Capy',
        authorId: user.uid,
        avatar: user.photoURL || null,
        timestamp: serverTimestamp()
      });

      runTransaction(ref(db, `posts/${postId}`), (post) => {
        if (post) {
          post.comments = (post.comments || 0) + 1;
        }
        return post;
      });

      setCommentText('');
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const handleEditCommentClick = (comment) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.text);
    setOpenCommentDropdownId(null);
  };

  const handleSaveEditComment = async (postId, commentId) => {
    if (!editCommentText.trim()) return;
    try {
      await update(ref(db, `posts/${postId}/comments_list/${commentId}`), {
        text: editCommentText,
        isEdited: true
      });
      setEditingCommentId(null);
      setEditCommentText('');
    } catch (error) {
      console.error("Error updating comment:", error);
      showModal({ message: "Failed to update comment.", title: "Error" });
    }
  };

  const handleDeleteCommentClick = (postId, commentId) => {
    setOpenCommentDropdownId(null);
    showModal({
      type: 'confirm',
      title: 'Delete Comment',
      message: "Are you sure you want to delete this comment?",
      onConfirm: async () => {
        try {
          await remove(ref(db, `posts/${postId}/comments_list/${commentId}`));
          runTransaction(ref(db, `posts/${postId}`), (post) => {
            if (post && post.comments > 0) {
              post.comments--;
            }
            return post;
          });
          closeModal();
        } catch (error) {
          console.error("Error deleting comment:", error);
          showModal({ message: "Failed to delete comment.", title: "Error" });
        }
      }
    });
  };

  const toggleDropdown = (postId) => {
    setOpenDropdownId(openDropdownId === postId ? null : postId);
  };

  const handleEditClick = (post) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
    setOpenDropdownId(null);
  };

  const handleSaveEdit = async (postId) => {
    if (!editContent.trim()) return;
    try {
      await update(ref(db, `posts/${postId}`), {
        content: editContent,
        isEdited: true
      });
      setEditingPostId(null);
      setEditContent('');
    } catch (error) {
      console.error("Error updating post:", error);
      showModal({ message: "Failed to update post.", title: "Error" });
    }
  };

  const handleDeleteClick = (post) => {
    setOpenDropdownId(null);
    showModal({
      type: 'confirm',
      title: 'Delete Chirp',
      message: "Are you sure you want to delete this post?",
      onConfirm: async () => {
        try {
          if (post.imageDeleteUrl) {
            await deleteFromImgBB(post.imageDeleteUrl);
          }

          await remove(ref(db, `posts/${post.id}`));
          
          if (post.repostOf) {
            const sharesRef = ref(db, `posts/${post.repostOf}/shares`);
            runTransaction(sharesRef, (current) => {
              return (current && current > 0) ? current - 1 : 0;
            });
          }

          closeModal();
        } catch (error) {
          console.error("Error deleting post:", error);
          showModal({ message: "Failed to delete post.", title: "Error" });
        }
      }
    });
  };

  if (!user || !profileData) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        color: 'var(--capy-text-secondary)' 
      }}>
        Loading profile...
      </div>
    );
  }

  const displayedPosts = getDisplayedPosts();

  const displayCoverUrl = coverPreview || (!isCoverRemoved && profileData.coverPhotoURL);
  
  // Dynamic Styles
  const containerStyle = {
    '--capy-accent': themeColor || profileData.themeColor || '#d2691e'
  };

  return (
    <div className="profile-container page-transition" style={containerStyle}>
      {/* Header */}
      <div className="profile-header">
        <div 
            className="profile-cover" 
            style={{ 
                backgroundImage: displayCoverUrl 
                  ? `url(${displayCoverUrl})` 
                  : (themeColor || profileData.themeColor 
                      ? 'none' 
                      : 'linear-gradient(45deg, var(--capy-primary-dark), #2a1a0f)'),
                backgroundColor: !displayCoverUrl && (themeColor || profileData.themeColor) 
                  ? (themeColor || profileData.themeColor) 
                  : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            }}
        >
            {isEditing && (
                <div className="cover-edit-overlay">
                     <label htmlFor="cover-upload" className="cover-action-btn upload-btn" title="Upload Cover">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                            <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                        <span>Change Cover</span>
                     </label>
                     <input 
                        type="file" 
                        id="cover-upload" 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={handleCoverSelect}
                    />
                    {displayCoverUrl && (
                        <button 
                            className="cover-action-btn remove-btn" 
                            onClick={(e) => { e.preventDefault(); handleRemoveCover(); }}
                            title="Remove Cover"
                        >
                             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                             </svg>
                        </button>
                    )}
                </div>
            )}
        </div>
        <div className="profile-info-section">
          <div className="profile-avatar-wrapper">
            {displayAvatarUrl ? (
              <img 
                src={displayAvatarUrl} 
                alt="Profile" 
                className="profile-avatar" 
              />
            ) : (
              <InitialsAvatar 
                name={profileData.displayName || user.displayName || user.email}
                uid={user.uid}
                className="profile-avatar"
                size={120}
                fontSize="48px"
              />
            )}
            {isEditing && (
              <div className="avatar-edit-overlay">
                <label htmlFor="avatar-upload" className="avatar-action-btn upload-btn" title="Upload Photo">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                  </svg>
                </label>
                <input 
                  type="file" 
                  id="avatar-upload" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={handleAvatarSelect}
                />
                {((profileData.photoURL && !isAvatarRemoved) || avatarPreview) && (
                  <button 
                    className="avatar-action-btn remove-btn" 
                    onClick={(e) => { e.preventDefault(); handleRemoveAvatar(); }}
                    title="Remove Photo"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
          
          <div className="profile-details">
            <div className="profile-header-row">
              <div className="profile-identity-section">
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
                        <option value="Black Hat ⚫">Black Hat ⚫ (Malicious hacker)</option>
                        <option value="White Hat ⚪">White Hat ⚪ (Ethical hacker)</option>
                        <option value="Grey Hat 🔘">Grey Hat 🔘 (Not malicious, but not always ethical)</option>
                        <option value="Green Hat 🟢">Green Hat 🟢 (New, unskilled hacker)</option>
                        <option value="Blue Hat 🔵">Blue Hat 🔵 (Vengeful hacker)</option>
                        <option value="Red Hat 🔴">Red Hat 🔴 (Vigilante hacker)</option>
                        <option value="Purple Hat 🟣">Purple Hat 🟣 (Hacks their own systems)</option>
                      </select>
                    </div>
                  </form>
                ) : (
                  <div className="profile-identity">
                    <h1 className="profile-name">{profileData.displayName}</h1>
                    <span className="profile-role">{profileData.role || 'Green Hat 🟢'}</span>
                  </div>
                )}
              </div>

              <div className="profile-actions">
                {isEditing ? (
                  <>
                    <button className="cancel-btn" onClick={() => { 
                        setIsEditing(false); 
                        setSelectedAvatar(null); 
                        setAvatarPreview(null); 
                        setIsAvatarRemoved(false);
                        setSelectedCover(null);
                        setCoverPreview(null);
                        setIsCoverRemoved(false);
                    }}>Cancel</button>
                    <button className="profile-save-btn" onClick={handleUpdateProfile} disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                ) : (
                  <button className="edit-profile-btn" onClick={() => setIsEditing(true)}>Edit Profile</button>
                )}
              </div>
            </div>

            {isEditing ? (
              <div className="edit-form-extras">
                <div className="edit-input-group">
                  <label>Bio</label>
                  <textarea 
                    className="edit-textarea" 
                    value={editForm.bio} 
                    onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                  />
                </div>
                <div className="edit-input-group">
                  <label>Birthdate</label>
                  <input 
                    type="date" 
                    className="edit-input" 
                    value={editForm.birthdate} 
                    onChange={(e) => setEditForm({...editForm, birthdate: e.target.value})}
                  />
                </div>
                
                <div className="edit-input-group" style={{ marginTop: '20px', borderTop: '1px solid var(--capy-border)', paddingTop: '20px' }}>
                  <button 
                    type="button" 
                    onClick={(e) => { e.preventDefault(); handleDeleteProfile(); }}
                    style={{ 
                      backgroundColor: 'rgba(255, 68, 68, 0.1)', 
                      color: '#ff4444', 
                      padding: '10px 15px', 
                      border: '1px solid #ff4444', 
                      borderRadius: '8px', 
                      cursor: 'pointer', 
                      width: '100%',
                      fontWeight: 'bold',
                      fontSize: '0.9rem'
                    }}
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            ) : (
              <p className="profile-bio">{profileData.bio || 'No bio yet.'}</p>
            )}

            <div className="profile-stats">
              <div className="stat-item">
                <span className="stat-value">{allPosts.filter(p => p.authorId === user.uid).length}</span>
                <span className="stat-label">Posts</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{friendsCount}</span>
                <span className="stat-label">Cappies</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{totalScore}</span>
                <span className="stat-label">Total Score</span>
              </div>
            </div>

            <div className="profile-tabs">
              <div 
                className={`profile-tab ${activeTab === 'posts' ? 'active' : ''}`}
                onClick={() => setActiveTab('posts')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="3" y1="9" x2="21" y2="9"></line>
                  <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
                MY POSTS
              </div>
              <div 
                className={`profile-tab ${activeTab === 'saves' ? 'active' : ''}`}
                onClick={() => setActiveTab('saves')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
                SAVES
              </div>
              <div 
                className={`profile-tab ${activeTab === 'reposts' ? 'active' : ''}`}
                onClick={() => setActiveTab('reposts')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17 1 21 5 17 9"></polyline>
                  <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                  <polyline points="7 23 3 19 7 15"></polyline>
                  <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                </svg>
                REPOSTS
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="profile-content">
        {/* Main Feed */}
        <div className="profile-feed">
          {displayedPosts.length > 0 ? (
            displayedPosts.map((post, index) => (
              <div 
                key={post.id} 
                className="post-card capy-card"
                style={{ animation: `slideUp 0.5s ease-out ${index * 0.1}s backwards` }}
              >
                <div className="post-header">
                  {((user && post.authorId === user.uid && user.photoURL) || (post.authorId !== user?.uid && post.avatar && !post.avatar.includes('dicebear'))) ? (
                    <img 
                      src={(user && post.authorId === user.uid) ? user.photoURL : post.avatar} 
                      alt={post.author} 
                      className="post-avatar" 
                    />
                  ) : (
                    <InitialsAvatar 
                      name={post.author} 
                      uid={post.authorId} 
                      className="post-avatar"
                      size={40}
                    />
                  )}
                  <div className="post-info">
                    <span className="post-author">{post.author}</span>
                    <span className="post-separator">•</span>
                    <span className="post-time">
                      {getRelativeTime(post.timestamp)}
                      {post.privacy === 'cappies' && <span title="Friends Only" style={{marginLeft: '4px'}}>🐾</span>}
                      {post.privacy === 'self' && <span title="Private" style={{marginLeft: '4px'}}>🔒</span>}
                      {post.isEdited && <span className="edited-label"> - edited</span>}
                    </span>
                  </div>
                  
                  {/* Options Menu - Only for Author */}
                  {user && user.uid === post.authorId && (
                    <div className="post-options-container">
                      <button 
                        className="post-options" 
                        onClick={() => toggleDropdown(post.id)}
                      >
                        •••
                      </button>
                      {openDropdownId === post.id && (
                        <div className="options-dropdown">
                          <button onClick={() => handleEditClick(post)}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Edit
                          </button>
                          <button onClick={() => handleDeleteClick(post)} className="delete-option">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="post-content">
                  {editingPostId === post.id ? (
                    <div className="edit-post-form">
                      <textarea 
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="edit-post-textarea"
                      />
                      <div className="edit-actions">
                        <button onClick={() => setEditingPostId(null)} className="cancel-btn">Cancel</button>
                        <button onClick={() => handleSaveEdit(post.id)} className="save-btn">Save</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {post.content && <p>{post.content}</p>}

                      {/* Repost Content */}
                      {post.repostData && (
                        <div className="repost-container">
                          <div className="repost-header-mini">
                            {((user && post.repostData.authorId === user.uid && user.photoURL) || (post.repostData.authorId !== user?.uid && post.repostData.avatar && !post.repostData.avatar.includes('dicebear'))) ? (
                              <img 
                                src={(user && post.repostData.authorId === user.uid) ? user.photoURL : post.repostData.avatar} 
                                alt={post.repostData.author} 
                                className="repost-avatar-mini" 
                              />
                            ) : (
                              <InitialsAvatar 
                                name={post.repostData.author} 
                                uid={post.repostData.authorId} 
                                className="repost-avatar-mini"
                                size={24}
                                fontSize="10px"
                              />
                            )}
                            <div className="repost-info-mini">
                              <span className="repost-author-name">{post.repostData.author}</span>
                              <span className="repost-time-mini">{getRelativeTime(post.repostData.timestamp)}</span>
                            </div>
                          </div>
                          <div className="repost-body">
                             <p className="post-content-mini">{post.repostData.content}</p>
                             {post.repostData.linkPreview && (
                                <div className="post-link-preview">
                                  {post.repostData.linkPreview.type === 'video' ? (
                                    <div className="video-embed-container">
                                      <iframe 
                                        src={post.repostData.linkPreview.embedUrl} 
                                        title={post.repostData.linkPreview.title}
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                      ></iframe>
                                    </div>
                                  ) : (
                                    <a href={post.repostData.linkPreview.url} target="_blank" rel="noopener noreferrer" className="link-preview-card">
                                       {post.repostData.linkPreview.image && (
                                         <div 
                                           className={`link-preview-image ${post.repostData.linkPreview.type === 'link' ? 'generic-preview' : ''}`} 
                                           style={{backgroundImage: `url(${post.repostData.linkPreview.image})`}}
                                         ></div>
                                       )}
                                       <div className="link-preview-content">
                                         <h4 className="link-title">{post.repostData.linkPreview.title}</h4>
                                         <p className="link-desc">{post.repostData.linkPreview.description}</p>
                                         <span className="link-source">🔗 {post.repostData.linkPreview.source}</span>
                                       </div>
                                    </a>
                                  )}
                                </div>
                             )}
                             {post.repostData.image && (
                                <div className="post-image-container-mini">
                                  <img src={post.repostData.image} alt="Repost content" className="post-image" />
                                </div>
                             )}
                          </div>
                        </div>
                      )}

                      {!post.repostData && post.linkPreview && (
                        <div className="post-link-preview">
                          {post.linkPreview.type === 'video' ? (
                            <div className="video-embed-container">
                              <iframe 
                                src={post.linkPreview.embedUrl} 
                                title={post.linkPreview.title}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              ></iframe>
                            </div>
                          ) : (
                            <a href={post.linkPreview.url} target="_blank" rel="noopener noreferrer" className="link-preview-card">
                               {post.linkPreview.image && (
                                 <div 
                                   className={`link-preview-image ${post.linkPreview.type === 'link' ? 'generic-preview' : ''}`} 
                                   style={{backgroundImage: `url(${post.linkPreview.image})`}}
                                 ></div>
                               )}
                               <div className="link-preview-content">
                                 <h4 className="link-title">{post.linkPreview.title}</h4>
                                 <p className="link-desc">{post.linkPreview.description}</p>
                                 <span className="link-source">🔗 {post.linkPreview.source}</span>
                               </div>
                            </a>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                
                {post.image && (
                  <div className="post-image-container">
                    <img 
                      src={post.image} 
                      alt="Post content" 
                      className="post-image" 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        navigate(`/photo/${post.id}/0`, { state: { backgroundLocation: location, scrollY: window.scrollY } });
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                  </div>
                )}
                
                <div className="post-actions">
                  <button 
                    className={`action-btn like-btn ${post.userVotes && post.userVotes[user?.uid] === 1 ? 'active' : ''}`}
                    onClick={() => handleVote(post.id, 1)}
                    title="Like"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill={post.userVotes && post.userVotes[user?.uid] === 1 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    <span>{post.score || 0}</span>
                  </button>

                  <button 
                    className={`action-btn dislike-btn ${post.userVotes && post.userVotes[user?.uid] === -1 ? 'active' : ''}`}
                    onClick={() => handleVote(post.id, -1)}
                    title="Dislike"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>

                  <button className="action-btn comment-btn" onClick={() => toggleComments(post.id)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                    </svg>
                    <span>{post.comments > 0 ? post.comments : 'Comment'}</span>
                  </button>

                  <button className="action-btn repost-btn" onClick={() => handleRepost(post)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="17 1 21 5 17 9"></polyline>
                      <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                      <polyline points="7 23 3 19 7 15"></polyline>
                      <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                    </svg>
                    <span>{post.shares > 0 ? post.shares : 'Repost'}</span>
                  </button>

                  <button 
                    className={`action-btn save-btn ${savedPosts[post.id] ? 'active' : ''}`}
                    onClick={() => handleSavePost(post.id)}
                    title={savedPosts[post.id] ? "Unsave" : "Save"}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill={savedPosts[post.id] ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                    </svg>
                  </button>
                </div>

                {/* Comments Section */}
                {activeCommentPostId === post.id && (
                  <div className="comments-section">
                    <div className="comments-list">
                      {commentsData[post.id] && commentsData[post.id].length > 0 ? (
                        commentsData[post.id].map(comment => (
                          <div key={comment.id} className="comment-item">
                            {(comment.avatar && !comment.avatar.includes('dicebear')) ? (
                              <img src={comment.avatar} alt={comment.author} className="comment-avatar" />
                            ) : (
                              <InitialsAvatar 
                                name={comment.author} 
                                uid={comment.authorId} 
                                className="comment-avatar"
                                size={32}
                                fontSize="12px"
                              />
                            )}
                            <div className="comment-bubble">
                              {editingCommentId === comment.id ? (
                                <div className="edit-comment-area">
                                  <input 
                                    type="text"
                                    value={editCommentText}
                                    onChange={(e) => setEditCommentText(e.target.value)}
                                    className="edit-comment-input"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEditComment(post.id, comment.id);
                                      if (e.key === 'Escape') setEditingCommentId(null);
                                    }}
                                  />
                                  <div className="edit-comment-actions">
                                    <button onClick={() => handleSaveEditComment(post.id, comment.id)} className="save-btn-mini">Save</button>
                                    <button onClick={() => setEditingCommentId(null)} className="cancel-btn-mini">Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="comment-header">
                                    <span className="comment-author">{comment.author}</span>
                                    {(user?.uid === comment.authorId || user?.uid === post.authorId) && (
                                      <div className="comment-options-container">
                                        <button 
                                          className="comment-options-trigger" 
                                          onClick={(e) => { 
                                            e.stopPropagation(); 
                                            setOpenCommentDropdownId(openCommentDropdownId === comment.id ? null : comment.id); 
                                          }}
                                        >
                                          •••
                                        </button>
                                        {openCommentDropdownId === comment.id && (
                                          <div className="comment-dropdown">
                                            {user?.uid === comment.authorId && (
                                              <button onClick={() => handleEditCommentClick(comment)}>Edit</button>
                                            )}
                                            <button className="delete-option" onClick={() => handleDeleteCommentClick(post.id, comment.id)}>Delete</button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <p className="comment-text">
                                    {comment.text}
                                    {comment.isEdited && <span className="edited-label"> – edited</span>}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="no-comments">No comments yet. Be the first!</p>
                      )}
                    </div>
                    <div className="comment-input-area">
                      <input 
                        type="text" 
                        placeholder="Write a comment..." 
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment(post.id)}
                        className="comment-input"
                      />
                      <button onClick={() => handleSubmitComment(post.id)} className="comment-submit-btn">
                        ➤
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="capy-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--capy-text-secondary)' }}>
              {activeTab === 'posts' && "No posts yet."}
              {activeTab === 'saves' && "No saved posts yet."}
              {activeTab === 'reposts' && "No reposts yet."}
            </div>
          )}
        </div>

        {/* Sidebar removed as requested */}
      </div>

      <CapyModal {...modalConfig} onClose={closeModal} />
    </div>
  );
};

export default Profile;
