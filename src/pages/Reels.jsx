import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getDatabase, ref, push, onValue, serverTimestamp, remove, query, orderByKey, limitToLast, endBefore, get } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { useNavigate, useParams } from 'react-router-dom';
import './Reels.css';

const BATCH_SIZE = 3;

const Reels = () => {
  const { reelId } = useParams();
  const [reels, setReels] = useState([]);
  const [activeReelId, setActiveReelId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newReelUrl, setNewReelUrl] = useState('');
  const [newReelTitle, setNewReelTitle] = useState('');
  const [newReelDescription, setNewReelDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Infinite Scroll State
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef(null);
  const allReelsRef = useRef([]); // Store all fetched reels here
  const currentIndexRef = useRef(0); // Track how many reels are currently shown
  
  const containerRef = useRef(null);
  const reelRefs = useRef({});
  const navigate = useNavigate();
  const auth = getAuth();
  const user = auth.currentUser;

  // Fisher-Yates Shuffle
  const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  // Fetch Initial Reels
  useEffect(() => {
    const fetchInitialReels = async () => {
      setLoading(true);
      const db = getDatabase();
      const reelsRef = ref(db, 'reels');
      
      try {
        const snapshot = await get(reelsRef);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          let allReels = Object.entries(data).map(([id, value]) => ({
            id,
            ...value
          }));

          // Handle specific reel ID (Deep Link)
          if (reelId) {
            const specificIndex = allReels.findIndex(r => r.id === reelId);
            if (specificIndex !== -1) {
              const specificReel = allReels.splice(specificIndex, 1)[0];
              // Shuffle the rest
              allReels = shuffleArray(allReels);
              // Put specific reel at the beginning
              allReels.unshift(specificReel);
              setActiveReelId(reelId);
            } else {
              // Specific reel not found, just shuffle all
              allReels = shuffleArray(allReels);
              if (allReels.length > 0) setActiveReelId(allReels[0].id);
            }
          } else {
            // No specific reel, shuffle all
            allReels = shuffleArray(allReels);
            if (allReels.length > 0) setActiveReelId(allReels[0].id);
          }

          allReelsRef.current = allReels;
          
          // Load first batch
          const initialBatch = allReels.slice(0, BATCH_SIZE);
          setReels(initialBatch);
          currentIndexRef.current = initialBatch.length;
          
          setHasMore(allReels.length > BATCH_SIZE);
        } else {
          setReels([]);
          setHasMore(false);
        }
      } catch (err) {
        console.error("Error fetching reels:", err);
        setError("Failed to load reels. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialReels();
  }, [reelId]);

  // Load More Reels
  const loadMoreReels = useCallback(() => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    
    // Simulate network delay for smooth UX (optional, but good for "loading" feel)
    setTimeout(() => {
      const nextIndex = currentIndexRef.current + BATCH_SIZE;
      const nextBatch = allReelsRef.current.slice(currentIndexRef.current, nextIndex);
      
      if (nextBatch.length > 0) {
        setReels(prev => [...prev, ...nextBatch]);
        currentIndexRef.current = currentIndexRef.current + nextBatch.length;
        
        if (currentIndexRef.current >= allReelsRef.current.length) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
      
      setLoadingMore(false);
    }, 500);
  }, [loadingMore, hasMore]);

  // Observer for Infinite Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMoreReels();
        }
      },
      {
        root: containerRef.current,
        threshold: 0.1,
        rootMargin: '100px' // Load before reaching bottom
      }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [loadMoreReels, hasMore, loadingMore, loading]);

  // Intersection Observer for Active Reel Detection
  useEffect(() => {
    if (loading || reels.length === 0) return;

    const observerOptions = {
      root: containerRef.current,
      threshold: 0.6, // Trigger when 60% visible (close to user's 70% request)
    };

    const observerCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Get the reel ID from the data attribute
          const visibleReelId = entry.target.dataset.reelId;
          if (visibleReelId) {
            setActiveReelId(visibleReelId);
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    // Observe all reel elements
    Object.values(reelRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [reels, loading]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isModalOpen) return; // Don't navigate if modal is open

      const currentIndex = reels.findIndex(r => r.id === activeReelId);
      if (currentIndex === -1) return;

      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        const nextIndex = Math.min(reels.length - 1, currentIndex + 1);
        const nextReelId = reels[nextIndex].id;
        scrollToReel(nextReelId);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        const prevIndex = Math.max(0, currentIndex - 1);
        const prevReelId = reels[prevIndex].id;
        scrollToReel(prevReelId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeReelId, reels, isModalOpen]);

  const scrollToReel = (reelId) => {
    const element = reelRefs.current[reelId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const parseUrl = (input) => {
    let url = input;
    
    // Clean up input: extract URL from HTML embed codes
    if (input.includes('<iframe')) {
      const srcMatch = input.match(/src=["']([^"']+)["']/);
      if (srcMatch && srcMatch[1]) url = srcMatch[1];
    }

    let type = '';
    let videoId = '';

    try {
      const urlObj = new URL(url);
      
      if (url.includes('youtube.com/shorts/')) {
        type = 'youtube';
        const pathParts = urlObj.pathname.split('/');
        const shortsIndex = pathParts.indexOf('shorts');
        if (shortsIndex !== -1 && pathParts[shortsIndex + 1]) videoId = pathParts[shortsIndex + 1];
      } else if (url.includes('youtube.com/embed/')) {
        type = 'youtube';
        const pathParts = urlObj.pathname.split('/');
        const embedIndex = pathParts.indexOf('embed');
        if (embedIndex !== -1 && pathParts[embedIndex + 1]) videoId = pathParts[embedIndex + 1];
      } else if (url.includes('youtube.com/watch')) {
        type = 'youtube';
        videoId = urlObj.searchParams.get('v');
      }
    } catch (e) {
      console.error("Invalid URL", e);
      return null;
    }

    if (type && videoId) return { type, videoId };
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!newReelUrl.trim()) return;

    const parsed = parseUrl(newReelUrl);
    if (!parsed) {
      setError('Invalid or unsupported URL. Please use a valid YouTube link.');
      return;
    }

    const db = getDatabase();
    const reelsRef = ref(db, 'reels');
    
    const newReel = {
      type: parsed.type,
      videoId: parsed.videoId,
      originalUrl: newReelUrl,
      title: newReelTitle || '',
      description: newReelDescription || '',
      timestamp: serverTimestamp(),
      authorId: user ? user.uid : 'anonymous',
      authorName: user ? (user.displayName || 'Anonymous') : 'Anonymous',
      authorAvatar: user ? user.photoURL : null
    };

    try {
      const newRef = await push(reelsRef, newReel);
      
      // Manually update state with optimistic data
      // Use Date.now() for local timestamp to ensure it appears at top
      const addedReel = {
        id: newRef.key,
        ...newReel,
        timestamp: Date.now() 
      };
      
      setReels(prev => [addedReel, ...prev]);
      setActiveReelId(newRef.key);
      
      // Scroll to top
      if (containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }

      setNewReelUrl('');
      setNewReelTitle('');
      setNewReelDescription('');
      setIsModalOpen(false);
    } catch (err) {
      setError('Failed to post reel: ' + err.message);
    }
  };

  const handleDelete = async (reelId) => {
    if (!window.confirm('Are you sure you want to delete this reel?')) return;
    const db = getDatabase();
    try {
      await remove(ref(db, `reels/${reelId}`));
      setReels(prev => prev.filter(r => r.id !== reelId));
    } catch (err) {
      alert('Error deleting reel: ' + err.message);
    }
  };

  // Determine which reels to render content for (Active + Neighbors)
  const activeIndex = useMemo(() => reels.findIndex(r => r.id === activeReelId), [reels, activeReelId]);
  
  const shouldRenderContent = (index) => {
    if (activeIndex === -1) return false;
    // Render active, previous, and next
    return Math.abs(index - activeIndex) <= 1;
  };

  const sidebarItems = [
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
      label: 'CapyTips', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg> 
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
      label: 'CHIRPY', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> 
    },
    { 
      label: 'Squads', 
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
    <div className="reels-page-wrapper">
      <aside className="reels-sidebar">
        <div className="sidebar-menu">
          {sidebarItems.map((item) => (
            <div 
              key={item.label}
              className={`sidebar-item ${item.label === 'Reels' ? 'active' : ''}`}
              onClick={() => {
                if (item.label === 'CapyHome') navigate('/home');
                else if (item.label === 'Connections') navigate('/connections');
                else if (item.label === 'CapyDEVS') navigate('/devs');
                else if (item.label === 'CapyTips') navigate('/tips');
                else if (item.label === 'Reels') navigate('/reels');
                else if (item.label === 'Activities') navigate('/activities');
                else if (item.label === 'Learn') navigate('/learn');
                else if (item.label === 'Offers') navigate('/offers');
                else if (item.label === 'CHIRPY') navigate('/chirpy');
                else if (item.label === 'Squads') navigate('/squads');
                else if (item.label === 'Play') navigate('/play');
                else if (item.label === 'Settings') navigate('/settings');
              }}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </div>
          ))}
        </div>
      </aside>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Add a Reel</h2>
            <p className="modal-subtitle">Paste a YouTube link.</p>
            
            <form onSubmit={handleSubmit}>
              <input 
                type="text" 
                value={newReelUrl}
                onChange={(e) => setNewReelUrl(e.target.value)}
                placeholder="YouTube/TikTok Shorts URL"
                className="reel-input"
                autoFocus
              />
              <input 
                type="text" 
                value={newReelTitle}
                onChange={(e) => setNewReelTitle(e.target.value)}
                placeholder="Title (Optional)"
                className="reel-input"
              />
              <textarea 
                value={newReelDescription}
                onChange={(e) => setNewReelDescription(e.target.value)}
                placeholder="Description (Optional)"
                className="reel-input reel-textarea"
                rows={3}
              />
              {error && <p className="error-message">{error}</p>}
              
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="submit-btn" disabled={!newReelUrl.trim()}>Post Reel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="reels-container">
        <div className="reels-content">
          <div className="reels-wrapper-box">
            <div className="reels-header">
              <button className="add-reel-btn" onClick={() => setIsModalOpen(true)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Add Reel
              </button>
            </div>

            <div className="reels-feed" ref={containerRef}>
              {loading ? (
                <div className="loading-spinner">Loading Reels...</div>
              ) : reels.length === 0 ? (
                <div className="no-reels">
                  <p>No reels yet. Be the first to add one!</p>
                </div>
              ) : (
                <>
                  {reels.map((reel, index) => {
                    const isActive = reel.id === activeReelId;
                    const shouldRender = shouldRenderContent(index);

                    return (
                      <div 
                        key={reel.id} 
                        className="reel-card"
                        data-reel-id={reel.id}
                        ref={el => reelRefs.current[reel.id] = el}
                      >
                        {shouldRender ? (
                          <div className="reel-content">
                            <div className="reel-info-overlay">
                              <div className="reel-author">
                                {reel.authorAvatar ? (
                                  <img src={reel.authorAvatar} alt={reel.authorName} className="author-avatar" />
                                ) : (
                                  <div className="author-initial">{reel.authorName?.[0] || 'A'}</div>
                                )}
                                <span className="author-name">{reel.authorName}</span>
                                
                                {user && user.uid === reel.authorId && (
                                <button 
                                  className="delete-reel-btn" 
                                  onClick={() => handleDelete(reel.id)} 
                                  title="Delete Reel"
                                  aria-label="Delete Reel"
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
                              {reel.title && <div className="reel-title">{reel.title}</div>}
                              {reel.description && <div className="reel-description">{reel.description}</div>}
                            </div>

                            {/* Render Embeds - Autoplay only if active */}
                            {reel.type === 'youtube' && (
                              <iframe 
                                src={`https://www.youtube.com/embed/${reel.videoId}?autoplay=${isActive ? 1 : 0}&mute=1&controls=1&loop=1&playlist=${reel.videoId}`} 
                                title="YouTube Short"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowFullScreen
                                className="reel-embed youtube-embed"
                              ></iframe>
                            )}

                          </div>
                        ) : (
                          <div className="loading-spinner">Loading...</div>
                        )}
                      </div>
                    );
                  })}
                  
                  {hasMore && (
                    <div 
                      ref={loaderRef} 
                      className="loading-sentinel"
                      style={{ 
                        height: '100px', 
                        width: '100%',
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        color: '#b0b3b8'
                      }}
                    >
                      {loadingMore && "Loading more..."}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reels;
