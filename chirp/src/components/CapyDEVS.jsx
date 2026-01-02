import React, { useState, useEffect } from 'react';
import { getDatabase, ref, push, onValue, serverTimestamp } from 'firebase/database';
import { auth } from '../firebase';
import './CapyDEVS.css';
import CapyModal from './CapyModal';

const CapyDEVS = () => {
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '', tag: 'Update' });

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
      setUser(currentUser);
      // Check if admin (hardcoded email for demo or check role from DB)
      // In real app: fetch user role from DB
      if (currentUser && (currentUser.email === 'admin@chirp.com' || currentUser.email.includes('dev'))) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    });

    const postsRef = ref(db, 'dev_posts');
    onValue(postsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedPosts = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value
        })).sort((a, b) => b.timestamp - a.timestamp);
        setPosts(loadedPosts);
      } else {
        setPosts([]);
      }
    });

    return () => unsubscribe();
  }, [db]);

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!newPost.title || !newPost.content) return;

    try {
      await push(ref(db, 'dev_posts'), {
        ...newPost,
        author: user.displayName || 'CapyDev Team',
        authorId: user.uid,
        timestamp: serverTimestamp()
      });
      setNewPost({ title: '', content: '', tag: 'Update' });
      showModal({ message: 'Update posted successfully!', title: 'Success' });
    } catch (error) {
      console.error("Error posting update:", error);
    }
  };

  return (
    <div className="capy-devs-container">
      <header className="devs-header">
        <h1 className="devs-title">
          👨‍💻 CapyDEVS <span className="dev-badge">OFFICIAL</span>
        </h1>
        <p className="devs-subtitle">
          The official source for CHIRP platform updates, security advisories, and developer news.
        </p>
      </header>

      {isAdmin && (
        <div className="admin-post-form">
          <h3>📢 Post an Update</h3>
          <form onSubmit={handlePostSubmit}>
            <input 
              className="admin-input"
              type="text" 
              placeholder="Title" 
              value={newPost.title}
              onChange={(e) => setNewPost({...newPost, title: e.target.value})}
            />
            <textarea 
              className="admin-input"
              rows="4"
              placeholder="Content (Markdown supported in future)"
              value={newPost.content}
              onChange={(e) => setNewPost({...newPost, content: e.target.value})}
            />
            <select 
              className="admin-input"
              value={newPost.tag}
              onChange={(e) => setNewPost({...newPost, tag: e.target.value})}
            >
              <option value="Update">Update</option>
              <option value="Security">Security</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Feature">Feature</option>
            </select>
            <button type="submit" className="admin-submit-btn">Post Update</button>
            <div style={{ clear: 'both' }}></div>
          </form>
        </div>
      )}

      <div className="devs-feed">
        {posts.length > 0 ? (
          posts.map(post => (
            <article key={post.id} className="dev-post-card">
              <div className="dev-post-header">
                <div>
                  <h2 className="dev-post-title">{post.title}</h2>
                  <div className="dev-post-meta">
                    <span>By {post.author}</span>
                    <span>•</span>
                    <span>{new Date(post.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
                <span className="dev-post-tag">{post.tag}</span>
              </div>
              <div className="dev-post-content">
                <p>{post.content}</p>
              </div>
            </article>
          ))
        ) : (
          <div style={{ textAlign: 'center', color: '#888' }}>
            <p>No updates yet. Stay tuned!</p>
          </div>
        )}
      </div>
      <CapyModal {...modalConfig} onClose={closeModal} />
    </div>
  );
};

export default CapyDEVS;
