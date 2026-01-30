import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDatabase, ref, onValue, push, serverTimestamp, runTransaction, update, remove } from 'firebase/database';
import { auth } from '../firebase';
import '../components/Cappies.css';
import './CapyTips.css';

const CapyTips = () => {
  const navigate = useNavigate();
  const [tips, setTips] = useState([]);
  const [activeTab, setActiveTab] = useState('CapyTips');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  
  // Post Modal State
  const [newInsight, setNewInsight] = useState('');
  const [timerDuration, setTimerDuration] = useState(24); // hours
  const [isPosting, setIsPosting] = useState(false);

  // User Voting State
  const [userVotes, setUserVotes] = useState({}); // tipId -> 'like' | 'dislike'

  // Sidebar Menu Items
  const menuItems = [
    { label: 'CapyHome', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg> },
    { label: 'Connections', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> },
    { label: 'CapyDEVS', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg> },
    { label: 'CapyTips', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg> },
    { label: 'Reels', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg> },
    { label: 'Activities', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> },
    { label: 'Learn', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg> },
    { label: 'Offers', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg> },
    { label: 'Recruit', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg> },
    { label: 'Crew', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> },
    { label: 'Play', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"></rect><path d="M6 12h4m-2-2v4M15 11h.01M18 13h.01"></path></svg> },
    { label: 'Settings', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> },
  ];

  // Auth & Admin Check
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && (user.email === 'admin@chirp.com' || user.email.includes('dev'))) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
      
      // Load user votes if logged in
      if (user) {
        const db = getDatabase();
        const votesRef = ref(db, `users/${user.uid}/tips_interactions`);
        onValue(votesRef, (snapshot) => {
          const data = snapshot.val() || {};
          // Normalize legacy data
          Object.keys(data).forEach(key => {
             if (data[key] === 'like') data[key] = 1;
             if (data[key] === 'dislike') data[key] = -1;
          });
          setUserVotes(data);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Tips
  useEffect(() => {
    const db = getDatabase();
    const tipsRef = ref(db, 'tips');
    const unsubscribe = onValue(tipsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const now = Date.now();
        const validTips = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(tip => tip.expiresAt > now) // Only non-expired tips
          .sort((a, b) => b.createdAt - a.createdAt); // Newest first
        setTips(validTips);
      } else {
        setTips([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handlePostTip = async () => {
    if (!newInsight.trim()) return;
    if (newInsight.length < 10 || newInsight.length > 220) {
      alert("Tip must be between 10 and 220 characters.");
      return;
    }
    
    setIsPosting(true);
    const db = getDatabase();
    const user = auth.currentUser;
    const now = Date.now();
    const expiresAt = now + (timerDuration * 60 * 60 * 1000);

    try {
      const newTip = {
        content: newInsight,
        authorId: user.uid,
        authorName: user.displayName || 'CapyUser',
        authorVerified: isAdmin, // Verified if admin/dev
        createdAt: serverTimestamp(),
        expiresAt: expiresAt,
        score: 0,
        duration: timerDuration
      };

      await push(ref(db, 'tips'), newTip);
      setNewInsight('');
      setShowPostModal(false);
    } catch (error) {
      console.error("Error posting tip:", error);
      alert("Failed to post tip. Please try again.");
    } finally {
      setIsPosting(false);
    }
  };

  const handleVote = async (tip, direction) => {
    const user = auth.currentUser;
    if (!user) {
      alert("Please login to vote.");
      return;
    }

    const db = getDatabase();
    const tipRef = ref(db, `tips/${tip.id}`);
    const authorRef = ref(db, `users/${tip.authorId}`);

    let currentVote = userVotes[tip.id]; 
    // Normalize legacy data
    if (currentVote === 'like') currentVote = 1;
    if (currentVote === 'dislike') currentVote = -1;

    if (currentVote === direction) {
      // Toggle off (remove vote)
      await runTransaction(tipRef, (post) => {
        if (post) {
          const currentScore = Number(post.score);
          post.score = (isNaN(currentScore) ? 0 : currentScore) - direction;
        }
        return post;
      });
      
      // Update author stats
      await runTransaction(authorRef, (author) => {
        if (author) {
           const currentTotal = Number(author.totalScore);
           author.totalScore = (isNaN(currentTotal) ? 0 : currentTotal) - direction;
        }
        return author;
      });

      await update(ref(db, `users/${user.uid}/tips_interactions`), { [tip.id]: null });
    } else {
      // New vote or switching vote
      await runTransaction(tipRef, (post) => {
        if (post) {
          const currentScore = Number(post.score);
          // If switching vote (e.g. 1 to -1), subtract old (1) and add new (-1) -> -2
          // If new vote (0 to 1), subtract 0 and add 1 -> +1
          const change = direction - (currentVote || 0);
          post.score = (isNaN(currentScore) ? 0 : currentScore) + change;
        }
        return post;
      });
      
      // Update author stats
      await runTransaction(authorRef, (author) => {
        if (author) {
           const currentTotal = Number(author.totalScore);
           const change = direction - (currentVote || 0);
           author.totalScore = (isNaN(currentTotal) ? 0 : currentTotal) + change;
        }
        return author;
      });

      await update(ref(db, `users/${user.uid}/tips_interactions`), { [tip.id]: direction });
    }
  };

  const getTimeLeft = (expiresAt) => {
    const now = Date.now();
    const diff = expiresAt - now;
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}hrs left`;
    return `${minutes}mins left`;
  };

  const handleDeleteTip = async (tipId) => {
    if (!window.confirm("Are you sure you want to delete this tip?")) return;
    
    const db = getDatabase();
    const tipRef = ref(db, `tips/${tipId}`);
    
    try {
      await remove(tipRef);
    } catch (error) {
      console.error("Error deleting tip:", error);
      alert("Failed to delete tip.");
    }
  };

  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const feedRef = React.useRef(null);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.pageX - feedRef.current.offsetLeft);
    setScrollLeft(feedRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - feedRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll-fast
    feedRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <div className="capy-tips-container page-transition" style={{ overflow: 'hidden', height: '100vh' }}>
      {/* Sidebar */}
      <aside className="cappies-sidebar">
        <div className="sidebar-menu">
          {menuItems.map((item) => (
            <div 
              key={item.label}
              className={`sidebar-item ${activeTab === item.label ? 'active' : ''}`}
              onClick={() => {
                if (item.label === 'CapyHome') navigate('/home');
                else if (item.label === 'Connections') navigate('/connections');
                else if (item.label === 'CapyDEVS') navigate('/devs');
                else if (item.label === 'CapyTips') setActiveTab('CapyTips');
                else if (item.label === 'Reels') navigate('/reels');
                else if (item.label === 'Activities') navigate('/activities');
                else if (item.label === 'Learn') navigate('/learn');
                else if (item.label === 'Offers') navigate('/offers');
                else if (item.label === 'Recruit') navigate('/recruit');
                else if (item.label === 'Crew') navigate('/crew');
                else if (item.label === 'Profile') navigate('/profile');
                else if (item.label === 'Settings') navigate('/settings');
                else if (item.label === 'Play') navigate('/play');
              }}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <div className="tips-content-wrapper">
        <div className="tips-header-section">
           <button className="post-tip-btn" onClick={() => setShowPostModal(true)}>
              + Post Tip
           </button>
        </div>

        <div className="tips-main-grid">
           {/* Left Info Panel */}
           <div className="tips-info-panel">
              <span className="tips-label">Tips</span>
              <h2>Today’s Insights</h2>
              <div className="tips-countdown">
                 {tips.length} Active Tips
              </div>
              <p className="tips-description">
                 swipe, read, and<br/>
                 learn every day.
              </p>
           </div>

           {/* Tip Cards Feed */}
           <div 
             className="tips-feed" 
             ref={feedRef}
             onMouseDown={handleMouseDown}
             onMouseLeave={handleMouseLeave}
             onMouseUp={handleMouseUp}
             onMouseMove={handleMouseMove}
             style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
           >
              {tips.length > 0 ? (
                tips.map((tip) => (
                  <div key={tip.id} className="tip-card">
                     <div className="tip-card-badge">
                        {tip.authorVerified && (
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        )}
                        {tip.authorName || (tip.authorVerified ? 'DEVS' : 'USER')}
                     </div>
                     
                     {/* Delete Button */}
                     {(isAdmin || (auth.currentUser && auth.currentUser.uid === tip.authorId)) && (
                        <button 
                          className="delete-tip-btn" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTip(tip.id);
                          }}
                          title="Delete Tip"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                     )}
                     
                     <p className="tip-content">{tip.content}</p>
                     
                     <div className="tip-footer">
                        <span className="tip-expiry">{getTimeLeft(tip.expiresAt)}</span>
                     </div>

                     <div className="tip-actions">
                        <button 
                          className={`tip-action-btn like ${userVotes[tip.id] === 1 ? 'active' : ''}`}
                          onClick={() => handleVote(tip, 1)}
                        >
                           <svg width="24" height="24" viewBox="0 0 24 24" fill={userVotes[tip.id] === 1 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                        </button>
                        
                        <span className="score-count">
                           {isNaN(Number(tip.score)) ? 0 : Number(tip.score)}
                        </span>

                        <button 
                          className={`tip-action-btn dislike ${userVotes[tip.id] === -1 ? 'active' : ''}`}
                          onClick={() => handleVote(tip, -1)}
                        >
                           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="15" x2="16" y2="15"></line><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                        </button>
                     </div>
                  </div>
                ))
              ) : (
                /* Default Card (Always Visible if no tips) */
                <div className="tip-card default-card">
                   <div className="tip-card-badge">Tips Guide</div>
                   <p className="tip-content">
                     No tips yet. Click ‘Post a Tip’ to create one. Tips expire after the selected timer. Keep it short, clear, and helpful.
                   </p>
                   <button className="post-tip-cta-btn" onClick={() => setShowPostModal(true)}>
                     Post a Tip
                   </button>
                </div>
              )}
           </div>
        </div>
      </div>

      {/* Post Modal */}
      {showPostModal && (
        <div className="modal-overlay">
           <div className="modal-content post-tip-modal">
              <h3>Post a Tip</h3>
              
              <div className="form-group">
                 <label>Insight (10-220 chars):</label>
                 <textarea 
                   value={newInsight}
                   onChange={(e) => setNewInsight(e.target.value)}
                   className="tip-input"
                   placeholder="Enter your cybersecurity insight..."
                   maxLength={220}
                 />
                 <small>{newInsight.length}/220</small>
              </div>

              <div className="form-group">
                 <label>Duration:</label>
                 <select 
                   value={timerDuration} 
                   onChange={(e) => setTimerDuration(Number(e.target.value))}
                   className="tip-select"
                 >
                    <option value={6}>6 Hours</option>
                    <option value={12}>12 Hours</option>
                    <option value={24}>24 Hours</option>
                 </select>
              </div>

              <div className="modal-actions">
                 <button className="cancel-btn" onClick={() => setShowPostModal(false)}>Cancel</button>
                 <button className="confirm-btn" onClick={handlePostTip} disabled={isPosting}>
                    {isPosting ? 'Posting...' : 'Post'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CapyTips;
