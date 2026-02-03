import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import GeminiService from '../services/GeminiService';
import './Chirpy.css';
import '../components/Cappies.css'; // For shared sidebar styles if any

const Chirpy = () => {
  const [geminiService] = useState(() => new GeminiService());
  const navigate = useNavigate();
  
  // Session Management State
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem('chirpy_sessions');
    return saved ? JSON.parse(saved) : [{ id: 'default', title: 'New Chat', messages: [], timestamp: Date.now() }];
  });
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const saved = localStorage.getItem('chirpy_active_session');
    return saved || 'default';
  });
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  // Derived State
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messages = activeSession.messages;

  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('chirpy_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('chirpy_active_session', activeSessionId);
    // Sync Gemini Service History when switching
    if (activeSession) {
      const history = activeSession.messages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));
      geminiService.setHistory(history);
    }
  }, [activeSessionId, sessions, geminiService]); // Added sessions dependency to sync history on update

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Session Handlers
  const handleNewChat = () => {
    const newSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      timestamp: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    geminiService.clearHistory();
  };

  const handleDeleteSession = (e, id) => {
    e.stopPropagation();
    if (sessions.length === 1) {
      // Reset if it's the last one
      setSessions([{ id: 'default', title: 'New Chat', messages: [], timestamp: Date.now() }]);
      setActiveSessionId('default');
      geminiService.clearHistory();
      return;
    }
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (activeSessionId === id) {
      setActiveSessionId(newSessions[0].id);
    }
  };

  const startEditing = (e, session) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const saveTitle = (e) => {
    e.stopPropagation();
    if (editingSessionId) {
      setSessions(prev => prev.map(s => 
        s.id === editingSessionId ? { ...s, title: editTitle } : s
      ));
      setEditingSessionId(null);
    }
  };

  const handleKeyDownTitle = (e) => {
    if (e.key === 'Enter') saveTitle(e);
    if (e.key === 'Escape') setEditingSessionId(null);
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isTyping) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // Optimistic UI Update
    const newUserMsg = { role: 'user', text: userMessage };
    
    // Update Session State immediately
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        // Auto-rename new chats based on first message
        const newTitle = s.messages.length === 0 ? userMessage.slice(0, 30) : s.title;
        return { 
          ...s, 
          messages: [...s.messages, newUserMsg],
          title: newTitle
        };
      }
      return s;
    }));

    setIsTyping(true);
    setError(null);

    try {
      let currentResponse = "";
      // Placeholder for streaming
      // We don't add the model message to session state yet to avoid saving empty state
      // Instead we use a local "streaming" state or just rely on the effect below updating properly
      
      const wrappedMessage = `Answer using the OUTPUT RULES. Keep it short and chat-friendly.\n\nUser question: ${userMessage}`;

      await geminiService.streamMessage(wrappedMessage, (chunk) => {
        currentResponse += chunk;
        // Live update the active session with the streaming response
        setSessions(prev => prev.map(s => {
          if (s.id === activeSessionId) {
            const lastMsg = s.messages[s.messages.length - 1];
            if (lastMsg.role === 'model') {
               // Update existing model message
               const updatedMessages = [...s.messages];
               updatedMessages[updatedMessages.length - 1] = { ...lastMsg, text: currentResponse };
               return { ...s, messages: updatedMessages };
            } else {
               // Add new model message
               return { ...s, messages: [...s.messages, { role: 'model', text: currentResponse }] };
            }
          }
          return s;
        }));
      });
    } catch (err) {
      console.error("Chat error:", err);
      setError("Failed to get response. Please try again.");
    } finally {
      setIsTyping(false);
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

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
    { label: 'CHIRPY', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> },
    { label: 'Squads', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> },
    { label: 'Play', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"></rect><path d="M6 12h4m-2-2v4M15 11h.01M18 13h.01"></path></svg> },
    { label: 'Settings', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> },
  ];

  return (
    <div className="chirpy-container">
      {/* Left Sidebar (Nav) */}
      <aside className="sidebar">
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <div 
              key={item.label}
              className={`sidebar-item ${item.label === 'CHIRPY' ? 'active' : ''}`}
              onClick={() => {
                if (item.label === 'CapyHome') navigate('/home');
                else if (item.label === 'Squads') navigate('/squads');
                else if (item.label === 'CHIRPY') navigate('/chirpy');
                else navigate(`/${item.label.toLowerCase()}`);
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Chat Area */}
      <main className="chirpy-content">
        <header className="chirpy-header">
          <h1>CHIRPY AI</h1>
          <p>Your expert on Cyber Tech & Digital Topics</p>
        </header>

        <div className="chat-scroll-area">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </div>
              <h2>How can I help you today?</h2>
              <p>Ask me about cybersecurity, coding, or the latest tech trends.</p>
            </div>
          ) : (
            <div className="messages-list">
              {messages.map((msg, index) => (
                <div key={index} className={`message-row ${msg.role}`}>
                   <div className="message-avatar">
                     {msg.role === 'user' ? (
                       <div className="user-avatar-placeholder">You</div>
                     ) : (
                       <div className="ai-avatar-placeholder">AI</div>
                     )}
                   </div>
                   <div className="message-bubble">
                     {msg.role === 'model' ? (
                       <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                     ) : (
                       msg.text
                     )}
                   </div>
                </div>
              ))}
              {isTyping && (
                <div className="message-row model typing">
                   <div className="message-avatar">
                     <div className="ai-avatar-placeholder">AI</div>
                   </div>
                   <div className="message-bubble typing-bubble">
                     <div className="typing-indicator"><span></span><span></span><span></span></div>
                   </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="input-container">
          {error && <div className="error-banner">{error}</div>}
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Message Chirpy..."
              disabled={isTyping}
              rows={1}
            />
            <button 
              className="chat-send-btn"
              onClick={handleSendMessage} 
              disabled={!inputValue.trim() || isTyping} 
              aria-label="Send message"
            >
              ➤
            </button>
          </div>
          <div className="input-footer">
            Chirpy can make mistakes. Consider checking important information.
          </div>
        </div>
      </main>

      {/* Right Sidebar (History) */}
      <aside className="history-sidebar">
        <div className="history-header">
           <button className="new-chat-btn" onClick={handleNewChat}>
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
             New Chat
           </button>
        </div>
        <div className="history-list">
           <div className="history-label">Your Chats</div>
           {sessions.map(session => (
             <div 
               key={session.id} 
               className={`history-item ${activeSessionId === session.id ? 'active' : ''}`}
               onClick={() => setActiveSessionId(session.id)}
             >
               <svg className="chat-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
               
               {editingSessionId === session.id ? (
                 <input 
                   autoFocus
                   type="text" 
                   value={editTitle} 
                   onChange={(e) => setEditTitle(e.target.value)}
                   onBlur={saveTitle}
                   onKeyDown={handleKeyDownTitle}
                   onClick={(e) => e.stopPropagation()}
                   className="rename-input"
                 />
               ) : (
                 <span className="history-title" onDoubleClick={(e) => startEditing(e, session)}>
                   {session.title}
                 </span>
               )}

               <div className="history-actions">
                <button className="icon-btn" onClick={(e) => startEditing(e, session)} title="Rename">
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button className="icon-btn delete" onClick={(e) => handleDeleteSession(e, session.id)} title="Delete">
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
               </div>
             </div>
           ))}
        </div>
      </aside>
    </div>
  );
};

export default Chirpy;
