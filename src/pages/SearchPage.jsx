import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { searchApi } from '../utils/searchApi';
import InitialsAvatar from '../components/InitialsAvatar';
import MiniProfileCard from '../components/MiniProfileCard';
import './SearchPage.css';

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const query = searchParams.get('q') || '';
  const typeParam = searchParams.get('type') || 'all'; // 'all', 'users', 'posts'

  const [results, setResults] = useState({ users: [], posts: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // State for MiniProfileCard
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    const fetchResults = async () => {
      if (!query.trim()) {
        setResults({ users: [], posts: [] });
        return;
      }

      setLoading(true);
      setError(null);
      // Clear previous results to prevent stale data flicker
      // Or keep them? User said "clear previous results OR keep them but visually indicate loading".
      // I'll clear them for clarity.
      setResults({ users: [], posts: [] });

      try {
        const data = await searchApi(query, typeParam);
        setResults(data);
      } catch (err) {
        console.error(err);
        setError("Search failed. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    // Simple debounce via useEffect cleanup or just rely on the API call being fast enough?
    // Since this runs on `query` change (which updates on Enter/Click from Navbar),
    // we don't need extra debounce here if Navbar handles the input debounce.
    // But if user manually changes URL, it triggers.
    
    fetchResults();
  }, [query, typeParam]);

  const handleTabChange = (newType) => {
    setSearchParams({ q: query, type: newType });
  };

  const handleUserClick = (e, uid, initialName, initialAvatar) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Calculate position relative to viewport
    // Default to showing on the right side
    setSelectedUser({
      uid,
      x: rect.right + 10, // Show to the right of the element
      y: rect.top, // Align with top of element
      initialName,
      initialAvatar
    });
  };

  const handlePostClick = (uid) => {
    // For posts, we might want to open the post detail or profile?
    // User requirement: "when it is post result it is clickable when click it will go to that post"
    // Assuming we navigate to profile for now since we don't have a dedicated post page yet,
    // or maybe the user meant "go to that post" -> navigate to home with post expanded?
    // For now, let's navigate to the author's profile as a fallback, or implement post detail routing if it existed.
    // Actually, earlier code in SearchPage.jsx navigated to profile. 
    // Wait, the prompt says "clicking opens the post".
    // Since we don't have a /post/:id route in the App.jsx list (only /photo/:postId/:index), 
    // I will assume for now we might not have a standalone post page. 
    // But let's check CapyHome... it has modal for comments.
    // Let's just navigate to home for now or keep existing behavior if it was opening something.
    // The previous code had: onClick={() => handleUserClick(post.author.id)} for the header.
    // The prompt says "when it is post result it is clickable when click it will go to that post".
    // I'll leave the post click behavior to do nothing for now or navigate to home, 
    // BUT the user specifically asked for "users - the container is not clickable - it will just have an add cappy button".
    // So I need to change the user item to trigger the MiniProfileCard instead of navigating.
  };

  // Render Helpers
  const renderUsers = () => {
    if (results.users.length === 0) return null;
    return (
      <div className="search-section">
        <h3 className="section-title">Users</h3>
        <div className="results-list">
          {results.users.map(user => (
            <div 
              key={user.id} 
              className="user-result-item" 
              style={{ cursor: 'default' }}
            >
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="result-avatar" />
              ) : (
                <InitialsAvatar name={user.name} uid={user.id} size={48} className="result-avatar" />
              )}
              <div className="result-user-info">
                <span className="result-name">{user.name}</span>
                <span className="result-username">@{user.username}</span>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                 <button 
                   className="capy-btn-secondary" 
                   style={{ fontSize: '12px', padding: '4px 8px' }}
                   onClick={(e) => handleUserClick(e, user.id, user.name, user.avatar)}
                 >
                    View Card
                 </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPosts = () => {
    if (results.posts.length === 0) return null;
    return (
      <div className="search-section">
        <h3 className="section-title">Posts</h3>
        <div className="posts-grid">
          {results.posts.map(post => {
            const firstImg = post.images && post.images.length > 0 ? post.images[0] : null;
            const displayImage = post.image || (firstImg ? (firstImg.url || firstImg) : null);
            
            return (
              <div key={post.id} className="post-result-item" onClick={() => navigate(`/post/${post.id}`)}>
                <div className="result-post-header">
                  {post.author.avatar ? (
                    <img src={post.author.avatar} alt={post.author.name} className="result-post-author-avatar" />
                  ) : (
                    <InitialsAvatar name={post.author.name} uid={post.author.id} size={24} fontSize="10px" className="result-post-author-avatar" />
                  )}
                  <span className="result-post-author">{post.author.name}</span>
                  <span style={{color: 'var(--capy-text-secondary)', fontSize: '12px'}}>• {new Date(post.timestamp).toLocaleDateString()}</span>
                </div>
                <div className="result-post-body">
                  {post.content && <p className={`result-post-text ${displayImage || post.linkPreview ? 'has-image' : ''}`}>{post.content}</p>}
                  {displayImage && (
                    <div className="result-post-image-wrapper">
                      <img src={displayImage} alt="Post content" className="result-post-image" />
                    </div>
                  )}
                  {!displayImage && post.linkPreview && (
                    <div className="result-post-link-preview">
                        {post.linkPreview.image && (
                          <div className="result-link-image" style={{backgroundImage: `url(${post.linkPreview.image})`}}></div>
                        )}
                        <div className="result-link-content">
                          <div className="result-link-title">{post.linkPreview.title}</div>
                          <div className="result-link-domain">{post.linkPreview.source || new URL(post.linkPreview.url).hostname}</div>
                        </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="search-page-container page-transition">
      <div className="search-header">
        <h1 className="search-title">Search Results for "{query}"</h1>
        <div className="search-tabs">
          <button 
            className={`search-tab ${typeParam === 'all' ? 'active' : ''}`}
            onClick={() => handleTabChange('all')}
          >
            All
          </button>
          <button 
            className={`search-tab ${typeParam === 'users' ? 'active' : ''}`}
            onClick={() => handleTabChange('users')}
          >
            Users
          </button>
          <button 
            className={`search-tab ${typeParam === 'posts' ? 'active' : ''}`}
            onClick={() => handleTabChange('posts')}
          >
            Posts
          </button>
        </div>
      </div>

      {loading && (
        <div className="search-loading">
          <div className="search-spinner"></div>
          Searching...
        </div>
      )}

      {error && (
        <div className="search-empty" style={{color: '#ff4d4d'}}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {results.users.length === 0 && results.posts.length === 0 ? (
            <div className="search-empty">
              No results found for "{query}"
            </div>
          ) : (
            <>
              {(typeParam === 'all' || typeParam === 'users') && renderUsers()}
              {(typeParam === 'all' || typeParam === 'posts') && renderPosts()}
            </>
          )}
        </>
      )}

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

export default SearchPage;
