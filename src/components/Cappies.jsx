import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getDatabase, ref, onValue, push, set, update, remove, query, orderByChild, startAt, endAt, get, serverTimestamp, limitToLast } from 'firebase/database';
import { auth } from '../firebase';
import './Cappies.css';
import CapyModal from './CapyModal';
import InitialsAvatar from './InitialsAvatar';
import MiniProfileCard from './MiniProfileCard';
import { uploadToImgBB } from '../utils/imgbb';

const ChatFriendItem = ({ uid, isActive, onClick, currentUser }) => {
  const [profile, setProfile] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const db = getDatabase();

  useEffect(() => {
    const userRef = ref(db, `users/${uid}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setProfile(data);
      }
    });
    return () => unsubscribe();
  }, [uid, db]);

  useEffect(() => {
    if (!currentUser || !uid) return;
    const chatId = [currentUser.uid, uid].sort().join('_');
    const messagesRef = query(ref(db, `chats/${chatId}/messages`), limitToLast(1));
    
    const unsub = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const key = Object.keys(data)[0];
        setLastMessage(data[key]);
      } else {
        setLastMessage(null);
      }
    });
    return () => unsub();
  }, [uid, currentUser, db]);

  const displayName = profile?.displayName || 'Unknown Capy';
  const photoURL = profile?.photoURL;

  const formatTimeShort = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getLastMessageText = (msg) => {
    if (msg.text) return msg.text;
    if (msg.image) return '📷 Image';
    if (msg.gif) return '👾 GIF';
    return 'Message';
  };

  return (
    <div 
      className={`chat-friend-item ${isActive ? 'active' : ''}`}
      onClick={() => onClick({ uid, ...profile })}
    >
      <div className="chat-friend-avatar-wrapper">
        {photoURL ? (
          <img 
            src={photoURL} 
            alt={displayName} 
            className="chat-avatar" 
          />
        ) : (
          <InitialsAvatar 
            name={displayName} 
            uid={uid} 
            className="chat-avatar"
            size={40}
            fontSize="16px"
          />
        )}
        {/* Status Indicator (Green for now as requested) */}
        <div className="chat-friend-status-dot online"></div>
      </div>
      <div className="chat-friend-info">
        <div className="chat-friend-header">
           <span className="chat-friend-name">{displayName}</span>
           {lastMessage && (
             <span className="chat-friend-time">{formatTimeShort(lastMessage.timestamp)}</span>
           )}
        </div>
        <div className="chat-friend-preview">
          {lastMessage ? (
            <span className="last-message-text">
              {lastMessage.senderId === currentUser.uid ? 'You: ' : ''}{getLastMessageText(lastMessage)}
            </span>
          ) : (
            <span className="last-message-text empty">No messages yet</span>
          )}
        </div>
      </div>
    </div>
  );
};

const Cappies = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('friends'); // friends, requests, find
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  // Chat State
  const [activeChat, setActiveChat] = useState(null); // The friend object we are chatting with
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const gifPickerRef = useRef(null);

  // New Chat Feature States
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [gifSearchQuery, setGifSearchQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [emojis, setEmojis] = useState([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  const [loadingEmojis, setLoadingEmojis] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [linkPreviewData, setLinkPreviewData] = useState(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [reactionTargetMessageId, setReactionTargetMessageId] = useState(null);

  // Quick Reactions Customization State
  const DEFAULT_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'];
  const [quickReactions, setQuickReactions] = useState(() => {
    const saved = localStorage.getItem('capy_quick_reactions');
    return saved ? JSON.parse(saved) : DEFAULT_REACTIONS;
  });
  const [showCustomizeReactions, setShowCustomizeReactions] = useState(false);
  const [tempReactions, setTempReactions] = useState([]);
  const [editingReactionSlot, setEditingReactionSlot] = useState(null);


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
  
  // Handle tab selection from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'requests') {
      setActiveTab('requests');
    }
  }, [location.search]);

  const db = getDatabase();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Listen for friends
        const friendsRef = ref(db, `users/${currentUser.uid}/friends`);
        onValue(friendsRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            // Just store the list of friend UIDs
            const friendList = Object.keys(data).map(uid => ({ uid }));
            setFriends(friendList);
          } else {
            setFriends([]);
          }
        });

        // Listen for requests
        const requestsRef = ref(db, `users/${currentUser.uid}/friendRequests`);
        onValue(requestsRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
             const reqPromises = Object.keys(data).map(async (senderId) => {
              const userSnapshot = await get(ref(db, `users/${senderId}`));
              return { uid: senderId, ...userSnapshot.val() };
            });
            Promise.all(reqPromises).then(setRequests);
          } else {
            setRequests([]);
          }
        });
      } else {
        setUser(null);
        setFriends([]);
        setRequests([]);
      }
    });

    return () => unsubscribe();
  }, [db]);

  // Chat Logic
  useEffect(() => {
    if (!user || !activeChat) {
      setMessages([]);
      return;
    }

    const chatId = [user.uid, activeChat.uid].sort().join('_');
    const messagesRef = query(ref(db, `chats/${chatId}/messages`), limitToLast(50));

    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setMessages(msgList);
      } else {
        setMessages([]);
      }
    });

    return () => unsubscribe();
  }, [user, activeChat, db]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current && messagesEndRef.current.parentElement) {
      const container = messagesEndRef.current.parentElement;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages]);

  // Clear active chat if friend is removed
  useEffect(() => {
    if (activeChat && !friends.find(f => f.uid === activeChat.uid)) {
      setActiveChat(null);
    }
  }, [friends, activeChat]);

  // --- New Features Logic ---

  // Helper to extract URL
  const extractUrl = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text && text.match(urlRegex);
    return matches ? matches[0] : null;
  };

  // Generate Link Preview Effect
  useEffect(() => {
    const url = extractUrl(newMessage);
    if (!url) {
      setLinkPreviewData(null);
      return;
    }

    setIsGeneratingPreview(true);
    let isMounted = true;

    const generatePreview = async () => {
      let hostname;
      try {
        hostname = new URL(url).hostname;
      } catch (e) {
        hostname = 'Unknown Source';
      }

      const updatePreview = (data) => {
        if (isMounted) {
          setLinkPreviewData(data);
          setIsGeneratingPreview(false);
        }
      };

      // 1. Check for Special Handlers
      if (url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
        updatePreview({
            url: url,
            title: 'Image Preview',
            description: 'Click to view full image',
            image: url,
            type: 'image',
            source: 'Image'
        });
        return;
      }

      // YouTube
      const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
      if (ytMatch) {
        updatePreview({
            url: url,
            type: 'video',
            source: 'YouTube',
            videoId: ytMatch[1],
            title: 'YouTube Video', 
            description: 'Watch this video on Chirp',
            image: `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`,
            embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`
        });
        return;
      }
      
      // Generic Sites - Fetch Metadata using Microlink API
      try {
        const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
        const result = await response.json();

        if (result.status === 'success') {
          const { title, description, image, logo, publisher } = result.data;
          updatePreview({
            url: url,
            title: title || hostname,
            description: description || `Visit ${hostname} to see more.`,
            image: image?.url || logo?.url || `https://www.google.com/s2/favicons?domain=${hostname}&sz=256`,
            type: 'link',
            source: publisher || hostname
          });
        } else {
            throw new Error('Microlink failed');
        }
      } catch (error) {
        // Fallback
        updatePreview({
            url: url,
            title: hostname,
            description: `Visit ${hostname} to see more.`,
            image: `https://www.google.com/s2/favicons?domain=${hostname}&sz=256`,
            type: 'link',
            source: hostname
        });
      } finally {
        if (isMounted) setIsGeneratingPreview(false);
      }
    };

    const timer = setTimeout(() => {
        generatePreview();
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [newMessage]);

  // Fetch GIFs
  const fetchGifs = async (query = '') => {
    setLoadingGifs(true);
    try {
      const apiKey = 'LIVDSRZULELA'; // Public test key
      const url = query 
        ? `https://g.tenor.com/v1/search?q=${query}&key=${apiKey}&limit=20`
        : `https://g.tenor.com/v1/trending?key=${apiKey}&limit=20`;
      
      const res = await fetch(url);
      const data = await res.json();
      setGifs(data.results || []);
    } catch (error) {
      console.error("Error fetching GIFs:", error);
    } finally {
      setLoadingGifs(false);
    }
  };

  useEffect(() => {
    if (showGifPicker) {
      fetchGifs(gifSearchQuery);
    }
  }, [showGifPicker, gifSearchQuery]);

  // Fetch Emojis
  const fetchEmojis = async () => {
    if (emojis.length > 0) return;
    setLoadingEmojis(true);
    try {
      const res = await fetch('https://api.emojisworld.fr/v1/popular?limit=100');
      const data = await res.json();
      if (data.results) {
        setEmojis(data.results);
      } else {
         throw new Error("API No results");
      }
    } catch (error) {
       console.warn("Emoji API failed, using fallback");
       setEmojis([
         // Smileys & People
         { emoji: '😀' }, { emoji: '😃' }, { emoji: '😄' }, { emoji: '😁' }, { emoji: '😆' }, { emoji: '😅' }, { emoji: '😂' }, { emoji: '🤣' }, { emoji: '🥲' }, { emoji: '🥹' },
         { emoji: '😊' }, { emoji: '😇' }, { emoji: '🙂' }, { emoji: '🙃' }, { emoji: '😉' }, { emoji: '😌' }, { emoji: '😍' }, { emoji: '🥰' }, { emoji: '😘' }, { emoji: '😗' },
         { emoji: '😙' }, { emoji: '😚' }, { emoji: '😋' }, { emoji: '😛' }, { emoji: '😝' }, { emoji: '😜' }, { emoji: '🤪' }, { emoji: '🤨' }, { emoji: '🧐' }, { emoji: '🤓' },
         { emoji: '😎' }, { emoji: '🥸' }, { emoji: '🤩' }, { emoji: '🥳' }, { emoji: '😏' }, { emoji: '😒' }, { emoji: '😞' }, { emoji: '😔' }, { emoji: '😟' }, { emoji: '😕' },
         { emoji: '🙁' }, { emoji: '☹️' }, { emoji: '😣' }, { emoji: '😖' }, { emoji: '😫' }, { emoji: '😩' }, { emoji: '🥺' }, { emoji: '😢' }, { emoji: '😭' }, { emoji: '😤' },
         { emoji: '😠' }, { emoji: '😡' }, { emoji: '🤬' }, { emoji: '🤯' }, { emoji: '😳' }, { emoji: '🥵' }, { emoji: '🥶' }, { emoji: '😱' }, { emoji: '😨' }, { emoji: '😰' },
         { emoji: '😥' }, { emoji: '😓' }, { emoji: '🤗' }, { emoji: '🤔' }, { emoji: '🫣' }, { emoji: '🤭' }, { emoji: '🫢' }, { emoji: '🫡' }, { emoji: '🤫' }, { emoji: '🫠' },
         { emoji: '🤥' }, { emoji: '😶' }, { emoji: '🫥' }, { emoji: '😐' }, { emoji: '😑' }, { emoji: '😬' }, { emoji: '🙄' }, { emoji: '😯' }, { emoji: '😦' }, { emoji: '😧' },
         { emoji: '😮' }, { emoji: '😲' }, { emoji: '🥱' }, { emoji: '😴' }, { emoji: '🤤' }, { emoji: '😪' }, { emoji: '😵' }, { emoji: '😵‍💫' }, { emoji: '🤐' }, { emoji: '🥴' },
         { emoji: '🤢' }, { emoji: '🤮' }, { emoji: '🤧' }, { emoji: '😷' }, { emoji: '🤒' }, { emoji: '🤕' }, { emoji: '🤑' }, { emoji: '🤠' }, { emoji: '😈' }, { emoji: '👿' },
         { emoji: '👹' }, { emoji: '👺' }, { emoji: '🤡' }, { emoji: '💩' }, { emoji: '👻' }, { emoji: '💀' }, { emoji: '☠️' }, { emoji: '👽' }, { emoji: '👾' }, { emoji: '🤖' },
         { emoji: '👋' }, { emoji: '🤚' }, { emoji: '🖐️' }, { emoji: '✋' }, { emoji: '🖖' }, { emoji: '🫱' }, { emoji: '🫲' }, { emoji: '🫳' }, { emoji: '🫴' }, { emoji: '👌' },
         { emoji: '🤌' }, { emoji: '🤏' }, { emoji: '✌️' }, { emoji: '🤞' }, { emoji: '🫰' }, { emoji: '🤟' }, { emoji: '🤘' }, { emoji: '🤙' }, { emoji: '👈' }, { emoji: '👉' },
         { emoji: '👆' }, { emoji: '🖕' }, { emoji: '👇' }, { emoji: '☝️' }, { emoji: '👍' }, { emoji: '👎' }, { emoji: '✊' }, { emoji: '👊' }, { emoji: '🤛' }, { emoji: '🤜' },
         { emoji: '👏' }, { emoji: '🙌' }, { emoji: '👐' }, { emoji: '🤲' }, { emoji: '🤝' }, { emoji: '🙏' }, { emoji: '✍️' }, { emoji: '💅' }, { emoji: '🤳' }, { emoji: '💪' },
         // Animals & Nature
         { emoji: '🐶' }, { emoji: '🐱' }, { emoji: '🐭' }, { emoji: '🐹' }, { emoji: '🐰' }, { emoji: '🦊' }, { emoji: '🐻' }, { emoji: '🐼' }, { emoji: '🐻‍❄️' }, { emoji: '🐨' },
         { emoji: '🐯' }, { emoji: '🦁' }, { emoji: '🐮' }, { emoji: '🐷' }, { emoji: '🐽' }, { emoji: '🐸' }, { emoji: '🐵' }, { emoji: '🙈' }, { emoji: '🙉' }, { emoji: '🙊' },
         { emoji: '🐒' }, { emoji: '🐔' }, { emoji: '🐧' }, { emoji: '🐦' }, { emoji: '🐤' }, { emoji: '🐣' }, { emoji: '🐥' }, { emoji: '🦆' }, { emoji: '🦅' }, { emoji: '🦉' },
         { emoji: '🦇' }, { emoji: '🐺' }, { emoji: '🐗' }, { emoji: '🐴' }, { emoji: '🦄' }, { emoji: '🐝' }, { emoji: '🪱' }, { emoji: '🐛' }, { emoji: '🦋' }, { emoji: '🐌' },
         { emoji: '🐞' }, { emoji: '🐜' }, { emoji: '🪰' }, { emoji: '🪲' }, { emoji: '🪳' }, { emoji: '🦟' }, { emoji: '🦗' }, { emoji: '🕷️' }, { emoji: '🕸️' }, { emoji: '🦂' },
         { emoji: '🐢' }, { emoji: '🐍' }, { emoji: '🦎' }, { emoji: '🦖' }, { emoji: '🦕' }, { emoji: '🐙' }, { emoji: '🦑' }, { emoji: '🦐' }, { emoji: '🦞' }, { emoji: '🦀' },
         { emoji: '🐡' }, { emoji: '🐠' }, { emoji: '🐟' }, { emoji: '🐬' }, { emoji: '🐳' }, { emoji: '🐋' }, { emoji: '🦈' }, { emoji: '🦭' }, { emoji: '🐊' }, { emoji: '🐅' },
         { emoji: '🐆' }, { emoji: '🦓' }, { emoji: '🦍' }, { emoji: '🦧' }, { emoji: '🦣' }, { emoji: '🐘' }, { emoji: '🦛' }, { emoji: '🦏' }, { emoji: '🐪' }, { emoji: '🐫' },
         { emoji: '🦒' }, { emoji: '🦘' }, { emoji: '🦬' }, { emoji: '🐃' }, { emoji: '🐂' }, { emoji: '🐄' }, { emoji: '🐎' }, { emoji: '🐖' }, { emoji: '🐏' }, { emoji: '🐑' },
         { emoji: '🐐' }, { emoji: '🦌' }, { emoji: '🐕' }, { emoji: '🐩' }, { emoji: '🦮' }, { emoji: '🐕‍🦺' }, { emoji: '🐈' }, { emoji: '🐈‍⬛' }, { emoji: '🐓' }, { emoji: '🦃' },
         { emoji: '🦚' }, { emoji: '🦜' }, { emoji: '🦢' }, { emoji: '🦩' }, { emoji: '🕊️' }, { emoji: '🐇' }, { emoji: '🦝' }, { emoji: '🦨' }, { emoji: '🦡' }, { emoji: '🦫' },
         { emoji: '🦦' }, { emoji: '🦥' }, { emoji: '🐁' }, { emoji: '🐀' }, { emoji: '🐿️' }, { emoji: '🦔' }, { emoji: '🐾' }, { emoji: '🐉' }, { emoji: '🐲' }, { emoji: '🌵' },
         { emoji: '🎄' }, { emoji: '🌲' }, { emoji: '🌳' }, { emoji: '🌴' }, { emoji: '🪵' }, { emoji: '🌱' }, { emoji: '🌿' }, { emoji: '☘️' }, { emoji: '🍀' }, { emoji: '🎍' },
         { emoji: '🪴' }, { emoji: '🎋' }, { emoji: '🍃' }, { emoji: '🍂' }, { emoji: '🍁' }, { emoji: '🍄' }, { emoji: '🐚' }, { emoji: '🪨' }, { emoji: '🌾' }, { emoji: '💐' },
         { emoji: '🌷' }, { emoji: '🌹' }, { emoji: '🥀' }, { emoji: '🌺' }, { emoji: '🌸' }, { emoji: '🌼' }, { emoji: '🌻' }, { emoji: '🌞' }, { emoji: '🌝' }, { emoji: '🌛' },
         { emoji: '🌜' }, { emoji: '🌚' }, { emoji: '🌕' }, { emoji: '🌖' }, { emoji: '🌗' }, { emoji: '🌘' }, { emoji: '🌑' }, { emoji: '🌒' }, { emoji: '🌓' }, { emoji: '🌔' },
         { emoji: '🌙' }, { emoji: '🌎' }, { emoji: '🌍' }, { emoji: '🌏' }, { emoji: '🪐' }, { emoji: '💫' }, { emoji: '⭐' }, { emoji: '🌟' }, { emoji: '✨' }, { emoji: '⚡' },
         { emoji: '☄️' }, { emoji: '💥' }, { emoji: '🔥' }, { emoji: '🌪️' }, { emoji: '🌈' }, { emoji: '☀️' }, { emoji: '🌤️' }, { emoji: '⛅' }, { emoji: '🌥️' }, { emoji: '☁️' },
         { emoji: '🌦️' }, { emoji: '🌧️' }, { emoji: '⛈️' }, { emoji: '🌩️' }, { emoji: '🌨️' }, { emoji: '❄️' }, { emoji: '☃️' }, { emoji: '⛄' }, { emoji: '🌬️' }, { emoji: '💨' },
         { emoji: '💧' }, { emoji: '💦' }, { emoji: '🫧' }, { emoji: '☔' }, { emoji: '☂️' }, { emoji: '🌊' },
         // Food & Drink
         { emoji: '🍏' }, { emoji: '🍎' }, { emoji: '🍐' }, { emoji: '🍊' }, { emoji: '🍋' }, { emoji: '🍌' }, { emoji: '🍉' }, { emoji: '🍇' }, { emoji: '🍓' }, { emoji: '🫐' },
         { emoji: '🍈' }, { emoji: '🍒' }, { emoji: '🍑' }, { emoji: '🥭' }, { emoji: '🍍' }, { emoji: '🥥' }, { emoji: '🥝' }, { emoji: '🍅' }, { emoji: '🍆' }, { emoji: '🥑' },
         { emoji: '🥦' }, { emoji: '🥬' }, { emoji: '🥒' }, { emoji: '🌶️' }, { emoji: '🫑' }, { emoji: '🌽' }, { emoji: '🥕' }, { emoji: '🫒' }, { emoji: '🧄' }, { emoji: '🧅' },
         { emoji: '🥔' }, { emoji: '🍠' }, { emoji: '🥐' }, { emoji: '🥯' }, { emoji: '🍞' }, { emoji: '🥖' }, { emoji: '🥨' }, { emoji: '🧀' }, { emoji: '🥚' }, { emoji: '🍳' },
         { emoji: '🧈' }, { emoji: '🥞' }, { emoji: '🧇' }, { emoji: '🥓' }, { emoji: '🥩' }, { emoji: '🍗' }, { emoji: '🍖' }, { emoji: '🦴' }, { emoji: '🌭' }, { emoji: '🍔' },
         { emoji: '🍟' }, { emoji: '🍕' }, { emoji: '🫓' }, { emoji: '🥪' }, { emoji: '🥙' }, { emoji: '🧆' }, { emoji: '🌮' }, { emoji: '🌯' }, { emoji: '🫔' }, { emoji: '🥗' },
         { emoji: '🥘' }, { emoji: '🫕' }, { emoji: '🥫' }, { emoji: '🍝' }, { emoji: '🍜' }, { emoji: '🍲' }, { emoji: '🍛' }, { emoji: '🍣' }, { emoji: '🍱' }, { emoji: '🥟' },
         { emoji: '🦪' }, { emoji: '🍤' }, { emoji: '🍙' }, { emoji: '🍚' }, { emoji: '🍘' }, { emoji: '🍥' }, { emoji: '🥠' }, { emoji: '🥮' }, { emoji: '🍢' }, { emoji: '🍡' },
         { emoji: '🍧' }, { emoji: '🍨' }, { emoji: '🍦' }, { emoji: '🥧' }, { emoji: '🧁' }, { emoji: '🍰' }, { emoji: '🎂' }, { emoji: '🍮' }, { emoji: '🍭' }, { emoji: '🍬' },
         { emoji: '🍫' }, { emoji: '🍿' }, { emoji: '🍩' }, { emoji: '🍪' }, { emoji: '🌰' }, { emoji: '🥜' }, { emoji: '🍯' }, { emoji: '🥛' }, { emoji: '🍼' }, { emoji: '☕' },
         { emoji: '🍵' }, { emoji: '🧃' }, { emoji: '🥤' }, { emoji: '🧋' }, { emoji: '🍶' }, { emoji: '🍺' }, { emoji: '🍻' }, { emoji: '🥂' }, { emoji: '🍷' }, { emoji: '🥃' },
         { emoji: '🍸' }, { emoji: '🍹' }, { emoji: '🧉' }, { emoji: '🍾' }, { emoji: '🧊' }, { emoji: '🥄' }, { emoji: '🍴' }, { emoji: '🍽️' }, { emoji: '🥣' }, { emoji: '🥡' },
         { emoji: '🥢' }, { emoji: '🧂' },
         // Activities & Objects
         { emoji: '⚽' }, { emoji: '🏀' }, { emoji: '🏈' }, { emoji: '⚾' }, { emoji: '🥎' }, { emoji: '🎾' }, { emoji: '🏐' }, { emoji: '🏉' }, { emoji: '🥏' }, { emoji: '🎱' },
         { emoji: '🪀' }, { emoji: '🏓' }, { emoji: '🏸' }, { emoji: '🏒' }, { emoji: '🏑' }, { emoji: '🥍' }, { emoji: '🏏' }, { emoji: '🪃' }, { emoji: '🥅' }, { emoji: '⛳' },
         { emoji: '🪁' }, { emoji: '🏹' }, { emoji: '🎣' }, { emoji: '🤿' }, { emoji: '🥊' }, { emoji: '🥋' }, { emoji: '🎽' }, { emoji: '🛹' }, { emoji: '🛼' }, { emoji: '🛷' },
         { emoji: '⛸️' }, { emoji: '🥌' }, { emoji: '🎿' }, { emoji: '⛷️' }, { emoji: '🏂' }, { emoji: '🪂' }, { emoji: '🏋️' }, { emoji: '🤼' }, { emoji: '🤸' }, { emoji: '⛹️' },
         { emoji: '🤺' }, { emoji: '🤾' }, { emoji: '🏌️' }, { emoji: '🏇' }, { emoji: '🧘' }, { emoji: '🏄' }, { emoji: '🏊' }, { emoji: '🤽' }, { emoji: '🚣' }, { emoji: '🧗' },
         { emoji: '🚵' }, { emoji: '🚴' }, { emoji: '🏆' }, { emoji: '🥇' }, { emoji: '🥈' }, { emoji: '🥉' }, { emoji: '🏅' }, { emoji: '🎖️' }, { emoji: '🏵️' }, { emoji: '🎗️' },
         { emoji: '🎫' }, { emoji: '🎟️' }, { emoji: '🎪' }, { emoji: '🤹' }, { emoji: '🎭' }, { emoji: '🩰' }, { emoji: '🎨' }, { emoji: '🎬' }, { emoji: '🎤' }, { emoji: '🎧' },
         { emoji: '🎼' }, { emoji: '🎹' }, { emoji: '🥁' }, { emoji: '🪘' }, { emoji: '🎷' }, { emoji: '🎺' }, { emoji: '🪗' }, { emoji: '🎸' }, { emoji: '🪕' }, { emoji: '🎻' },
         { emoji: '🎲' }, { emoji: '♟️' }, { emoji: '🎯' }, { emoji: '🎳' }, { emoji: '🎮' }, { emoji: '🎰' }, { emoji: '🧩' }, { emoji: '🚀' }, { emoji: '🛸' }, { emoji: '⚓' },
         { emoji: '💍' }, { emoji: '💎' }, { emoji: '👓' }, { emoji: '🕶️' }, { emoji: '🥽' }, { emoji: '🥼' }, { emoji: '🦺' }, { emoji: '👔' }, { emoji: '👕' }, { emoji: '👖' },
         { emoji: '🧣' }, { emoji: '🧤' }, { emoji: '🧥' }, { emoji: '🧦' }, { emoji: '👗' }, { emoji: '👘' }, { emoji: '🥻' }, { emoji: '🩱' }, { emoji: '🩲' }, { emoji: '🩳' },
         { emoji: '👙' }, { emoji: '👚' }, { emoji: '👛' }, { emoji: '👜' }, { emoji: '👝' }, { emoji: '🛍️' }, { emoji: '🎒' }, { emoji: '🩴' }, { emoji: '👞' }, { emoji: '👟' },
         { emoji: '🥾' }, { emoji: '🥿' }, { emoji: '👠' }, { emoji: '👡' }, { emoji: '🩰' }, { emoji: '👢' }, { emoji: '👑' }, { emoji: '👒' }, { emoji: '🎩' }, { emoji: '🎓' },
         { emoji: '🧢' }, { emoji: '🪖' }, { emoji: '⛑️' }, { emoji: '📿' }, { emoji: '💄' }, { emoji: '🩹' }, { emoji: '🩺' }, { emoji: '🩸' }, { emoji: '🦠' }, { emoji: '💊' },
         { emoji: '💉' }, { emoji: '🌡️' }, { emoji: '🔭' }, { emoji: '🔬' }, { emoji: '📡' }, { emoji: '💡' }, { emoji: '🔦' }, { emoji: '🕯️' }, { emoji: '🪔' }, { emoji: '🏮' },
         { emoji: '💣' }, { emoji: '🧨' }, { emoji: '🪓' }, { emoji: '🔪' }, { emoji: '🗡️' }, { emoji: '⚔️' }, { emoji: '🛡️' }, { emoji: '🔑' }, { emoji: '🗝️' }, { emoji: '🔐' },
         { emoji: '🔏' }, { emoji: '🔒' }, { emoji: '🔓' },
         // Symbols
         { emoji: '❤️' }, { emoji: '🧡' }, { emoji: '💛' }, { emoji: '💚' }, { emoji: '💙' }, { emoji: '💜' }, { emoji: '🖤' }, { emoji: '🤍' }, { emoji: '🤎' }, { emoji: '💔' },
         { emoji: '❣️' }, { emoji: '💕' }, { emoji: '💞' }, { emoji: '💓' }, { emoji: '💗' }, { emoji: '💖' }, { emoji: '💘' }, { emoji: '💝' }, { emoji: '💟' }, { emoji: '☮️' },
         { emoji: '✝️' }, { emoji: '☪️' }, { emoji: '🕉️' }, { emoji: '☸️' }, { emoji: '✡️' }, { emoji: '🔯' }, { emoji: '🕎' }, { emoji: '☯️' }, { emoji: '☦️' }, { emoji: '🛐' },
         { emoji: '⛎' }, { emoji: '♈' }, { emoji: '♉' }, { emoji: '♊' }, { emoji: '♋' }, { emoji: '♌' }, { emoji: '♍' }, { emoji: '♎' }, { emoji: '♏' }, { emoji: '♐' },
         { emoji: '♑' }, { emoji: '♒' }, { emoji: '♓' }, { emoji: '🆔' }, { emoji: '⚛️' }, { emoji: '🉑' }, { emoji: '☢️' }, { emoji: '☣️' }, { emoji: '📴' }, { emoji: '📳' },
         { emoji: '🈶' }, { emoji: '🈚' }, { emoji: '🈸' }, { emoji: '🈺' }, { emoji: '🈷️' }, { emoji: '✴️' }, { emoji: '🆚' }, { emoji: '💮' }, { emoji: '🉐' }, { emoji: '㊙️' },
         { emoji: '㊗️' }, { emoji: '🈴' }, { emoji: '🈵' }, { emoji: '🈹' }, { emoji: '🈲' }, { emoji: '🅰️' }, { emoji: '🅱️' }, { emoji: '🆎' }, { emoji: '🆑' }, { emoji: '🅾️' },
         { emoji: '🆘' }, { emoji: '❌' }, { emoji: '⭕' }, { emoji: '🛑' }, { emoji: '⛔' }, { emoji: '📛' }, { emoji: '🚫' }, { emoji: '💯' }, { emoji: '💢' }, { emoji: '♨️' },
         { emoji: '🚷' }, { emoji: '🚯' }, { emoji: '🚳' }, { emoji: '🚱' }, { emoji: '🔞' }, { emoji: '📵' }, { emoji: '🚭' }, { emoji: '❗' }, { emoji: '❕' }, { emoji: '❓' },
         { emoji: '❔' }, { emoji: '‼️' }, { emoji: '⁉️' }, { emoji: '🔅' }, { emoji: '🔆' }, { emoji: '〽️' }, { emoji: '⚠️' }, { emoji: '🚸' }, { emoji: '🔱' }, { emoji: '⚜️' },
         { emoji: '🔰' }, { emoji: '♻️' }, { emoji: '✅' }, { emoji: '🈯' }, { emoji: '💹' }, { emoji: '❇️' }, { emoji: '✳️' }, { emoji: '❎' }, { emoji: '🌐' }, { emoji: '💠' },
         { emoji: 'Ⓜ️' }, { emoji: '🌀' }, { emoji: '💤' }, { emoji: '🏧' }, { emoji: '🚾' }, { emoji: '♿' }, { emoji: '🅿️' }, { emoji: '🛗' }, { emoji: '🈳' }, { emoji: '🈂️' },
         { emoji: '🛂' }, { emoji: '🛃' }, { emoji: '🛄' }, { emoji: '🛅' }, { emoji: '🚹' }, { emoji: '🚺' }, { emoji: '🚼' }, { emoji: '🚻' }, { emoji: '🚮' }, { emoji: '🎦' },
         { emoji: '📶' }, { emoji: '🈁' }, { emoji: '🔣' }, { emoji: 'ℹ️' }, { emoji: '🔤' }, { emoji: '🔡' }, { emoji: '🔠' }, { emoji: '🆖' }, { emoji: '🆗' }, { emoji: '🆙' },
         { emoji: '🆒' }, { emoji: '🆕' }, { emoji: '🆓' }, { emoji: '0️⃣' }, { emoji: '1️⃣' }, { emoji: '2️⃣' }, { emoji: '3️⃣' }, { emoji: '4️⃣' }, { emoji: '5️⃣' }, { emoji: '6️⃣' },
         { emoji: '7️⃣' }, { emoji: '8️⃣' }, { emoji: '9️⃣' }, { emoji: '🔟' }, { emoji: '🔢' }, { emoji: '#️⃣' }, { emoji: '*️⃣' }, { emoji: '⏏️' }, { emoji: '▶️' }, { emoji: '⏸️' },
         { emoji: '⏯️' }, { emoji: '⏹️' }, { emoji: '⏺️' }, { emoji: '⏭️' }, { emoji: '⏮️' }, { emoji: '⏩' }, { emoji: '⏪' }, { emoji: '⏫' }, { emoji: '⏬' }, { emoji: '◀️' },
         { emoji: '🔼' }, { emoji: '🔽' }, { emoji: '➡️' }, { emoji: '⬅️' }, { emoji: '⬆️' }, { emoji: '⬇️' }, { emoji: '↗️' }, { emoji: '↘️' }, { emoji: '↙️' }, { emoji: '↖️' },
         { emoji: '↕️' }, { emoji: '↔️' }, { emoji: '↪️' }, { emoji: '↩️' }, { emoji: '⤴️' }, { emoji: '⤵️' }, { emoji: '🔀' }, { emoji: '🔁' }, { emoji: '🔂' }, { emoji: '🔄' },
         { emoji: '🔃' }, { emoji: '🎵' }, { emoji: '🎶' }, { emoji: '➕' }, { emoji: '➖' }, { emoji: '➗' }, { emoji: '✖️' }, { emoji: '♾️' }, { emoji: '💲' }, { emoji: '💱' },
         { emoji: '™️' }, { emoji: '©️' }, { emoji: '®️' }, { emoji: '〰️' }, { emoji: '➰' }, { emoji: '➿' }, { emoji: '🔚' }, { emoji: '🔙' }, { emoji: '🔛' }, { emoji: '🔝' },
         { emoji: '🔜' }, { emoji: '✔️' }, { emoji: '☑️' }, { emoji: '🔘' }, { emoji: '🔴' }, { emoji: '🟠' }, { emoji: '🟡' }, { emoji: '🟢' }, { emoji: '🔵' }, { emoji: '🟣' },
         { emoji: '⚫' }, { emoji: '⚪' }, { emoji: '🟤' }, { emoji: '🔺' }, { emoji: '🔻' }, { emoji: '🔸' }, { emoji: '🔹' }, { emoji: '🔶' }, { emoji: '🔷' }, { emoji: '🔳' },
         { emoji: '🔲' }, { emoji: '▪️' }, { emoji: '▫️' }, { emoji: '◾' }, { emoji: '◽' }, { emoji: '◼️' }, { emoji: '◻️' }, { emoji: '🟥' }, { emoji: '🟧' }, { emoji: '🟨' },
         { emoji: '🟩' }, { emoji: '🟦' }, { emoji: '🟪' }, { emoji: '⬛' }, { emoji: '⬜' }, { emoji: '🟫' }, { emoji: '🔈' }, { emoji: '🔇' }, { emoji: '🔉' }, { emoji: '🔊' },
         { emoji: '🔔' }, { emoji: '🔕' }, { emoji: '📣' }, { emoji: '📢' }, { emoji: '👁️‍🗨️' }, { emoji: '💬' }, { emoji: '💭' }, { emoji: '🗯️' }, { emoji: '♠️' }, { emoji: '♣️' },
         { emoji: '♥️' }, { emoji: '♦️' }, { emoji: '🃏' }, { emoji: '🎴' }, { emoji: '🀄' }, { emoji: '🕐' }, { emoji: '🕑' }, { emoji: '🕒' }, { emoji: '🕓' }, { emoji: '🕔' },
         { emoji: '🕕' }, { emoji: '🕖' }, { emoji: '🕗' }, { emoji: '🕘' }, { emoji: '🕙' }, { emoji: '🕚' }, { emoji: '🕛' }, { emoji: '🕜' }, { emoji: '🕝' }, { emoji: '🕞' },
         { emoji: '🕟' }, { emoji: '🕠' }, { emoji: '🕡' }, { emoji: '🕢' }, { emoji: '🕣' }, { emoji: '🕤' }, { emoji: '🕥' }, { emoji: '🕦' }, { emoji: '🕧' }
       ]);
    } finally {
      setLoadingEmojis(false);
    }
  };

  useEffect(() => {
    if (showEmojiPicker || showCustomizeReactions) {
      fetchEmojis();
    }
  }, [showEmojiPicker, showCustomizeReactions]);

  // Generalized Send Message
  const sendMessage = async ({ text = '', image = null, gif = null }) => {
    if ((!text && !image && !gif) || !user || !activeChat) return;

    const chatId = [user.uid, activeChat.uid].sort().join('_');
    const messagesRef = ref(db, `chats/${chatId}/messages`);

    const msgData = {
      senderId: user.uid,
      timestamp: serverTimestamp(),
      senderName: user.displayName || 'User'
    };

    if (text) msgData.text = text;
    if (image) msgData.image = image;
    if (gif) msgData.gif = gif;
    
    // Attach link preview if exists and sending text
    if (text && linkPreviewData && !image && !gif) {
      msgData.linkPreview = linkPreviewData;
      // Remove URL from text to avoid duplication
      const escapedUrl = linkPreviewData.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const urlRegex = new RegExp(escapedUrl, 'g');
      msgData.text = text.replace(urlRegex, '').trim();
    }

    try {
      await push(messagesRef, msgData);
      setNewMessage('');
      setLinkPreviewData(null);
      setShowGifPicker(false);
      setShowEmojiPicker(false);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Image Handling
  const processFiles = async (files) => {
    if (files.length === 0) return;
    
    const file = files[0]; // Single image for chat for now
    if (!file.type.match(/image\/(jpeg|jpg|png|gif|webp)/)) {
      alert("Only images are allowed");
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadToImgBB(file);
      // Send immediately as image message
      await sendMessage({ image: result.url });
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handlePaste = (e) => {
    if (e.clipboardData && e.clipboardData.items) {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processFiles([file]);
            return;
          }
        }
      }
    }
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    processFiles(files);
    e.target.value = null;
  };

  const handleReaction = async (msgId, emoji) => {
     if (!user || !activeChat) return;
     const chatId = [user.uid, activeChat.uid].sort().join('_');
     const reactionRef = ref(db, `chats/${chatId}/messages/${msgId}/reactions/${user.uid}`);
     
     try {
       // Check if we already reacted with this emoji
       // Since we don't have the current state easily here without passing it, 
       // we can just set it. The UI handles the toggle visual, but backend needs logic.
       // For simplicity, we'll just set it. If user clicks again, we can remove it if we knew.
       // Let's rely on the UI calling this. 
       // Better: Read it first.
       const snapshot = await get(reactionRef);
       if (snapshot.exists() && snapshot.val() === emoji) {
         await remove(reactionRef);
       } else {
         await set(reactionRef, emoji);
       }
       setHoveredMessageId(null);
     } catch (error) {
       console.error("Reaction error:", error);
     }
  };

  const deleteMessage = async (msgId) => {
    if (!user || !activeChat) return;
    if (window.confirm("Delete this message?")) {
      const chatId = [user.uid, activeChat.uid].sort().join('_');
      try {
        await remove(ref(db, `chats/${chatId}/messages/${msgId}`));
      } catch (error) {
        console.error("Error deleting message:", error);
      }
    }
  };

  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    sendMessage({ text: newMessage });
  };

  const handleSearchResultClick = (targetUser) => {
    // Check if friend
    const isFriend = friends.some(f => f.uid === targetUser.uid);
    if (isFriend) {
      setActiveTab('friends');
      setActiveChat(targetUser);
    } else {
      // Not a friend - maybe send request or just show profile?
      // User said "redirect to their conversation", but we can't chat if not friends.
      // So we will prompt to connect.
      if (window.confirm(`You are not connected with ${targetUser.displayName}. Send a friend request?`)) {
        sendFriendRequest(targetUser.uid);
      }
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const usersRef = ref(db, 'users');
      const snapshot = await get(usersRef);
      
      const results = [];
      const lowerQ = searchQuery.toLowerCase().trim();

      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const userData = childSnapshot.val();
          
          // Only search among friends
          const isFriend = friends.some(f => f.uid === childSnapshot.key);
          
          if (childSnapshot.key !== user.uid && isFriend) { 
             const name = (userData.displayName || userData.fullName || '').toLowerCase();
             const username = (userData.username || '').toLowerCase();
             
             if (name.includes(lowerQ) || username.includes(lowerQ)) {
                results.push({ uid: childSnapshot.key, ...userData });
             }
          }
        });
      }
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (targetUid) => {
    if (!user) return;
    try {
      await set(ref(db, `users/${targetUid}/friendRequests/${user.uid}`), {
        timestamp: Date.now(),
        status: 'pending'
      });
      showModal({ message: 'Friend request sent!', title: 'Success' });
    } catch (error) {
      console.error("Error sending request:", error);
    }
  };

  const acceptRequest = async (requesterUid) => {
    if (!user) return;
    try {
      // Add to my friends
      await set(ref(db, `users/${user.uid}/friends/${requesterUid}`), true);
      // Add me to their friends
      await set(ref(db, `users/${requesterUid}/friends/${user.uid}`), true);
      // Remove request
      await remove(ref(db, `users/${user.uid}/friendRequests/${requesterUid}`));
    } catch (error) {
      console.error("Error accepting request:", error);
    }
  };

  const rejectRequest = async (requesterUid) => {
    if (!user) return;
    try {
      await remove(ref(db, `users/${user.uid}/friendRequests/${requesterUid}`));
    } catch (error) {
      console.error("Error rejecting request:", error);
    }
  };

  const removeFriend = async (friendUid) => {
      if(!user) return;
      if(window.confirm("Are you sure you want to remove this Cappie?")) {
          try {
              await remove(ref(db, `users/${user.uid}/friends/${friendUid}`));
              await remove(ref(db, `users/${friendUid}/friends/${user.uid}`));
          } catch (error) {
              console.error("Error removing friend:", error);
          }
      }
  }

  const deleteConversation = async () => {
    if (!user || !activeChat) return;
    if (window.confirm("Are you sure you want to delete this conversation? This cannot be undone.")) {
      try {
        const chatId = [user.uid, activeChat.uid].sort().join('_');
        await remove(ref(db, `chats/${chatId}/messages`));
        setMessages([]);
      } catch (error) {
        console.error("Error deleting conversation:", error);
      }
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
      label: 'Recruit', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg> 
    },
    { 
      label: 'Crew', 
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
    <div className="cappies-page-wrapper page-transition">
      <aside className="cappies-sidebar">
        <div className="sidebar-menu">
          {menuItems.map((item) => (
            <div 
              key={item.label}
              className={`sidebar-item ${item.label === 'Connections' ? 'active' : ''}`}
              onClick={() => {
                if (item.label === 'CapyHome') navigate('/home');
                else if (item.label === 'Connections') navigate('/connections');
                else if (item.label === 'CapyDEVS') navigate('/devs');
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
      <div className="cappies-container">
      <div className="cappies-header">
        <div className="cappies-tabs">
          <button 
            className={`cappies-tab ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            Messages
          </button>
          <button 
            className={`cappies-tab ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            Requests ({requests.length})
          </button>
          <button 
            className={`cappies-tab ${activeTab === 'find' ? 'active' : ''}`}
            onClick={() => setActiveTab('find')}
          >
            Find Cappies
          </button>
        </div>
      </div>

      <div className="cappies-content">
        {activeTab === 'friends' && (
          <div className="cappies-chat-container">
            {/* Left Sidebar - Friend List */}
            <div className="chat-sidebar">
              <div className="chat-sidebar-header">
                Connections
              </div>
              <div className="chat-friends-list">
                {friends.length > 0 ? (
                  friends.map(friend => (
                    <ChatFriendItem 
                      key={friend.uid} 
                      uid={friend.uid}
                      isActive={activeChat?.uid === friend.uid}
                      onClick={setActiveChat}
                      currentUser={user}
                    />
                  ))
                ) : (
                  <div style={{padding: '20px', textAlign: 'center', color: 'var(--capy-text-secondary)'}}>
                    No connections yet. Go find some!
                  </div>
                )}
              </div>
            </div>

            {/* Right Main - Chat Area */}
            {activeChat ? (
              <div className="chat-window">
                <div className="chat-window-header" style={{zIndex: 20, position: 'relative'}}>
                  {activeChat.photoURL ? (
                    <img 
                      src={activeChat.photoURL} 
                      alt={activeChat.displayName} 
                      className="chat-header-avatar" 
                    />
                  ) : (
                    <InitialsAvatar 
                      name={activeChat.displayName} 
                      uid={activeChat.uid} 
                      className="chat-header-avatar"
                      size={40}
                      fontSize="16px"
                    />
                  )}
                  <div className="chat-header-info">
                    <span className="chat-header-name">{activeChat.displayName}</span>
                    <span className="chat-header-status">
                      <span className="status-dot online"></span> Online
                    </span>
                  </div>
                  <div style={{flex: 1}}></div>
                  
                  {/* 3-Dot Menu */}
                  <div className="chat-menu-container">
                    <button 
                      className="chat-menu-trigger"
                      onClick={() => setIsChatMenuOpen(!isChatMenuOpen)}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="19" cy="12" r="1"></circle>
                        <circle cx="5" cy="12" r="1"></circle>
                      </svg>
                    </button>
                    {isChatMenuOpen && (
                      <div className="chat-dropdown-menu">
                        <button onClick={(e) => { 
                          e.stopPropagation();
                          setIsChatMenuOpen(false); 
                          const rect = e.currentTarget.getBoundingClientRect();
                          setSelectedUser({
                            uid: activeChat.uid,
                            initialName: activeChat.displayName,
                            initialAvatar: activeChat.photoURL,
                            x: rect.left - 360, 
                            y: rect.top
                          });
                        }}>
                          View Profile
                        </button>
                        <button onClick={() => { setIsChatMenuOpen(false); removeFriend(activeChat.uid); }}>
                          Remove Connection
                        </button>
                        <button className="delete-option" onClick={() => { setIsChatMenuOpen(false); deleteConversation(); }}>
                          Delete Chat
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="chat-messages">
                  <div className="chat-legal-notice" style={{
                    textAlign: 'center',
                    padding: '12px 16px',
                    margin: '10px auto 20px auto',
                    maxWidth: '85%',
                    color: 'var(--capy-text-secondary)',
                    fontSize: '11px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    alignItems: 'center'
                  }}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', color: 'var(--capy-text)'}}>
                      <span>🔒</span>
                      <span>End-to-end Encrypted</span>
                    </div>
                    <span>
                      Messages are secured. No one outside of this chat, not even CHIRP, can read or listen to them. 
                      By chatting, you agree to our <span style={{color: 'var(--capy-accent)', cursor: 'pointer'}}>Terms</span> and <span style={{color: 'var(--capy-accent)', cursor: 'pointer'}}>Privacy Policy</span>.
                    </span>
                  </div>

                  {messages.map((msg, index) => {
                    const isSameSender = index > 0 && messages[index - 1].senderId === msg.senderId;
                    const showTimestamp = !isSameSender || (index > 0 && (msg.timestamp - messages[index - 1].timestamp > 300000)); // 5 mins
                    
                    return (
                      <div 
                        key={msg.id} 
                        className={`message-wrapper ${msg.senderId === user.uid ? 'sent' : 'received'} ${isSameSender ? 'grouped' : ''}`}
                        onMouseEnter={() => setHoveredMessageId(msg.id)}
                        onMouseLeave={() => setHoveredMessageId(null)}
                      >
                         {!isSameSender && msg.senderId !== user.uid && (
                           <div className="message-avatar-spacer">
                              {/* Avatar could go here if we wanted it next to messages */}
                           </div>
                         )}
                        <div className="message-content-container" style={{position: 'relative'}}>
                              {/* Reaction Bar */}
                              {hoveredMessageId === msg.id && (
                                <div className="reaction-bar" style={{
                                  position: 'absolute',
                                  top: '-45px',
                                  [msg.senderId === user.uid ? 'right' : 'left']: '0',
                                  background: 'var(--capy-card-bg)',
                                  border: '1px solid var(--capy-border)',
                                  borderRadius: '24px',
                                  padding: '6px 10px',
                                  display: 'flex',
                                  gap: '6px',
                                  zIndex: 100,
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                }}>
                                  {[...quickReactions, '➕'].map((emoji, idx) => (
                                    <button 
                                      key={`${emoji}-${idx}`}
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        if (emoji === '➕') {
                                          setTempReactions([...quickReactions]);
                                          setShowCustomizeReactions(true);
                                          setReactionTargetMessageId(null);
                                          setShowEmojiPicker(false);
                                          setShowGifPicker(false);
                                        } else {
                                          handleReaction(msg.id, emoji); 
                                        }
                                      }}
                                      style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', padding: '2px', transition: 'transform 0.1s'}}
                                      onMouseEnter={(e) => e.target.style.transform = 'scale(1.2)'}
                                      onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              )}

                           {/* Delete Button (Only for own messages) */}
                           {msg.senderId === user.uid && hoveredMessageId === msg.id && (
                             <button 
                               onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id); }}
                               title="Delete Message"
                               style={{
                                 position: 'absolute',
                                 top: '50%',
                                 left: '-30px',
                                 transform: 'translateY(-50%)',
                                 background: 'none',
                                 border: 'none',
                                 color: '#ef5350', // Red color
                                 cursor: 'pointer',
                                 padding: '4px',
                                 display: 'flex',
                                 alignItems: 'center',
                                 justifyContent: 'center',
                                 opacity: 0.8
                               }}
                             >
                               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                 <polyline points="3 6 5 6 21 6"></polyline>
                                 <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                               </svg>
                             </button>
                           )}

                           <div className="message-bubble" style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                              {msg.image && (
                                <img src={msg.image} alt="Sent image" style={{maxWidth: '320px', width: '100%', borderRadius: '8px', cursor: 'pointer'}} onClick={() => window.open(msg.image, '_blank')} />
                              )}
                              {msg.gif && (
                                <img src={msg.gif} alt="GIF" style={{maxWidth: '320px', width: '100%', borderRadius: '8px'}} />
                              )}
                              {msg.text && <span>{msg.text}</span>}
                              
                              {msg.linkPreview && (
                                <a href={msg.linkPreview.url} target="_blank" rel="noopener noreferrer" className="chat-link-preview" style={{
                                  display: 'block',
                                  textDecoration: 'none',
                                  color: 'inherit',
                                  background: 'rgba(0,0,0,0.1)',
                                  borderRadius: '8px',
                                  overflow: 'hidden',
                                  fontSize: '12px',
                                  marginTop: '4px'
                                }}>
                                  {msg.linkPreview.image && (
                                    <div style={{
                                      height: '140px',
                                      backgroundSize: 'cover',
                                      backgroundPosition: 'center',
                                      backgroundImage: `url(${msg.linkPreview.image})`
                                    }}></div>
                                  )}
                                  <div style={{padding: '8px'}}>
                                    <div style={{fontWeight: 'bold', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{msg.linkPreview.title}</div>
                                    <div style={{opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{msg.linkPreview.description}</div>
                                  </div>
                                </a>
                              )}
                           </div>
                           
                           {/* Reactions Display */}
                           {msg.reactions && (
                             <div className="message-reactions" style={{
                               position: 'absolute',
                               bottom: '-12px',
                               [msg.senderId === user.uid ? 'right' : 'left']: '0',
                               background: 'var(--capy-bg)',
                               border: '1px solid var(--capy-border)',
                               borderRadius: '12px',
                               padding: '2px 8px',
                               fontSize: '12px',
                               display: 'flex',
                               alignItems: 'center',
                               gap: '4px',
                               boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                               zIndex: 5
                             }}>
                                {Object.values(msg.reactions).slice(0, 3).map((r, i) => (
                                  <span key={i}>{r}</span>
                                ))}
                                {Object.keys(msg.reactions).length > 1 && (
                                  <span style={{marginLeft: '2px', fontWeight: 'bold'}}>{Object.keys(msg.reactions).length}</span>
                                )}
                             </div>
                           )}
                        </div>
                        {showTimestamp && (
                          <span className="message-time">
                            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <form className="chat-input-area" onSubmit={handleSendMessage} style={{position: 'relative'}}>
                  {/* Pickers Container - Absolute positioned above input */}
                  {showGifPicker && (
                    <div className="gif-picker-container" ref={gifPickerRef} style={{
                      position: 'absolute', bottom: '100%', left: 0, width: '300px', height: '300px', 
                      background: 'var(--capy-card-bg)', border: '1px solid var(--capy-border)', 
                      borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                      zIndex: 20, boxShadow: '0 -4px 20px rgba(0,0,0,0.3)', marginBottom: '10px'
                    }}>
                       <input 
                         type="text" 
                         placeholder="Search GIFs..." 
                         value={gifSearchQuery} 
                         onChange={e => setGifSearchQuery(e.target.value)}
                         style={{padding: '8px', border: 'none', borderBottom: '1px solid var(--capy-border)', background: 'transparent', color: 'var(--capy-text)'}}
                       />
                       <div className="gif-grid" style={{flex: 1, overflowY: 'auto', padding: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px'}}>
                         {loadingGifs ? <div style={{padding: '10px', textAlign: 'center'}}>Loading...</div> : gifs.map(gif => (
                           <img 
                             key={gif.id} 
                             src={gif.media?.[0]?.tinygif?.url} 
                             alt="GIF" 
                             style={{width: '100%', borderRadius: '4px', cursor: 'pointer'}}
                             onClick={() => sendMessage({ gif: gif.media?.[0]?.gif?.url })}
                           />
                         ))}
                       </div>
                    </div>
                  )}

                  {showEmojiPicker && (
                    <div className="emoji-picker-container" style={{
                      position: 'absolute', bottom: '100%', left: '50px', width: '300px', height: '300px', 
                      background: 'var(--capy-card-bg)', border: '1px solid var(--capy-border)', 
                      borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                      zIndex: 20, boxShadow: '0 -4px 20px rgba(0,0,0,0.3)', marginBottom: '10px'
                    }}>
                       <div className="emoji-grid" style={{flex: 1, overflowY: 'auto', padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px'}}>
                         {loadingEmojis ? <div style={{padding: '10px', textAlign: 'center'}}>Loading...</div> : emojis.map((e, i) => (
                           <button 
                             key={i} 
                             type="button"
                             style={{fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer'}}
                             onClick={() => {
                               if (reactionTargetMessageId) {
                                 handleReaction(reactionTargetMessageId, e.emoji);
                                 setShowEmojiPicker(false);
                                 setReactionTargetMessageId(null);
                               } else {
                                 setNewMessage(prev => prev + e.emoji);
                               }
                             }}
                           >
                             {e.emoji}
                           </button>
                         ))}
                       </div>
                    </div>
                  )}

                  {showCustomizeReactions && (
                    <div className="customize-reactions-modal" style={{
                      position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
                      background: 'rgba(0,0,0,0.5)', zIndex: 9999,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }} onClick={(e) => {
                      if (e.target === e.currentTarget) {
                        setShowCustomizeReactions(false);
                        setEditingReactionSlot(null);
                      }
                    }}>
                      <div className="customize-content" style={{
                        background: 'var(--capy-card-bg)', border: '1px solid var(--capy-border)',
                        borderRadius: '16px', padding: '20px', width: '350px',
                        display: 'flex', flexDirection: 'column', gap: '16px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                      }}>
                        <h3 style={{margin: 0, textAlign: 'center'}}>Customize reactions</h3>
                        
                        <div style={{display: 'flex', justifyContent: 'space-between', padding: '10px 0'}}>
                          {tempReactions.map((emoji, idx) => (
                            <button 
                              key={idx}
                              onClick={() => setEditingReactionSlot(idx)}
                              style={{
                                width: '40px', height: '40px', fontSize: '24px',
                                background: editingReactionSlot === idx ? 'var(--capy-bg)' : 'transparent',
                                border: editingReactionSlot === idx ? '2px solid var(--capy-accent)' : '1px solid var(--capy-border)',
                                borderRadius: '8px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>

                        {editingReactionSlot !== null && (
                           <div className="emoji-picker-embedded" style={{
                             height: '200px', border: '1px solid var(--capy-border)', borderRadius: '8px',
                             overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', padding: '8px'
                           }}>
                             {loadingEmojis ? <div>Loading...</div> : emojis.map((e, i) => (
                               <button 
                                 key={i} 
                                 type="button"
                                 style={{fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer'}}
                                 onClick={() => {
                                    const newReactions = [...tempReactions];
                                    newReactions[editingReactionSlot] = e.emoji;
                                    setTempReactions(newReactions);
                                    setEditingReactionSlot(null);
                                 }}
                               >
                                 {e.emoji}
                               </button>
                             ))}
                           </div>
                        )}

                        <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '10px'}}>
                          <button onClick={() => {
                            setTempReactions([...DEFAULT_REACTIONS]);
                            setEditingReactionSlot(null);
                          }} style={{padding: '8px 12px', borderRadius: '8px', border: 'none', background: 'var(--capy-bg)', color: 'var(--capy-text)', cursor: 'pointer'}}>
                            Reset
                          </button>
                          <div style={{display: 'flex', gap: '8px'}}>
                            <button onClick={() => {
                              setShowCustomizeReactions(false);
                              setEditingReactionSlot(null);
                            }} style={{padding: '8px 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--capy-text)', cursor: 'pointer'}}>
                              Cancel
                            </button>
                            <button onClick={() => {
                              setQuickReactions(tempReactions);
                              localStorage.setItem('capy_quick_reactions', JSON.stringify(tempReactions));
                              setShowCustomizeReactions(false);
                              setEditingReactionSlot(null);
                            }} style={{padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--capy-accent)', color: '#fff', cursor: 'pointer'}}>
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Link Preview Indicator */}
                  {isGeneratingPreview && (
                    <div style={{position: 'absolute', bottom: '100%', left: '20px', background: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: '#fff', marginBottom: '10px'}}>
                      Generating preview...
                    </div>
                  )}
                  {linkPreviewData && (
                    <div style={{position: 'absolute', bottom: '100%', left: '20px', width: '250px', background: 'var(--capy-card-bg)', border: '1px solid var(--capy-border)', borderRadius: '8px', padding: '8px', fontSize: '12px', display: 'flex', gap: '8px', marginBottom: '10px'}}>
                       {linkPreviewData.image && <img src={linkPreviewData.image} alt="" style={{width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px'}} />}
                       <div style={{overflow: 'hidden', flex: 1}}>
                         <div style={{fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{linkPreviewData.title}</div>
                         <button type="button" onClick={() => setLinkPreviewData(null)} style={{background: 'none', border: 'none', color: 'var(--capy-accent)', cursor: 'pointer', fontSize: '11px', padding: 0, marginTop: '2px'}}>Remove Preview</button>
                       </div>
                    </div>
                  )}

                  <div className="chat-input-actions">
                     <button type="button" className={`input-action-btn ${showGifPicker ? 'active' : ''}`} title="GIF" onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}>
                       <span style={{fontWeight: 'bold', fontSize: '10px'}}>GIF</span>
                     </button>
                     
                     <input 
                       type="file" 
                       id="chat-image-upload" 
                       accept="image/*" 
                       style={{ display: 'none' }} 
                       onChange={handleImageSelect}
                     />
                     <button type="button" className="input-action-btn" title="Image" onClick={() => document.getElementById('chat-image-upload').click()}>
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                     </button>
                     
                     <button type="button" className={`input-action-btn ${showEmojiPicker ? 'active' : ''}`} title="Emoji" onClick={() => { 
                       setShowEmojiPicker(!showEmojiPicker); 
                       setShowGifPicker(false); 
                       if (showEmojiPicker) setReactionTargetMessageId(null); // Clear target if closing
                     }}>
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                     </button>
                  </div>
                  <input 
                    type="text" 
                    className="chat-input" 
                    placeholder="Type a message..." 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onPaste={handlePaste}
                  />
                  <button 
                    type="submit" 
                    className="chat-send-btn"
                    disabled={!newMessage.trim() && !linkPreviewData}
                  >
                    ➤
                  </button>
                </form>
              </div>
            ) : (
              <div className="empty-chat-state">
                <div className="empty-chat-icon">💬</div>
                <h3>Your Messages</h3>
                <p>Select a connection to start chatting</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="cappies-scrollable-content">
          <div className="cappies-grid">
            {requests.length > 0 ? (
              requests.map(req => (
                <div key={req.uid} className="capy-user-card">
                   {req.photoURL ? (
                     <img src={req.photoURL} alt={req.displayName} className="capy-user-avatar" />
                   ) : (
                     <InitialsAvatar 
                       name={req.displayName} 
                       uid={req.uid} 
                       className="capy-user-avatar"
                       size={80}
                     />
                   )}
                  <h3 className="capy-user-name">{req.displayName || 'Unknown Capy'}</h3>
                  <span className="capy-user-role">{req.role || 'Capy User'}</span>
                  <div className="capy-user-actions">
                    <button className="capy-btn-primary" onClick={() => acceptRequest(req.uid)}>Accept</button>
                    <button className="capy-btn-secondary" onClick={() => rejectRequest(req.uid)}>Decline</button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <span className="empty-icon">📭</span>
                <p>No pending friend requests.</p>
              </div>
            )}
          </div>
          </div>
        )}

        {activeTab === 'find' && (
          <div className="cappies-find-container cappies-scrollable-content">
            <form onSubmit={handleSearch} className="cappies-search-box">
              <input 
                type="text" 
                className="cappies-search-input" 
                placeholder="Search your connections..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="capy-btn-primary">Search</button>
            </form>

            <div className="cappies-grid" style={{marginTop: '20px'}}>
              {loading ? (
                <div style={{textAlign: 'center', padding: '20px'}}>Searching...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map(res => (
                  <div key={res.uid} className="capy-user-card" onClick={() => handleSearchResultClick(res)} style={{cursor: 'pointer'}}>
                     {res.photoURL ? (
                       <img src={res.photoURL} alt={res.displayName} className="capy-user-avatar" />
                     ) : (
                       <InitialsAvatar 
                         name={res.displayName} 
                         uid={res.uid} 
                         className="capy-user-avatar"
                         size={80}
                       />
                     )}
                    <h3 className="capy-user-name">{res.displayName || 'Unknown Capy'}</h3>
                    <span className="capy-user-role">{res.role || 'Capy User'}</span>
                    <div className="capy-user-actions">
                      {friends.some(f => f.uid === res.uid) ? (
                        <button className="capy-btn-primary">Message</button>
                      ) : (
                        <button 
                          className="capy-btn-secondary" 
                          onClick={(e) => { e.stopPropagation(); sendFriendRequest(res.uid); }}
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                searchQuery && !loading && (
                  <div className="empty-state">
                    <p>No cappies found.</p>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
      <CapyModal {...modalConfig} onClose={closeModal} />
      {selectedUser && (
        <MiniProfileCard 
          targetUid={selectedUser.uid}
          initialName={selectedUser.initialName}
          initialAvatar={selectedUser.initialAvatar}
          position={{ x: selectedUser.x, y: selectedUser.y }}
          onClose={() => setSelectedUser(null)}
        />
      )}
      </div>
    </div>
  );
};

export default Cappies;
