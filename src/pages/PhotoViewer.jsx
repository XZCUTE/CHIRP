import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getDatabase, ref, onValue, push, runTransaction, serverTimestamp, update } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import InitialsAvatar from '../components/InitialsAvatar';
import '../components/CapyHome.css';

const normalizeImages = (post) => {
  if (!post) return [];
  const fromRepostArray = post.repostData?.images;
  const fromRepostSingle = post.repostData?.image ? [{ url: post.repostData.image }] : null;
  const fromPostArray = post.images;
  const fromPostSingle = post.image ? [{ url: post.image }] : null;
  const arr = fromRepostArray || fromRepostSingle || fromPostArray || fromPostSingle || [];
  return arr.map(img => (typeof img === 'string' ? { url: img } : img));
};

const getRelativeTime = (timestamp) => {
  if (!timestamp) return 'Just now';
  const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return date.toLocaleDateString();
};

export default function PhotoViewer() {
  const { postId, index } = useParams();
  const navigate = useNavigate();
  const locationState = useLocation().state;
  const db = getDatabase();
  const auth = getAuth();
  const user = auth.currentUser;

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(Number(index) || 0);
  const [commentText, setCommentText] = useState('');
  const [savedPosts, setSavedPosts] = useState({});

  useEffect(() => {
    if (!user) {
      setSavedPosts({});
      return;
    }
    const savedRef = ref(db, `users/${user.uid}/savedPosts`);
    const unsubscribe = onValue(savedRef, (snapshot) => {
      setSavedPosts(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, [user, db]);

  useEffect(() => {
    // Lock page scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow || 'unset';
    };
  }, []);

  useEffect(() => {
    const postRef = ref(db, `posts/${postId}`);
    const unsub = onValue(postRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPost({ id: postId, ...data });
      } else {
        setPost(null);
      }
    });
    return () => unsub();
  }, [db, postId]);

  useEffect(() => {
    const commentsRef = ref(db, `posts/${postId}/comments_list`);
    const unsub = onValue(commentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const arr = Object.entries(data).map(([id, val]) => ({ id, ...val }))
          .sort((a, b) => a.timestamp - b.timestamp);
        setComments(arr);
      } else {
        setComments([]);
      }
    });
    return () => unsub();
  }, [db, postId]);

  const images = normalizeImages(post);
  const hasImages = images.length > 0;

  useEffect(() => {
    const bg = locationState && locationState.backgroundLocation;
    const sy = locationState && locationState.scrollY;
    if (bg && typeof sy === 'number') {
      try {
        sessionStorage.setItem('scroll:' + bg.pathname, String(sy));
      } catch {}
    }
  }, [locationState]);

  useEffect(() => {
    if (hasImages) {
      if (currentIndex < 0) setCurrentIndex(images.length - 1);
      if (currentIndex >= images.length) setCurrentIndex(0);
    }
  }, [currentIndex, images.length, hasImages]);

  const prev = () => {
    const nextIdx = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    setCurrentIndex(nextIdx);
    navigate(`/photo/${postId}/${nextIdx}`, { replace: true, state: locationState });
  };

  const next = () => {
    const nextIdx = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    setCurrentIndex(nextIdx);
    navigate(`/photo/${postId}/${nextIdx}`, { replace: true, state: locationState });
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') navigate(-1);
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, prev, next]);

  const handleVote = (direction) => {
    if (!user) return;
    const postRef = ref(db, `posts/${postId}`);
    runTransaction(postRef, (p) => {
      if (p) {
        if (!p.userVotes) p.userVotes = {};
        const currentVote = p.userVotes[user.uid] || 0;
        if (currentVote === direction) {
          p.score = (p.score || 0) - direction;
          p.userVotes[user.uid] = null;
        } else {
          p.score = (p.score || 0) - currentVote + direction;
          p.userVotes[user.uid] = direction;
        }
      }
      return p;
    });
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !user) return;
    await push(ref(db, `posts/${postId}/comments_list`), {
      text: commentText,
      author: user.displayName || 'Anonymous Capy',
      authorId: user.uid,
      avatar: user.photoURL || null,
      timestamp: serverTimestamp()
    });
    runTransaction(ref(db, `posts/${postId}`), (p) => {
      if (p) p.comments = (p.comments || 0) + 1;
      return p;
    });
    setCommentText('');
  };

  const handleRepost = async () => {
    if (!user || !post) return;
    const confirm = window.confirm('Repost this chirp to your feed?');
    if (!confirm) return;
    const sourcePost = post.repostData ? post.repostData : post;
    const newPost = {
      content: sourcePost.content,
      author: user.displayName || 'Anonymous Capy',
      authorId: user.uid,
      avatar: user.photoURL || null,
      role: 'User',
      timestamp: serverTimestamp(),
      likes: 0,
      comments: 0,
      shares: 0,
      privacy: 'world',
      repostData: {
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
    navigate('/home');
  };

  const handleSavePost = async () => {
    if (!user) return alert("Please login to save posts!");
    
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
    }
  };

  const isModal = !!locationState?.backgroundLocation;

  if (!post) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--capy-text)' }}>
        Loading...
      </div>
    );
  }

  return (
    <div className={`photo-viewer-layout ${isModal ? 'modal-mode' : ''}`}>
      <div className="photo-viewer-media">
        <div
          onClick={() => navigate(-1)}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.transform = 'scale(1.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.95)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1.08)';
          }}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            fontSize: '24px',
            color: 'rgba(255,255,255,0.9)',
            cursor: 'pointer',
            zIndex: 20000,
            textShadow: '0 0 10px rgba(0,0,0,0.6)',
            transition: 'transform 0.1s ease, color 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 'auto',
            height: 'auto',
            background: 'transparent',
            border: 'none',
            userSelect: 'none'
          }}
        >
          ✕
        </div>

        {hasImages && images.length > 1 && (
          <>
            {/* Left Navigation Zone */}
            <div
              onClick={prev}
              className="edge-zone left"
            />

            {/* Right Navigation Zone */}
            <div
              onClick={next}
              className="edge-zone right"
            />
          </>
        )}

        {hasImages && (
          <div className="modal-image-wrapper">
            <img
              src={images[currentIndex].url}
              alt={`Image ${currentIndex}`}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          </div>
        )}
      </div>

      <aside className="photo-viewer-sidebar">
        <div className="photo-sidebar-header">
          {(post.avatar && !post.avatar.includes('dicebear')) ? (
            <img src={post.avatar} alt={post.author} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <InitialsAvatar name={post.author} uid={post.authorId} size={40} />
          )}
          <div>
            <div className="post-info" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="post-author" style={{ fontSize: '13px', fontWeight: '700', color: 'var(--capy-text)' }}>{post.author}</span>
              <span className="post-separator" style={{ color: 'var(--capy-text-secondary)' }}>•</span>
              <span className="post-time" style={{ fontSize: '12px', color: 'var(--capy-text-secondary)' }}>{getRelativeTime(post.timestamp)}</span>
            </div>
          </div>
        </div>

        <div className={`photo-caption${post.content ? '' : ' empty'}`}>
          {post.content || 'No caption.'}
        </div>

        <div className="post-actions photo-sidebar-actions">
          <button 
            className={`action-btn like-btn ${post.userVotes && user && post.userVotes[user.uid] === 1 ? 'active' : ''}`}
            onClick={() => handleVote(1)}
            title="Like"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={post.userVotes && user && post.userVotes[user.uid] === 1 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            <span>{post.score || 0}</span>
          </button>
          
          <button 
            className={`action-btn dislike-btn ${post.userVotes && user && post.userVotes[user.uid] === -1 ? 'active' : ''}`}
            onClick={() => handleVote(-1)}
            title="Dislike"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          
          <button 
            className="action-btn comment-btn"
            title="Comment"
            onClick={() => {
              const input = document.getElementById('photo-comment-input');
              if (input) input.focus();
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
            {post.comments > 0 && <span>{post.comments}</span>}
          </button>
          
          <button 
            className="action-btn repost-btn"
            onClick={handleRepost}
            title="Repost"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9"></polyline>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
              <polyline points="7 23 3 19 7 15"></polyline>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>
            {post.shares > 0 && <span>{post.shares}</span>}
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
        
        <div className="photo-comments-scroll">
          {comments.length > 0 ? (
            comments.map((c) => (
              <div key={c.id} className="comment-item">
                {(c.avatar && !c.avatar.includes('dicebear')) ? (
                  <img src={c.avatar} alt={c.author} className="comment-avatar" />
                ) : (
                  <InitialsAvatar name={c.author} uid={c.authorId} className="comment-avatar" size={32} fontSize="12px" />
                )}
                <div className="comment-bubble">
                  <div className="comment-header">
                    <span className="comment-author">{c.author}</span>
                  </div>
                  <p className="comment-text">{c.text}</p>
                  <div className="comment-actions">
                    <button type="button" className="comment-action-link">Like</button>
                    <button type="button" className="comment-action-link">Reply</button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--capy-text-secondary)', marginTop: 20 }}>No comments yet.</div>
          )}
        </div>
        
        <div className="photo-comment-input-row">
          <input 
            type="text" 
            placeholder="Write a comment..." 
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
            id="photo-comment-input"
            className="photo-comment-input"
          />
          <button 
            onClick={handleSubmitComment}
            className="photo-comment-submit"
          >
            ➤
          </button>
        </div>
      </aside>
    </div>
  );
}
