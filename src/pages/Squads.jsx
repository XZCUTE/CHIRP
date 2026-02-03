import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDatabase, ref, onValue, push, update, get } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import SquadService from '../services/SquadService';
import './Squads.css';

const Squads = () => {
  const navigate = useNavigate();
  const auth = getAuth();
  const user = auth.currentUser;
  const db = getDatabase();

  const [activeTab, setActiveTab] = useState('find'); // find, my, recruit
  const [squads, setSquads] = useState([]);
  const [recruitPosts, setRecruitPosts] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRecruitModal, setShowRecruitModal] = useState(false);
  
  // Edit State
  const [editingSquad, setEditingSquad] = useState(null);
  const [editingRecruitPost, setEditingRecruitPost] = useState(null);

  // Selected Squad for Details/Chat
  const [selectedSquad, setSelectedSquad] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const [squadMessages, setSquadMessages] = useState([]);
  const chatEndRef = useRef(null);

  // New Squad Form State
  const [newSquadName, setNewSquadName] = useState('');
  const [newSquadTag, setNewSquadTag] = useState('General');
  const [isPrivate, setIsPrivate] = useState(false);

  // New Recruit Post State
  const [recruitTitle, setRecruitTitle] = useState('');
  const [recruitTags, setRecruitTags] = useState('');
  const [recruitDesc, setRecruitDesc] = useState('');

  useEffect(() => {
    // Migration Logic via Service
    SquadService.migrateCrewsToSquads();

    // Fetch Squads
    const squadsRef = ref(db, 'squads');
    const unsubSquads = onValue(squadsRef, (snap) => {
        const data = snap.val();
        if (data) {
            setSquads(Object.entries(data).map(([id, val]) => ({ id, ...val })));
        } else {
            setSquads([]);
        }
    });

    // Fetch Recruit Posts
    const recruitRef = ref(db, 'recruit_posts');
    const unsubRecruit = onValue(recruitRef, (snap) => {
        const data = snap.val();
        if (data) {
            setRecruitPosts(Object.entries(data).map(([id, val]) => ({ id, ...val })).reverse());
        } else {
            setRecruitPosts([]);
        }
    });

    return () => {
        unsubSquads();
        unsubRecruit();
    };
  }, [db]);

  // Watch for messages when a squad is selected
  useEffect(() => {
    if (!selectedSquad) return;

    const messagesRef = ref(db, `squads/${selectedSquad.id}/messages`);
    const unsubMessages = onValue(messagesRef, (snap) => {
        const data = snap.val();
        if (data) {
            const msgs = Object.entries(data).map(([id, val]) => {
                // Decrypt message (mock)
                let content = val.content;
                if (val.isEncrypted) {
                    try {
                        content = atob(val.content);
                    } catch (e) {
                        content = "**Decryption Error**";
                    }
                }
                return { id, ...val, content };
            });
            setSquadMessages(msgs.sort((a, b) => a.timestamp - b.timestamp));
        } else {
            setSquadMessages([]);
        }
    });

    return () => unsubMessages();
  }, [selectedSquad, db]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [squadMessages]);

  const handleCreateSquad = async (e) => {
      e.preventDefault();
      if (!newSquadName.trim() || !user) return;
      
      try {
        if (editingSquad) {
            await SquadService.updateSquad(editingSquad.id, {
                name: newSquadName,
                tag: newSquadTag,
                isPrivate
            });
            setEditingSquad(null);
        } else {
            await SquadService.createSquad(newSquadName, newSquadTag, isPrivate, user.uid);
        }
        setShowCreateModal(false);
        setNewSquadName('');
        setNewSquadTag('General');
        setIsPrivate(false);
      } catch (error) {
        console.error("Failed to save squad", error);
      }
  };

  const handleEditSquadClick = (squad) => {
      setEditingSquad(squad);
      setNewSquadName(squad.name);
      setNewSquadTag(squad.tag);
      setIsPrivate(squad.isPrivate);
      setShowCreateModal(true);
  };

  const handleDeleteSquad = async (squad) => {
      if (!window.confirm(`Are you sure you want to delete ${squad.name}?`)) return;
      try {
          await SquadService.deleteSquad(squad.id);
      } catch (error) {
          console.error("Failed to delete squad", error);
      }
  };

  const handleCreateRecruitPost = async (e) => {
      e.preventDefault();
      if (!recruitTitle.trim() || !user) return;

      try {
          if (editingRecruitPost) {
              await SquadService.updateRecruitPost(editingRecruitPost.id, {
                  title: recruitTitle,
                  tags: recruitTags.split(',').map(t => t.trim()),
                  description: recruitDesc
              });
              setEditingRecruitPost(null);
          } else {
              await SquadService.createRecruitPost({
                  title: recruitTitle,
                  tags: recruitTags.split(',').map(t => t.trim()),
                  description: recruitDesc,
                  authorId: user.uid,
                  author: user.displayName || 'Anonymous',
                  eventType: 'General'
              });
          }
          setShowRecruitModal(false);
          setRecruitTitle('');
          setRecruitTags('');
          setRecruitDesc('');
      } catch (error) {
          console.error("Failed to save recruit post", error);
      }
  };

  const handleEditRecruitClick = (post) => {
      setEditingRecruitPost(post);
      setRecruitTitle(post.title);
      setRecruitTags(post.tags ? post.tags.join(', ') : '');
      setRecruitDesc(post.description);
      setShowRecruitModal(true);
  };

  const handleDeleteRecruitPost = async (post) => {
      if (!window.confirm("Delete this recruitment post?")) return;
      try {
          await SquadService.deleteRecruitPost(post.id);
      } catch (error) {
          console.error("Failed to delete post", error);
      }
  };

  const handleSendMessage = async (e) => {
      e.preventDefault();
      if (!chatMessage.trim() || !user || !selectedSquad) return;

      try {
          await SquadService.sendSquadMessage(selectedSquad.id, user.uid, chatMessage);
          setChatMessage('');
      } catch (error) {
          console.error("Failed to send message", error);
      }
  };

  const joinSquad = async (squad) => {
      if (!user) return;
      try {
          await SquadService.joinSquad(squad.id, user.uid);
          alert(`Joined ${squad.name}!`);
      } catch (error) {
          console.error("Failed to join squad", error);
      }
  };

  const menuItems = [
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
    <div className="squads-page-wrapper">
      <aside className="squads-sidebar">
        <div className="sidebar-menu">
          {menuItems.map((item) => (
            <div 
              key={item.label}
              className={`sidebar-item ${item.label === 'Squads' ? 'active' : ''}`}
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
      <div className="squads-content">
      {selectedSquad ? (
          // Squad Details View (Chat & Info)
          <div className="squad-details-view">
              <div className="squad-details-header">
                    <button className="back-btn" onClick={() => setSelectedSquad(null)}>← Back</button>
                    <h2>{selectedSquad.name} <span className="squad-tag-badge">{selectedSquad.tag}</span></h2>
                </div>
                
                <div className="squad-chat-container">
                    <div className="chat-messages">
                        {squadMessages.length === 0 ? (
                            <div className="empty-chat">Encrypted Channel Initialized. No messages yet.</div>
                        ) : (
                            squadMessages.map(msg => (
                                <div key={msg.id} className={`chat-message ${msg.senderId === user?.uid ? 'my-message' : ''}`}>
                                    <div className="message-content">
                                        {msg.content}
                                    </div>
                                    <div className="message-meta">
                                        {msg.isEncrypted && <span title="End-to-end Encrypted">🔒 </span>}
                                        {new Date(msg.timestamp).toLocaleTimeString()}
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={chatEndRef} />
                    </div>
                    <form className="chat-input-area" onSubmit={handleSendMessage}>
                        <input 
                            type="text" 
                            placeholder="Send encrypted message..." 
                            value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                        />
                        <button type="submit" aria-label="Send">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </form>
                </div>
            </div>
        ) : (
            // Main Dashboard View
            <>
                <div className="squads-header">
                    <h1>Squads</h1>
                    <p>Join a squad, find a team, or lead your own clan.</p>
                </div>

                <div className="squads-tabs">
                    <button className={`squad-tab ${activeTab === 'find' ? 'active' : ''}`} onClick={() => setActiveTab('find')}>Find Squads</button>
                    <button className={`squad-tab ${activeTab === 'my' ? 'active' : ''}`} onClick={() => setActiveTab('my')}>My Squads</button>
                    <button className={`squad-tab ${activeTab === 'recruit' ? 'active' : ''}`} onClick={() => setActiveTab('recruit')}>Recruitment</button>
                </div>

                {activeTab === 'find' && (
                    <div className="squads-grid">
                        <div className="create-squad-card" onClick={() => {
                            setEditingSquad(null);
                            setNewSquadName('');
                            setNewSquadTag('General');
                            setIsPrivate(false);
                            setShowCreateModal(true);
                        }}>
                            <div className="plus-icon">+</div>
                            <h3>Create New Squad</h3>
                        </div>
                        {squads.map(squad => (
                            <div key={squad.id} className="squad-card">
                                <h3>{squad.name}</h3>
                                <span className="squad-tag">{squad.tag}</span>
                                {squad.isPrivate && <span className="private-badge">Private</span>}
                                <div className="card-actions">
                                    <button className="join-btn" onClick={() => joinSquad(squad)}>Join</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'my' && (
                    <div className="squads-grid">
                        {squads.filter(s => s.members && user && s.members[user.uid]).map(squad => (
                            <div key={squad.id} className="squad-card my-squad" onClick={() => setSelectedSquad(squad)}>
                                <h3>{squad.name}</h3>
                                <span className="squad-tag">{squad.tag}</span>
                                <div className="member-count">
                                    {Object.keys(squad.members || {}).length} Members
                                </div>
                                <div className="card-actions">
                                    <button className="enter-btn" onClick={(e) => { e.stopPropagation(); setSelectedSquad(squad); }}>Enter Squad HQ</button>
                                    {squad.createdBy === user.uid && (
                                        <div className="manage-actions">
                                            <button className="edit-btn" onClick={(e) => { e.stopPropagation(); handleEditSquadClick(squad); }}>✎</button>
                                            <button className="delete-btn" onClick={(e) => { e.stopPropagation(); handleDeleteSquad(squad); }}>🗑</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {squads.filter(s => s.members && user && s.members[user.uid]).length === 0 && (
                            <p className="no-data-text">You haven't joined any squads yet.</p>
                        )}
                    </div>
                )}

                {activeTab === 'recruit' && (
                    <div className="recruit-container">
                        <div className="recruit-header">
                            <h3>Find Teammates for Hackathons & CTFs</h3>
                            <button className="create-post-btn" onClick={() => {
                                setEditingRecruitPost(null);
                                setRecruitTitle('');
                                setRecruitTags('');
                                setRecruitDesc('');
                                setShowRecruitModal(true);
                            }}>Post Opportunity</button>
                        </div>
                        <div className="recruit-list">
                            {recruitPosts.map(post => (
                                <div key={post.id} className="recruit-card">
                                    <div className="recruit-card-header">
                                        <h3>{post.title}</h3>
                                        <span className="recruit-status">{post.status}</span>
                                    </div>
                                    <p className="recruit-desc">{post.description}</p>
                                    <div className="tags">
                                        {post.tags && post.tags.map((tag, i) => <span key={i} className="tag">{tag}</span>)}
                                    </div>
                                    <div className="recruit-footer">
                                        <span>Posted by: {post.author}</span>
                                        <div className="recruit-actions">
                                            {user && post.authorId === user.uid && (
                                                <>
                                                    <button className="edit-btn-mini" onClick={() => handleEditRecruitClick(post)}>Edit</button>
                                                    <button className="delete-btn-mini" onClick={() => handleDeleteRecruitPost(post)}>Delete</button>
                                                </>
                                            )}
                                            <button className="apply-btn">Message</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </>
        )}

        {/* Create Squad Modal */}
        {showCreateModal && (
            <div className="modal-overlay">
                <div className="modal-content">
                    <h2>Create a Squad</h2>
                    <input 
                        type="text" 
                        placeholder="Squad Name" 
                        value={newSquadName} 
                        onChange={(e) => setNewSquadName(e.target.value)} 
                    />
                    <select value={newSquadTag} onChange={(e) => setNewSquadTag(e.target.value)}>
                        <option value="General">General</option>
                        <option value="Python Devs">Python Devs</option>
                        <option value="White Hat Hackers">White Hat Hackers</option>
                        <option value="UI/UX Designers">UI/UX Designers</option>
                        <option value="CTF Team">CTF Team</option>
                    </select>
                    <label>
                        <input 
                            type="checkbox" 
                            checked={isPrivate} 
                            onChange={(e) => setIsPrivate(e.target.checked)} 
                        />
                        Private (Invite Only)
                    </label>
                    <div className="modal-actions">
                        <button onClick={() => setShowCreateModal(false)}>Cancel</button>
                        <button onClick={handleCreateSquad}>Create</button>
                    </div>
                </div>
            </div>
        )}

        {/* Create Recruit Post Modal */}
        {showRecruitModal && (
            <div className="modal-overlay">
                <div className="modal-content">
                    <h2>{editingRecruitPost ? 'Edit Post' : 'Create Recruitment Post'}</h2>
                    <form onSubmit={handleCreateRecruitPost}>
                        <input 
                            type="text" 
                            placeholder="Title (e.g. Looking for Frontend Dev)" 
                            value={recruitTitle}
                            onChange={(e) => setRecruitTitle(e.target.value)}
                            required
                        />
                        <input 
                            type="text" 
                            placeholder="Tags (e.g. React, CTF, Hackathon)" 
                            value={recruitTags}
                            onChange={(e) => setRecruitTags(e.target.value)}
                        />
                        <textarea 
                            placeholder="Description..." 
                            value={recruitDesc}
                            onChange={(e) => setRecruitDesc(e.target.value)}
                            rows="4"
                        />
                        <div className="modal-actions">
                            <button type="button" className="cancel-btn" onClick={() => setShowRecruitModal(false)}>Cancel</button>
                            <button type="submit" className="create-btn">{editingRecruitPost ? 'Save' : 'Post'}</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
    </div>
  );
};

export default Squads;
