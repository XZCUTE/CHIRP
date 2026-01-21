import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getDatabase, ref, onValue, push, update, remove, serverTimestamp, runTransaction } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import '../components/CapyHome.css';
import CapyModal from '../components/CapyModal';
import InitialsAvatar from '../components/InitialsAvatar';
import MiniProfileCard from '../components/MiniProfileCard';
import { deleteFromImgBB } from '../utils/imgbb';

const PostPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'alert',
    message: '',
    onConfirm: null,
    title: ''
  });

  // Edit State
  const [editingPostId, setEditingPostId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState(null);

  // Comment Edit State
  const [commentText, setCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [openCommentDropdownId, setOpenCommentDropdownId] = useState(null);

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const auth = getAuth();
  const db = getDatabase();
  const user = auth.currentUser;
  
  // Saved Posts State
  const [savedPosts, setSavedPosts] = useState({});

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const postRef = ref(db, `posts/${id}`);
    
    const unsubscribe = onValue(postRef, (snapshot) => {
      if (snapshot.exists()) {
        setPost({ id, ...snapshot.val() });
        setError(null);
      } else {
        setError('Post not found');
        setPost(null);
      }
      setLoading(false);
    }, (err) => {
        console.error(err);
        setError('Error loading post');
        setLoading(false);
    });

    return () => unsubscribe();
  }, [id, db]);

  // Fetch Comments
  useEffect(() => {
    if (!id) return;
    const commentsRef = ref(db, `posts/${id}/comments_list`);
    const unsubscribe = onValue(commentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedComments = Object.entries(data).map(([key, val]) => ({
          id: key,
          ...val
        })).sort((a, b) => a.timestamp - b.timestamp);
        setComments(loadedComments);
      } else {
        setComments([]);
      }
    });
    return () => unsubscribe();
  }, [id, db]);

  // Fetch Saved Posts status
  useEffect(() => {
      if (!user) return;
      const savedRef = ref(db, `users/${user.uid}/savedPosts/${id}`);
      const unsubscribe = onValue(savedRef, (snapshot) => {
          setSavedPosts(prev => ({...prev, [id]: snapshot.exists()}));
      });
      return () => unsubscribe();
  }, [user, id, db]);

  const showModal = ({ type = 'alert', message, onConfirm = null, title = '' }) => {
    setModalConfig({ isOpen: true, type, message, onConfirm, title });
  };

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const handleUserClick = (e, uid, initialName, initialAvatar) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setSelectedUser({
      uid,
      x: rect.right + 10,
      y: rect.top,
      initialName,
      initialAvatar
    });
  };

  const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    // Handle Firestore timestamp if applicable, or number
    let date;
    if (typeof timestamp === 'number') date = new Date(timestamp);
    else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
    else date = new Date(timestamp);

    const now = Date.now();
    const diff = now - date.getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes} min. ago`;
    if (hours < 24) return `${hours} hr. ago`;
    return `${days} days ago`;
  };

  const handleVote = (direction) => {
    if (!user) return showModal({ message: "Please login to vote!", title: "Login Required" });
    const postRef = ref(db, `posts/${id}`);
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

  const handleRepost = async () => {
    if (!user) return showModal({ message: "Please login to repost!", title: "Login Required" });
    if (!post) return;

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
                privacy: 'world', // Default to public for reposts on page
                repostOf: sourcePost.id || post.id,
                repostData: {
                    id: sourcePost.id || post.id,
                    author: sourcePost.author,
                    authorId: sourcePost.authorId,
                    avatar: sourcePost.avatar,
                    content: sourcePost.content,
                    image: sourcePost.image || null,
                    images: sourcePost.images || null,
                    linkPreview: sourcePost.linkPreview || null,
                    timestamp: sourcePost.timestamp
                }
            };
            
            await push(ref(db, 'posts'), newPost);
            closeModal();
            navigate('/home'); // Optional: go to home to see repost
        } catch (e) {
            console.error("Repost failed", e);
        }
      }
    });
  };

  const handleSavePost = async () => {
    if (!user) return showModal({ message: "Please login to save posts!", title: "Login Required" });
    
    const isSaved = savedPosts[id];
    const updates = {};
    if (isSaved) {
      updates[`users/${user.uid}/savedPosts/${id}`] = null;
    } else {
      updates[`users/${user.uid}/savedPosts/${id}`] = true;
    }
    
    try {
      await update(ref(db), updates);
    } catch (error) {
      console.error("Error toggling save:", error);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;
    if (!user) return showModal({ message: "Please login to comment!", title: "Login Required" });

    try {
      await push(ref(db, `posts/${id}/comments_list`), {
        text: commentText,
        author: user.displayName || 'Anonymous Capy',
        authorId: user.uid,
        avatar: user.photoURL || null,
        timestamp: serverTimestamp()
      });

      runTransaction(ref(db, `posts/${id}`), (post) => {
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

  const handleEditClick = () => {
    setEditingPostId(post.id);
    setEditContent(post.content);
    setOpenDropdownId(null);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await update(ref(db, `posts/${id}`), {
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

  const handleDeleteClick = () => {
    setOpenDropdownId(null);
    showModal({
      type: 'confirm',
      title: 'Delete Chirp',
      message: "Are you sure you want to delete this post?",
      onConfirm: async () => {
        try {
          if (post.images) {
            await Promise.all(post.images.map(img => 
              img.deleteUrl ? deleteFromImgBB(img.deleteUrl) : Promise.resolve()
            ));
          } else if (post.imageDeleteUrl) {
            await deleteFromImgBB(post.imageDeleteUrl);
          }

          await remove(ref(db, `posts/${id}`));
          
          if (post.repostOf) {
            const sharesRef = ref(db, `posts/${post.repostOf}/shares`);
            runTransaction(sharesRef, (current) => {
              return (current && current > 0) ? current - 1 : 0;
            });
          }

          closeModal();
          navigate('/home');
        } catch (error) {
          console.error("Error deleting post:", error);
          showModal({ message: "Failed to delete post.", title: "Error" });
        }
      }
    });
  };

  const handleEditCommentClick = (comment) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.text);
    setOpenCommentDropdownId(null);
  };

  const handleSaveEditComment = async (commentId) => {
    if (!editCommentText.trim()) return;
    try {
      await update(ref(db, `posts/${id}/comments_list/${commentId}`), {
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

  const handleDeleteCommentClick = (commentId) => {
    setOpenCommentDropdownId(null);
    showModal({
      type: 'confirm',
      title: 'Delete Comment',
      message: "Are you sure you want to delete this comment?",
      onConfirm: async () => {
        try {
          await remove(ref(db, `posts/${id}/comments_list/${commentId}`));
          runTransaction(ref(db, `posts/${id}`), (post) => {
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

  if (loading) return <div className="loading-text" style={{marginTop: '100px', textAlign: 'center'}}>Loading post...</div>;
  if (error) return <div className="loading-text" style={{marginTop: '100px', textAlign: 'center'}}>{error}</div>;
  if (!post) return null;

  return (
    <div className="capy-home-container" style={{ justifyContent: 'center' }}>
      <main className="home-feed" style={{ width: '100%', maxWidth: '600px' }}>
        <button 
            onClick={() => navigate(-1)} 
            style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'var(--capy-text-secondary)', 
                marginBottom: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}
        >
            ← Back
        </button>

        <div className="post-card capy-card">
            <div className="post-header">
            <div className="post-avatar-wrapper" onClick={(e) => handleUserClick(e, post.authorId, post.author, post.avatar)} style={{cursor: 'pointer'}}>
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
                    size={44}
                />
                )}
            </div>
            <div className="post-info">
                <span className="post-author" onClick={(e) => handleUserClick(e, post.authorId, post.author, post.avatar)} style={{cursor: 'pointer'}}>{post.author}</span>
                <span className="post-separator">•</span>
                <span className="post-time">
                {getRelativeTime(post.timestamp)}
                {post.privacy === 'cappies' && <span title="Friends Only" style={{marginLeft: '4px'}}>🐾</span>}
                {post.privacy === 'self' && <span title="Private" style={{marginLeft: '4px'}}>🔒</span>}
                {post.isEdited && <span className="edited-label"> - edited</span>}
                </span>
            </div>
            
            {user && user.uid === post.authorId && (
                <div className="post-options-container">
                <button 
                    className="post-options" 
                    onClick={() => setOpenDropdownId(openDropdownId === post.id ? null : post.id)}
                >
                    •••
                </button>
                {openDropdownId === post.id && (
                    <div className="options-dropdown">
                    <button onClick={handleEditClick}>Edit</button>
                    <button onClick={handleDeleteClick} className="delete-option">Delete</button>
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
                    <button onClick={handleSaveEdit} className="save-btn">Save</button>
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
                        {(post.repostData.images || post.repostData.image) && (
                            <PostImagesGrid 
                            images={post.repostData.images || (post.repostData.image ? [{url: post.repostData.image}] : [])} 
                            onImageClick={(idx) => navigate(`/photo/${post.id}/${idx}`, { state: { backgroundLocation: location, scrollY: window.scrollY } })}
                            />
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
            
            {(post.images || post.image) && (
            <PostImagesGrid 
                images={post.images || (post.image ? [{url: post.image}] : [])} 
                onImageClick={(idx) => navigate(`/photo/${post.id}/${idx}`, { state: { backgroundLocation: location, scrollY: window.scrollY } })}
            />
            )}
            
            <div className="post-actions">
            <button 
                className={`action-btn like-btn ${post.userVotes && post.userVotes[user?.uid] === 1 ? 'active' : ''}`}
                onClick={() => handleVote(1)}
                title="Like"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill={post.userVotes && post.userVotes[user?.uid] === 1 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <span>{post.score || 0}</span>
            </button>

            <button 
                className={`action-btn dislike-btn ${post.userVotes && post.userVotes[user?.uid] === -1 ? 'active' : ''}`}
                onClick={() => handleVote(-1)}
                title="Dislike"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>

            <button className="action-btn comment-btn" onClick={() => document.querySelector('.comment-input')?.focus()}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
                <span>{post.comments > 0 ? post.comments : 'Comment'}</span>
            </button>

            <button className="action-btn repost-btn" onClick={handleRepost}>
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
                onClick={handleSavePost}
                title={savedPosts[post.id] ? "Unsave" : "Save"}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill={savedPosts[post.id] ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
            </button>
            </div>

            {/* Comments Section */}
            <div className="comments-section" style={{display: 'block', padding: '16px 0 0'}}>
                <h3 style={{fontSize: '16px', margin: '0 0 16px', color: 'var(--capy-text)'}}>Comments</h3>
                <div className="comments-list">
                {comments.length > 0 ? (
                    comments.map(comment => (
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
                                if (e.key === 'Enter') handleSaveEditComment(comment.id);
                                if (e.key === 'Escape') setEditingCommentId(null);
                                }}
                            />
                            <div className="edit-comment-actions">
                                <button onClick={() => handleSaveEditComment(comment.id)} className="save-btn-mini">Save</button>
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
                                        <button className="delete-option" onClick={() => handleDeleteCommentClick(comment.id)}>Delete</button>
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
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                    className="comment-input"
                />
                <button onClick={handleSubmitComment} className="comment-submit-btn">
                    ➤
                </button>
                </div>
            </div>
        </div>
      </main>

      <CapyModal {...modalConfig} onClose={closeModal} />
      
      {selectedUser && (
        <MiniProfileCard 
          targetUid={selectedUser.uid} 
          position={{ x: selectedUser.x, y: selectedUser.y }}
          initialName={selectedUser.initialName}
          initialAvatar={selectedUser.initialAvatar}
          onClose={() => setSelectedUser(null)} 
        />
      )}
    </div>
  );
};

const PostImagesGrid = ({ images, onImageClick }) => {
  if (!images || images.length === 0) return null;
  const count = images.length;

  // Single Image
  if (count === 1) {
    return (
      <div className="post-image-container single-image">
        <img 
          src={images[0].url} 
          alt="Post content" 
          className="post-image" 
          onClick={(e) => { e.stopPropagation(); onImageClick(0); }}
          style={{ 
            cursor: 'pointer', 
            width: '100%', 
            height: 'auto', 
            maxHeight: '600px', 
            objectFit: 'contain',
            backgroundColor: 'rgba(0,0,0,0.02)',
            borderRadius: '8px'
          }}
        />
      </div>
    );
  }

  // 2 Images
  if (count === 2) {
    return (
      <div className="post-image-container multi-image-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', height: '300px', overflow: 'hidden', borderRadius: '8px' }}>
        {images.map((img, idx) => (
          <img 
            key={idx}
            src={img.url}
            alt={`Post content ${idx}`}
            className="post-image"
            onClick={(e) => { e.stopPropagation(); onImageClick(idx); }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
          />
        ))}
      </div>
    );
  }

  // 3 Images (1 Left, 2 Right)
  if (count === 3) {
    return (
      <div className="post-image-container multi-image-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', height: '300px', overflow: 'hidden', borderRadius: '8px' }}>
        <div style={{ position: 'relative', height: '100%' }}>
            <img 
              src={images[0].url}
              alt="Post content 0"
              className="post-image"
              onClick={(e) => { e.stopPropagation(); onImageClick(0); }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
            />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', height: '100%' }}>
            <img 
              src={images[1].url}
              alt="Post content 1"
              className="post-image"
              onClick={(e) => { e.stopPropagation(); onImageClick(1); }}
              style={{ width: '100%', height: '50%', objectFit: 'cover', cursor: 'pointer' }}
            />
            <img 
              src={images[2].url}
              alt="Post content 2"
              className="post-image"
              onClick={(e) => { e.stopPropagation(); onImageClick(2); }}
              style={{ width: '100%', height: '50%', objectFit: 'cover', cursor: 'pointer' }}
            />
        </div>
      </div>
    );
  }
  
  // 4 Images (Grid)
  if (count === 4) {
     return (
      <div className="post-image-container multi-image-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '2px', height: '400px', overflow: 'hidden', borderRadius: '8px' }}>
        {images.map((img, idx) => (
          <img 
            key={idx}
            src={img.url}
            alt={`Post content ${idx}`}
            className="post-image"
            onClick={(e) => { e.stopPropagation(); onImageClick(idx); }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
          />
        ))}
      </div>
    );
  }

  // 5+ Images (2 Top, 3 Bottom)
  return (
      <div className="post-image-container multi-image-grid" style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderRadius: '8px', overflow: 'hidden' }}>
        {/* Top Row: 2 images */}
        <div style={{ display: 'flex', gap: '2px', height: '250px' }}>
             <img 
              src={images[0].url}
              alt="Post content 0"
              className="post-image"
              onClick={(e) => { e.stopPropagation(); onImageClick(0); }}
              style={{ width: '50%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
            />
             <img 
              src={images[1].url}
              alt="Post content 1"
              className="post-image"
              onClick={(e) => { e.stopPropagation(); onImageClick(1); }}
              style={{ width: '50%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
            />
        </div>
        {/* Bottom Row: 3 images */}
        <div style={{ display: 'flex', gap: '2px', height: '166px' }}>
             <img 
              src={images[2].url}
              alt="Post content 2"
              className="post-image"
              onClick={(e) => { e.stopPropagation(); onImageClick(2); }}
              style={{ width: '33.33%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
            />
             <img 
              src={images[3].url}
              alt="Post content 3"
              className="post-image"
              onClick={(e) => { e.stopPropagation(); onImageClick(3); }}
              style={{ width: '33.33%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
            />
            <div style={{ position: 'relative', width: '33.33%', height: '100%', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onImageClick(4); }}>
                 <img 
                  src={images[4].url}
                  alt="Post content 4"
                  className="post-image"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {count > 5 && (
                    <div style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        right: 0, 
                        bottom: 0, 
                        backgroundColor: 'rgba(0,0,0,0.5)', 
                        color: 'white', 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        fontSize: '28px', 
                        fontWeight: 'bold' 
                    }}>
                        +{count - 5}
                    </div>
                )}
            </div>
        </div>
      </div>
  );
};

export default PostPage;
