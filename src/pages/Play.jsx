import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { getDatabase, ref, onValue, push, serverTimestamp, runTransaction } from 'firebase/database';
import { auth } from '../firebase';
import { uploadToImgBB } from '../utils/imgbb';
import InitialsAvatar from '../components/InitialsAvatar';
import CapyModal from '../components/CapyModal';
import './Play.css';
import './PlayGame.css'; // New styles
import '../components/CapyHome.css'; // Reuse some styles
import '../components/Cappies.css'; // Reuse sidebar styles

const Play = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [activeTab, setActiveTab] = useState('Play'); // For sidebar highlighting
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Game Room State
  const [selectedGame, setSelectedGame] = useState(null); // For playing
  const [isPlaying, setIsPlaying] = useState(false); // Has user clicked Play?
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [pointerLockEnabled, setPointerLockEnabled] = useState(false);
  const gameCanvasRef = useRef(null);
  const iframeRef = useRef(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check Admin Status
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && (user.email === 'admin@chirp.com' || user.email.includes('dev'))) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Upload State
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadImage, setUploadImage] = useState(null);
  const [uploadFile, setUploadFile] = useState(null); // The HTML file
  const [uploadEmbedCode, setUploadEmbedCode] = useState(''); // The embed code or URL
  const [uploadType, setUploadType] = useState('file'); // 'file' or 'embed'
  const [uploadCategory, setUploadCategory] = useState('user'); // user, developer, other
  const [isUploading, setIsUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [votedGameIds, setVotedGameIds] = useState({});

  // Load voted games from local storage
  useEffect(() => {
    const loadedVotes = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('voted_')) {
            const gameId = key.replace('voted_', '');
            loadedVotes[gameId] = true;
        }
    }
    setVotedGameIds(loadedVotes);
  }, []);

  // Sidebar Menu Items (Same as CapyHome)
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

  // Fetch Games
  useEffect(() => {
    const db = getDatabase();
    const gamesRef = ref(db, 'games');
    const unsubscribe = onValue(gamesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const gamesArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).reverse(); // Newest first
        setGames(gamesArray);
      } else {
        setGames([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Lock body scroll when game is open
  useEffect(() => {
    if (selectedGame) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedGame]);

  // Handlers
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadFile(file);
    }
  };

  const handleUpload = async () => {
    if (!uploadTitle || !uploadImage) {
      alert("Please provide a title and cover image.");
      return;
    }

    if (uploadType === 'file' && !uploadFile) {
        alert("Please upload a game file.");
        return;
    }

    if (uploadType === 'embed' && !uploadEmbedCode) {
        alert("Please provide the embed code or URL.");
        return;
    }

    setIsUploading(true);
    const user = auth.currentUser;
    const db = getDatabase();

    try {
      // 1. Upload Image to ImgBB
      const imgData = await uploadToImgBB(uploadImage);
      const imageUrl = imgData.url;

      let gameContent = '';
      let isEmbed = false;
      let isChunked = false;
      let htmlChunks = [];

      if (uploadType === 'file') {
          // 2. Read Game File as Text
          const readFileAsText = (file) => {
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target.result);
              reader.onerror = (e) => reject(e);
              reader.readAsText(file);
            });
          };
          gameContent = await readFileAsText(uploadFile);
          
          // Chunking Logic (1MB chunks)
          if (gameContent.length > 1048576) {
              isChunked = true;
              const chunkSize = 1048576;
              for (let i = 0; i < gameContent.length; i += chunkSize) {
                  htmlChunks.push(gameContent.slice(i, i + chunkSize));
              }
          }
      } else {
          // 3. Use Embed Code
          // Basic sanitization/check could go here, but for now trusting user input or wrapping it
          // If it's a URL, wrap in iframe. If it's <iframe..., keep it.
          const code = uploadEmbedCode.trim();
          if (code.startsWith('<iframe') || code.startsWith('<embed')) {
              gameContent = code;
          } else if (code.startsWith('http')) {
              gameContent = `<iframe src="${code}" style="width:100%;height:100%;border:none;" allowfullscreen></iframe>`;
          } else {
              // Assume it's raw HTML snippet
              gameContent = code;
          }
          isEmbed = true;
      }

      // 4. Save Metadata
      const newGame = {
        title: uploadTitle,
        description: uploadDescription,
        image: imageUrl,
        author: user.displayName || 'Anonymous Developer',
        authorId: user.uid,
        category: uploadCategory,
        timestamp: serverTimestamp(),
        plays: 0,
        isEmbed: isEmbed,
        isChunked: isChunked,
        htmlChunks: isChunked ? htmlChunks : null,
        htmlContent: isChunked ? null : gameContent
      };

      await push(ref(db, 'games'), newGame);
      
      setIsUploading(false);
      setShowUploadModal(false);
      setUploadTitle('');
      setUploadDescription('');
      setUploadImage(null);
      setUploadFile(null);
      setUploadEmbedCode('');
      setImagePreview(null);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed: " + error.message);
      setIsUploading(false);
    }
  };

  const handlePlayGame = (game) => {
    setSelectedGame(game);
    setIsPlaying(false);
    setIsEnlarged(false);
    // Increment play count
    const db = getDatabase();
    runTransaction(ref(db, `games/${game.id}/plays`), (plays) => (plays || 0) + 1);
  };

  const handleVote = (e, game) => {
    e.stopPropagation();
    if (votedGameIds[game.id]) {
      alert("You have already voted for this game!");
      return;
    }

    // Optimistic UI update
    setVotedGameIds(prev => ({ ...prev, [game.id]: true }));
    localStorage.setItem(`voted_${game.id}`, 'true');

    const db = getDatabase();
    runTransaction(ref(db, `games/${game.id}/votes`), (votes) => (votes || 0) + 1)
      .catch(err => {
        console.error("Vote failed", err);
        // Revert on failure
        setVotedGameIds(prev => {
            const newState = { ...prev };
            delete newState[game.id];
            return newState;
        });
        localStorage.removeItem(`voted_${game.id}`);
        alert("Vote failed. Please try again.");
      });
  };

  const toggleFullscreen = () => {
    if (!gameCanvasRef.current) return;
    
    if (!document.fullscreenElement) {
      gameCanvasRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleStartGame = () => {
    setIsPlaying(true);
    // Send initial pointer lock state after a short delay to ensure iframe is loaded
    setTimeout(() => {
        if (iframeRef.current) {
            iframeRef.current.contentWindow.postMessage({
                type: 'SET_POINTER_LOCK',
                value: pointerLockEnabled
            }, '*');
        }
    }, 1000);
  };

  useEffect(() => {
    if (isPlaying && iframeRef.current) {
        iframeRef.current.contentWindow.postMessage({
            type: 'SET_POINTER_LOCK',
            value: pointerLockEnabled
        }, '*');
    }
  }, [pointerLockEnabled, isPlaying]);

  const getGameContent = (htmlContent) => {
    const style = `
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #000;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
        }
        /* Ensure game containers are centered and don't overflow */
        canvas, #game-container, #unity-container {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
      </style>
    `;
    const script = `
      <script>
        (function() {
          let lockEnabled = false;
          window.addEventListener('message', function(e) {
            if (e.data && e.data.type === 'SET_POINTER_LOCK') {
              lockEnabled = e.data.value;
              console.log('Pointer Lock:', lockEnabled);
            }
          });
          
          document.addEventListener('click', function() {
            if (lockEnabled) {
              document.body.requestPointerLock();
            }
          });
        })();
      </script>
    `;
    return htmlContent + style + script;
  };

  const handleShare = (platform) => {
    if (!selectedGame) return;
    
    const url = window.location.href;
    const text = `Check out ${selectedGame.title} on CapyArcade!`;
    
    if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
    } else if (platform === 'copy') {
      navigator.clipboard.writeText(url).then(() => {
        alert('Link copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy: ', err);
      });
    }
  };

  const topRatedGames = [...games].sort((a, b) => (b.votes || 0) - (a.votes || 0)).slice(0, 5);
  const trendingGames = [...games].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 5);

  const renderGameCard = (game) => (
    <div key={game.id} className="game-card" onClick={() => handlePlayGame(game)}>
      <div className="game-thumbnail-wrapper">
        <img src={game.image} alt={game.title} className="game-thumbnail" />
        <div className="play-overlay">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </div>
      </div>
      <div className="game-info">
        <h3 className="game-title">{game.title}</h3>
        <span className="game-author">by {game.author}</span>
        <div className="game-stats-row">
           <button className="vote-btn" onClick={(e) => handleVote(e, game)} title="Vote for this game">
             <svg width="16" height="16" viewBox="0 0 24 24" fill={votedGameIds[game.id] ? "var(--capy-accent)" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
             <span>{game.votes || 0}</span>
           </button>
        </div>
      </div>
    </div>
  );

  const currentGame = selectedGame ? (games.find(g => g.id === selectedGame.id) || selectedGame) : null;

  return (
    <div className="cappies-page-wrapper page-transition">
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
                else if (item.label === 'CapyTips') navigate('/tips');
                else if (item.label === 'Reels') navigate('/reels');
                else if (item.label === 'Activities') navigate('/activities');
                else if (item.label === 'Learn') navigate('/learn');
                else if (item.label === 'Offers') navigate('/offers');
                else if (item.label === 'Recruit') navigate('/recruit');
                else if (item.label === 'Crew') navigate('/crew');
                else if (item.label === 'Profile') navigate('/profile');
                else if (item.label === 'Settings') navigate('/settings');
                else if (item.label === 'Play') setActiveTab('Play');
              }}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <div className="cappies-container">
        <main className="play-content">
          <div className="play-header">
            <h1>Arcade</h1>
            <button className="upload-game-btn" onClick={() => setShowUploadModal(true)}>
              Upload Game
            </button>
          </div>

          {/* Statistics Sections */}
          {games.length > 0 && (
            <div className="stats-container">
               <div className="game-section">
                  <div className="section-header">
                    <h2>Top Rated</h2>
                  </div>
                  <div className="game-grid">
                    {topRatedGames.map(renderGameCard)}
                  </div>
               </div>
               
               <div className="game-section">
                  <div className="section-header">
                    <h2>Trending (Most Played)</h2>
                  </div>
                  <div className="game-grid">
                    {trendingGames.map(renderGameCard)}
                  </div>
               </div>
            </div>
          )}

          {/* Categories */}
          {['developer', 'user', 'other'].map(cat => {
              const catGames = games.filter(g => g.category === cat);
              if (catGames.length === 0) return null;
              
              let title = 'Community Games';
              if (cat === 'developer') title = 'Official Games';
              if (cat === 'other') title = 'More Fun';
  
              return (
                <div key={cat} className="game-section">
                  <div className="section-header">
                    <h2>{title}</h2>
                    <span className="view-more">View More</span>
                  </div>
                  <div className="game-grid">
                    {catGames.map(renderGameCard)}
                  </div>
                </div>
              );
          })}
          
          {games.length === 0 && (
             <div className="no-games">
               <h3>No games yet!</h3>
               <p>Be the first to upload a game.</p>
             </div>
          )}

        </main>
      </div>

      {/* Upload Modal */}
      {showUploadModal && createPortal(
        <div className="modal-overlay upload-modal-overlay">
          <div className="modal-content upload-modal">
            <h3>Upload Your Game</h3>
            <div className="form-group">
              <label>Game Title</label>
              <input 
                type="text" 
                value={uploadTitle} 
                onChange={e => setUploadTitle(e.target.value.toUpperCase())} 
                placeholder="ENTER GAME NAME" 
                style={{ textTransform: 'uppercase' }}
              />
            </div>

            <div className="form-group">
              <label>Description (Optional)</label>
              <textarea 
                value={uploadDescription} 
                onChange={e => setUploadDescription(e.target.value)} 
                placeholder="Tell us about your game..."
                rows="3"
              />
            </div>
            
            <div className="form-group">
              <label>Category</label>
              <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)}>
                <option value="user">Community Game</option>
                {isAdmin && <option value="developer">Official/Developer</option>}
                <option value="other">Other Source</option>
              </select>
            </div>

            <div className="form-group">
              <label>Cover Image</label>
              <div className="file-input-wrapper">
                 <button onClick={() => document.getElementById('game-img-upload').click()}>
                    {uploadImage ? 'Change Image' : 'Select Image'}
                 </button>
                 <input id="game-img-upload" type="file" accept="image/*" onChange={handleImageSelect} hidden />
              </div>
              {imagePreview && <img src={imagePreview} alt="Preview" className="upload-preview" />}
            </div>

            <div className="form-group">
              <label>Game Source</label>
              <div className="upload-type-selector">
                  <button 
                    className={`type-btn ${uploadType === 'file' ? 'active' : ''}`}
                    onClick={() => setUploadType('file')}
                  >
                    Upload HTML File
                  </button>
                  <button 
                    className={`type-btn ${uploadType === 'embed' ? 'active' : ''}`}
                    onClick={() => setUploadType('embed')}
                  >
                    Embed Code / URL
                  </button>
              </div>

              {uploadType === 'file' ? (
                <div className="file-input-wrapper">
                   <button onClick={() => document.getElementById('game-file-upload').click()}>
                      {uploadFile ? uploadFile.name : 'Select HTML File'}
                   </button>
                   <input id="game-file-upload" type="file" accept=".html,.htm" onChange={handleFileSelect} hidden />
                </div>
              ) : (
                <textarea 
                  placeholder="Paste your <iframe> code or Game URL here..." 
                  value={uploadEmbedCode}
                  onChange={(e) => setUploadEmbedCode(e.target.value)}
                />
              )}
            </div>

            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowUploadModal(false)}>Cancel</button>
              <button className="confirm-btn" onClick={handleUpload} disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Upload Game'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Game Room Overlay */}
      {currentGame && (
        <div className="game-room-overlay">
          {/* Header */}
          <header className="game-room-header">
            <div className="game-room-brand">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"></rect><path d="M6 12h4m-2-2v4M15 11h.01M18 13h.01"></path></svg>
              <span>CapyArcade</span>
            </div>
            
            <h2 className="game-room-title">{currentGame.title}</h2>
            
            <div className="game-room-controls">
              <button className="vote-btn" onClick={(e) => handleVote(e, currentGame)} style={{marginRight: '10px', color: 'white', borderColor: '#333'}}>
                 <svg width="16" height="16" viewBox="0 0 24 24" fill={votedGameIds[currentGame.id] ? "var(--capy-accent)" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                 <span>{currentGame.votes || 0}</span>
              </button>
              <button className="back-btn" onClick={() => setSelectedGame(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                Back to Games
              </button>
            </div>
          </header>

          {/* Main Content */}
          <div className={`game-room-content ${isEnlarged ? 'enlarged' : ''}`}>
             
             {/* Left: Game Canvas */}
             <div className="game-canvas-section">
                <div className="game-canvas-wrapper" ref={gameCanvasRef}>
                   {!isPlaying && (
                     <div className="game-start-overlay" style={{ backgroundImage: `url(${currentGame.image})` }}>
                        <div className="game-overlay-info">
                          <h1 className="game-overlay-title">{currentGame.title}</h1>
                          <button className="play-btn-large" onClick={handleStartGame}>
                             <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                             PLAY GAME
                          </button>
                        </div>
                     </div>
                   )}
                   
                   {isPlaying && (
                     <iframe 
                        ref={iframeRef}
                        src={currentGame.isUrl ? currentGame.htmlContent : undefined}
                        srcDoc={!currentGame.isUrl ? getGameContent(currentGame.isChunked && currentGame.htmlChunks ? currentGame.htmlChunks.join('') : currentGame.htmlContent) : undefined}
                        title={currentGame.title} 
                        className="game-iframe"
                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-pointer-lock"
                        allowFullScreen
                      />
                   )}
                </div>

                <div className="game-canvas-footer">
                  <div className="game-footer-title">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                     <span>By clicking "Play Game", you agree to our Terms of Service.</span>
                  </div>
                  <div className="canvas-actions">
                     <button className="canvas-action-btn" onClick={toggleFullscreen} title="Fullscreen">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
                     </button>
                     <button className="canvas-action-btn" onClick={() => setIsEnlarged(!isEnlarged)} title="Theater Mode">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
                     </button>
                  </div>
                </div>
             </div>

             {/* Right: Info Sidebar */}
             <div className="game-info-sidebar">
                <div className="info-card">
                   <h3>Game Info</h3>
                   <div className="tags-container">
                      <span className="game-tag">{currentGame.category}</span>
                      <span className="game-tag">HTML5</span>
                      <span className="game-tag">Browser</span>
                      <span className="game-tag">Indie</span>
                   </div>
                   
                   <p className="game-description">
                      {currentGame.description || (
                        <>
                          {currentGame.title} is an exciting game created by {currentGame.author}. 
                          Dive into the action and challenge your friends!
                        </>
                      )}
                   </p>

                   <div className="how-to-play">
                      <span className="how-to-title">How to Play:</span>
                      <p className="how-to-text">
                         Use Mouse/Touch to interact. <br/>
                         Follow on-screen instructions.
                      </p>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Play;
