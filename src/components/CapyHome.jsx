import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDatabase, ref, onValue, push, update, remove, serverTimestamp, runTransaction } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import './CapyHome.css';
import CapyModal from './CapyModal';
import InitialsAvatar from './InitialsAvatar';

import { uploadToImgBB, deleteFromImgBB } from '../utils/imgbb';

const CapyHome = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [news, setNews] = useState([]);
  const [newsIds, setNewsIds] = useState([]);
  const [newsLimit, setNewsLimit] = useState(3);
  const [scanIndex, setScanIndex] = useState(0); // For scanning HN IDs
  const [trends, setTrends] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('CapyHome');
  const [loadingNews, setLoadingNews] = useState(true);
  const [selectedTrend, setSelectedTrend] = useState(null);
  const [trendTimeframe, setTrendTimeframe] = useState('daily');
  const [trendLimit, setTrendLimit] = useState(3);
  const [myFriends, setMyFriends] = useState({});
  const [postPrivacy, setPostPrivacy] = useState('world'); // world, cappies, self
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  
  // Saved Posts State
  const [savedPosts, setSavedPosts] = useState({});

  // Force update on profile change
  const [, forceUpdate] = useState();
  useEffect(() => {
    const handleProfileUpdate = () => forceUpdate({});
    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
  }, []);
  
  // Link Preview State
  const [showLinkPreview, setShowLinkPreview] = useState(false);
  const [linkPreviewData, setLinkPreviewData] = useState(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  // Helper to extract URL
  const extractUrl = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text && text.match(urlRegex);
    return matches ? matches[0] : null;
  };

  // Generate Preview Effect
  useEffect(() => {
    if (!showLinkPreview) {
      setLinkPreviewData(null);
      return;
    }

    const url = extractUrl(newPostContent);
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

      // 1. Check for Special Handlers (YouTube, Vimeo, Images)
      // Image Direct Link
      if (url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
        if (isMounted) {
          setLinkPreviewData({
            url: url,
            title: 'Image Preview',
            description: 'Click to view full image',
            image: url,
            type: 'image',
            source: 'Image'
          });
          setIsGeneratingPreview(false);
        }
        return;
      }

      // YouTube
      const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
      if (ytMatch) {
        if (isMounted) {
          setLinkPreviewData({
            url: url,
            type: 'video',
            source: 'YouTube',
            videoId: ytMatch[1],
            title: 'YouTube Video', 
            description: 'Watch this video on Chirp',
            image: `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`,
            embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`
          });
          setIsGeneratingPreview(false);
        }
        return;
      }
      
      // Vimeo
      const vimeoMatch = url.match(/vimeo\.com\/([0-9]+)/);
      if (vimeoMatch) {
        if (isMounted) {
          setLinkPreviewData({
            url: url,
            type: 'video',
            source: 'Vimeo',
            videoId: vimeoMatch[1],
            title: 'Vimeo Video',
            description: 'Watch this video on Chirp',
            image: null, // Vimeo requires API for image, or let generic handler catch it if we want image
            embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`
          });
          setIsGeneratingPreview(false);
        }
        return;
      }

      // 2. Generic Sites - Fetch Metadata using Microlink API
      try {
        const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
        const result = await response.json();

        if (result.status === 'success' && isMounted) {
          const { title, description, image, logo, publisher } = result.data;
          
          setLinkPreviewData({
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
        console.warn("Link preview fetch failed, using fallback:", error);
        if (isMounted) {
          // Fallback to basic info
          setLinkPreviewData({
            url: url,
            title: hostname,
            description: `Visit ${hostname} to see more.`,
            image: `https://www.google.com/s2/favicons?domain=${hostname}&sz=256`,
            type: 'link',
            source: hostname
          });
        }
      } finally {
        if (isMounted) {
          setIsGeneratingPreview(false);
        }
      }
    };

    // Debounce slightly to avoid rapid API calls
    const timer = setTimeout(() => {
        generatePreview();
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [newPostContent, showLinkPreview]);

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
  
  // Edit State
  const [editingPostId, setEditingPostId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState(null);

  // Comment State
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [commentsData, setCommentsData] = useState({}); // Map of postId -> comments array
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [openCommentDropdownId, setOpenCommentDropdownId] = useState(null);

  const auth = getAuth();
  const db = getDatabase();
  const user = auth.currentUser;

  // Fetch Friends for Privacy
  useEffect(() => {
    if (!user) {
      setMyFriends({});
      return;
    }
    const friendsRef = ref(db, `users/${user.uid}/friends`);
    const unsubscribe = onValue(friendsRef, (snapshot) => {
      setMyFriends(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, [user, db]);

  // Helper: Check if story is tech/cyber related
  const isTechOrCyber = (story) => {
    if (!story || !story.title) return false;
    const text = (story.title + " " + (story.text || "")).toLowerCase();
    
    // Whitelist keywords
    const keywords = [
      'security', 'cyber', 'hack', 'breach', 'vulnerability', 'exploit', 'malware', 'ransomware', 'attack', 'phishing',
      'privacy', 'crypto', 'password', 'auth', 'botnet', 'spyware', 'linux', 'bug', 'patch', 'cve', 'zero-day',
      'firewall', 'network', 'protocol', 'encryption', 'token', 'ssh', 'ssl', 'tls', 'vpn', 'defense', 'threat',
      'virus', 'trojan', 'worm', 'rootkit', 'backdoor', 'xss', 'injection', 'overflow', 'ddos', 'mitm', 'arp', 'dns',
      'tech', 'software', 'developer', 'code', 'programming', 'ai', 'artificial intelligence', 'data', 'web', 'app',
      'system', 'computer', 'digital', 'internet', 'api', 'server', 'cloud', 'aws', 'azure', 'google', 'microsoft',
      'apple', 'linux', 'windows', 'macos', 'android', 'ios', 'mobile', 'device', 'hardware', 'firmware', 'chip',
      'processor', 'memory', 'storage', 'database', 'sql', 'nosql', 'algorithm', 'machine learning', 'neural',
      'browser', 'chrome', 'firefox', 'safari', 'edge', 'opensource', 'git', 'github', 'gitlab', 'framework', 'react',
      'node', 'python', 'java', 'rust', 'golang', 'c++', 'javascript', 'typescript'
    ];

    // Check if any keyword matches
    return keywords.some(kw => text.includes(kw));
  };

  // Fetch Hacker News
  useEffect(() => {
    const fetchNewsIds = async () => {
      try {
        const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
        const ids = await response.json();
        setNewsIds(ids);
      } catch (error) {
        console.error("Error fetching HN IDs:", error);
        setLoadingNews(false);
      }
    };
    fetchNewsIds();
  }, []);

  // Filter and Load News
  useEffect(() => {
    if (newsIds.length === 0) return;
    if (news.length >= newsLimit) return; // Already have enough

    const fetchAndFilterNews = async () => {
      setLoadingNews(true);
      
      let currentNews = [...news];
      let currentIndex = scanIndex;
      let attempts = 0;
      const MAX_ATTEMPTS = 10; // Prevent infinite loops
      const BATCH_SIZE = 10;

      try {
        while (currentNews.length < newsLimit && currentIndex < newsIds.length && attempts < MAX_ATTEMPTS) {
          const idsToFetch = newsIds.slice(currentIndex, currentIndex + BATCH_SIZE);
          currentIndex += BATCH_SIZE;
          attempts++;

          const newsPromises = idsToFetch.map(id => 
            fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(res => res.json())
          );
          
          const batchResults = await Promise.all(newsPromises);
          const validStories = batchResults.filter(story => story && story.type === 'story' && !story.dead && !story.deleted && isTechOrCyber(story));
          
          currentNews = [...currentNews, ...validStories];
        }

        setNews(currentNews);
        setScanIndex(currentIndex);
      } catch (error) {
        console.error("Error filtering HN details:", error);
      } finally {
        setLoadingNews(false);
      }
    };

    fetchAndFilterNews();
  }, [newsIds, newsLimit, news.length]); // Depend on news.length to trigger next batch if needed

  // Fetch Posts and Calculate Trends
  useEffect(() => {
    const postsRef = ref(db, 'posts');
    const unsubscribe = onValue(postsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const postsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).sort((a, b) => b.timestamp - a.timestamp);
        
        setPosts(postsArray);
        calculateTrends(postsArray);
      } else {
        setPosts([]);
        setTrends([]);
      }
    });

    return () => unsubscribe();
  }, [db]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.post-options-container') && 
          !event.target.closest('.comment-options-container') &&
          !event.target.closest('.privacy-selector-container')) {
        setOpenDropdownId(null);
        setOpenCommentDropdownId(null);
        setShowPrivacyMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen for comments when a post is expanded
  useEffect(() => {
    if (!activeCommentPostId) return;

    const commentsRef = ref(db, `posts/${activeCommentPostId}/comments_list`);
    const unsubscribe = onValue(commentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedComments = Object.entries(data).map(([key, val]) => ({
          id: key,
          ...val
        })).sort((a, b) => a.timestamp - b.timestamp);
        
        setCommentsData(prev => ({
          ...prev,
          [activeCommentPostId]: loadedComments
        }));
      } else {
        setCommentsData(prev => ({
          ...prev,
          [activeCommentPostId]: []
        }));
      }
    });

    return () => unsubscribe();
  }, [activeCommentPostId, db]);

  const calculateTrends = (currentPosts) => {
    const hashtagCounts = {};
    let totalHashtagsFound = 0;

    currentPosts.forEach(post => {
      if (post.content) {
        const found = post.content.match(/#[a-zA-Z0-9_]+/g);
        if (found) {
          found.forEach(tag => {
            hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
            totalHashtagsFound++;
          });
        }
      }
    });

    const sortedTrends = Object.entries(hashtagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    setTrends(sortedTrends);
  };

  const handleTrendClick = (tag) => {
    if (selectedTrend === tag) {
      setSelectedTrend(null);
    } else {
      setSelectedTrend(tag);
      // Scroll to top of feed
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleVote = (postId, direction) => {
    if (!user) return showModal({ message: "Please login to vote!", title: "Login Required" });
    const postRef = ref(db, `posts/${postId}`);
    runTransaction(postRef, (post) => {
      if (post) {
        if (!post.userVotes) post.userVotes = {};
        const currentVote = post.userVotes[user.uid] || 0;
        
        if (currentVote === direction) {
          // Toggle off
          post.score = (post.score || 0) - direction;
          post.userVotes[user.uid] = null;
        } else {
          // Switch vote or new vote
          post.score = (post.score || 0) - currentVote + direction;
          post.userVotes[user.uid] = direction;
        }
      }
      return post;
    });
  };

  const handleRepost = async (post) => {
    if (!user) return showModal({ message: "Please login to repost!", title: "Login Required" });
    
    // Determine source post (handle nested reposts)
    const sourcePost = post.repostData ? post.repostData : post;

    showModal({
      type: 'confirm',
      title: 'Repost Chirp',
      message: "Repost this chirp to your feed?",
      onConfirm: async () => {
        const postRef = ref(db, `posts/${post.id}/shares`);
        // Increment share count
        runTransaction(postRef, (current) => (current || 0) + 1);

        // Create new post
        try {
            const newPost = {
                content: '', // Empty content, using repostData
                author: user.displayName || 'Anonymous Capy',
                authorId: user.uid,
                avatar: user.photoURL || null,
                role: 'User',
                timestamp: serverTimestamp(),
                likes: 0,
                comments: 0,
                shares: 0,
                privacy: postPrivacy,
                repostOf: sourcePost.id || post.id,
                repostData: {
                    id: sourcePost.id || post.id,
                    author: sourcePost.author,
                    authorId: sourcePost.authorId,
                    avatar: sourcePost.avatar,
                    content: sourcePost.content,
                    image: sourcePost.image || null,
                    linkPreview: sourcePost.linkPreview || null,
                    timestamp: sourcePost.timestamp
                }
            };
            
            await push(ref(db, 'posts'), newPost);
            closeModal();
        } catch (e) {
            console.error("Repost failed", e);
        }
      }
    });
  };

  const toggleComments = (postId) => {
    if (activeCommentPostId === postId) {
      setActiveCommentPostId(null);
    } else {
      setActiveCommentPostId(postId);
    }
  };

  const handleSubmitComment = async (postId) => {
    if (!commentText.trim()) return;
    if (!user) return showModal({ message: "Please login to comment!", title: "Login Required" });

    try {
      // Add comment to subcollection
      await push(ref(db, `posts/${postId}/comments_list`), {
        text: commentText,
        author: user.displayName || 'Anonymous Capy',
        authorId: user.uid,
        avatar: user.photoURL || null,
        timestamp: serverTimestamp()
      });

      // Update comment count
      runTransaction(ref(db, `posts/${postId}`), (post) => {
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

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/image\/(jpeg|jpg|png|gif|webp)/)) {
      showModal({ message: "Only .jpg, .png, .gif, .webp formats are allowed!", title: "Invalid File" });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      showModal({ message: "File size must be less than 5MB!", title: "File Too Large" });
      return;
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
    // Clear input to allow selecting the same file again
    e.target.value = null;
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handlePaste = (e) => {
    if (e.clipboardData && e.clipboardData.items) {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = items[i].getAsFile();
          
          // Validate file type
          if (!file.type.match(/image\/(jpeg|jpg|png|gif|webp)/)) {
            showModal({ message: "Only .jpg, .png, .gif, .webp formats are allowed!", title: "Invalid File" });
            return;
          }
          
          // Validate file size (5MB)
          if (file.size > 5 * 1024 * 1024) {
            showModal({ message: "File size must be less than 5MB!", title: "File Too Large" });
            return;
          }

          setSelectedImage(file);
          setImagePreview(URL.createObjectURL(file));
          return;
        }
      }
    }
  };

  const handlePostSubmit = async () => {
    if (!newPostContent.trim() && !selectedImage) return;
    
    setIsUploading(true);
    try {
      let uploadedImageUrl = null;
      let uploadedImageDeleteUrl = null;

      if (selectedImage) {
        const uploadData = await uploadToImgBB(selectedImage);
        uploadedImageUrl = uploadData.url;
        uploadedImageDeleteUrl = uploadData.deleteUrl;
      }

      const newPost = {
        content: newPostContent,
        author: user?.displayName || 'Anonymous Capy',
        authorId: user?.uid,
        avatar: user?.photoURL || null,
        role: 'User', // Default role
        timestamp: serverTimestamp(),
        likes: 0,
        comments: 0,
        shares: 0,
        privacy: postPrivacy,
        image: uploadedImageUrl,
        imageDeleteUrl: uploadedImageDeleteUrl
      };

      if (showLinkPreview && linkPreviewData) {
        newPost.linkPreview = linkPreviewData;
        
        // Remove the URL from the content text so it's not duplicated
        // We escape the URL string to safely use it in regex
        const escapedUrl = linkPreviewData.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const urlRegex = new RegExp(escapedUrl, 'g');
        newPost.content = newPost.content.replace(urlRegex, '').trim();
      }

      await push(ref(db, 'posts'), newPost);
      setNewPostContent('');
      setShowLinkPreview(false);
      setLinkPreviewData(null);
      setSelectedImage(null);
      setImagePreview(null);
    } catch (error) {
      console.error("Error creating post:", error);
      showModal({ message: "Failed to create post. Please try again.", title: "Error" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSavePost = async (postId) => {
    if (!user) return showModal({ message: "Please login to save posts!", title: "Login Required" });
    
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
      showModal({ message: "Failed to save/unsave post.", title: "Error" });
    }
  };

  const handleEditClick = (post) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
    setOpenDropdownId(null);
  };

  const handleSaveEdit = async (postId) => {
    if (!editContent.trim()) return;
    try {
      await update(ref(db, `posts/${postId}`), {
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

  const handleDeleteClick = (post) => {
    setOpenDropdownId(null);
    showModal({
      type: 'confirm',
      title: 'Delete Chirp',
      message: "Are you sure you want to delete this post?",
      onConfirm: async () => {
        try {
          // Delete image from ImgBB if it exists
          if (post.imageDeleteUrl) {
            await deleteFromImgBB(post.imageDeleteUrl);
          }

          await remove(ref(db, `posts/${post.id}`));
          
          // Decrement share count if it's a repost
          if (post.repostOf) {
            const sharesRef = ref(db, `posts/${post.repostOf}/shares`);
            runTransaction(sharesRef, (current) => {
              return (current && current > 0) ? current - 1 : 0;
            });
          }

          closeModal();
        } catch (error) {
          console.error("Error deleting post:", error);
          showModal({ message: "Failed to delete post.", title: "Error" });
        }
      }
    });
  };

  // Comment Actions
  const handleEditCommentClick = (comment) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.text);
    setOpenCommentDropdownId(null);
  };

  const handleSaveEditComment = async (postId, commentId) => {
    if (!editCommentText.trim()) return;
    try {
      await update(ref(db, `posts/${postId}/comments_list/${commentId}`), {
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

  const handleDeleteCommentClick = (postId, commentId) => {
    setOpenCommentDropdownId(null);
    showModal({
      type: 'confirm',
      title: 'Delete Comment',
      message: "Are you sure you want to delete this comment?",
      onConfirm: async () => {
        try {
          await remove(ref(db, `posts/${postId}/comments_list/${commentId}`));
          // Update comment count
          runTransaction(ref(db, `posts/${postId}`), (post) => {
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

  const toggleDropdown = (postId) => {
    setOpenDropdownId(openDropdownId === postId ? null : postId);
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
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> 
    },
  ];

  const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes} min. ago`;
    if (hours < 24) return `${hours} hr. ago`;
    return `${days} days ago`;
  };

  const displayedPosts = posts.filter(post => {
    // 1. Filter by Trend
    if (selectedTrend && (!post.content || !post.content.includes(selectedTrend))) return false;

    // 2. Filter by Privacy
    if (!post.privacy || post.privacy === 'world') return true; // Public
    
    // If private/friends, must be logged in to potentially see it
    if (!user) return false;
    
    // I can always see my own posts
    if (post.authorId === user.uid) return true;

    // Self only
    if (post.privacy === 'self') return false;

    // Cappies (Friends) only
    if (post.privacy === 'cappies') {
      // Visible if author is in my friends list
      return myFriends[post.authorId];
    }

    return true;
  }).sort((a, b) => {
    if (selectedTrend) {
      return (b.score || 0) - (a.score || 0);
    }
    return 0; // Already sorted by timestamp in fetch
  });

  return (
    <div className="capy-home-container page-transition">
      {/* Left Sidebar */}
      <aside className="home-sidebar left-sidebar">
        <div className="sidebar-menu">
          {menuItems.map((item) => (
            <div 
              key={item.label}
              className={`sidebar-item ${activeTab === item.label ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(item.label);
                if (item.label === 'CapyHome') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else if (item.label === 'Connections') {
                  navigate('/connections');
                } else if (item.label === 'CapyDEVS') {
                  navigate('/devs');
                }
              }}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Center Feed */}
      <main className="home-feed">
        {/* Create Post Input */}
        <div className="create-post-card capy-card">
          <div className="create-post-top">
            {user?.photoURL ? (
              <img 
                src={user.photoURL} 
                alt="Me" 
                className="user-avatar-small" 
              />
            ) : (
              <InitialsAvatar 
                name={user?.displayName || user?.email} 
                uid={user?.uid} 
                className="user-avatar-small"
                size={40}
                fontSize="16px"
              />
            )}
            <input 
              type="text"  
              placeholder="What's on your mind, Capy? Use #hashtags to trend!" 
              className="create-post-input"
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePostSubmit()}
              onPaste={handlePaste}
            />
          </div>

          {/* Image Preview Area */}
          {imagePreview && (
            <div className="image-preview-area">
              <img src={imagePreview} alt="Preview" className="image-preview-img" />
              <button className="remove-image-btn" onClick={removeSelectedImage}>×</button>
            </div>
          )}

          {/* Link Preview Area */}
          {showLinkPreview && (
            <div className="link-preview-area">
              {isGeneratingPreview ? (
                 <div className="preview-skeleton">
                   <div className="skeleton-line"></div>
                   <div className="skeleton-line short"></div>
                 </div>
              ) : linkPreviewData ? (
                <div className="preview-card-mini">
                  {linkPreviewData.image && <img src={linkPreviewData.image} alt="Preview" className="preview-img-mini" />}
                  <div className="preview-info-mini">
                    <span className="preview-title-mini">{linkPreviewData.title}</span>
                    <span className="preview-source-mini">{linkPreviewData.source}</span>
                  </div>
                </div>
              ) : (
                <div className="preview-placeholder">
                  Type a URL to generate a preview...
                </div>
              )}
            </div>
          )}

          <div className="create-post-actions">
            <div className="privacy-selector-container">
              <button 
                className="privacy-btn" 
                onClick={() => setShowPrivacyMenu(!showPrivacyMenu)}
                title="Post Privacy"
              >
                {postPrivacy === 'world' && (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="2" y1="12" x2="22" y2="12"></line>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                    World
                  </>
                )}
                {postPrivacy === 'cappies' && (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    Connections
                  </>
                )}
                {postPrivacy === 'self' && (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    Self
                  </>
                )}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dropdown-arrow-icon">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              {showPrivacyMenu && (
                <div className="privacy-menu">
                  <button onClick={() => { setPostPrivacy('world'); setShowPrivacyMenu(false); }} className={postPrivacy === 'world' ? 'active' : ''}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="2" y1="12" x2="22" y2="12"></line>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                    World (Public)
                  </button>
                  <button onClick={() => { setPostPrivacy('cappies'); setShowPrivacyMenu(false); }} className={postPrivacy === 'cappies' ? 'active' : ''}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    Connections
                  </button>
                  <button onClick={() => { setPostPrivacy('self'); setShowPrivacyMenu(false); }} className={postPrivacy === 'self' ? 'active' : ''}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    Self (Private)
                  </button>
                </div>
              )}
            </div>

            <button 
              className={`post-action-btn ${showLinkPreview ? 'active' : ''}`}
              onClick={() => setShowLinkPreview(!showLinkPreview)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
              Web Link
            </button>
            <input 
              type="file" 
              id="image-upload" 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={handleImageSelect}
            />
            <button 
              className={`post-action-btn ${selectedImage ? 'active' : ''}`}
              onClick={() => document.getElementById('image-upload').click()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              Photo/GIF
            </button>
            <button 
              className="post-action-btn post-submit-btn" 
              onClick={handlePostSubmit} 
              disabled={isUploading}
            >
              {isUploading ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>

        {/* Active Trend Banner */}
        {selectedTrend && (
          <div className="active-trend-banner">
             <div className="trend-info">
               <span className="trend-label">Trending Now</span>
               <h2 className="trend-tag">{selectedTrend}</h2>
             </div>
             <button className="clear-trend-btn" onClick={() => setSelectedTrend(null)}>
               Show All Posts
             </button>
          </div>
        )}

        {/* Real Posts */}
        {displayedPosts.length === 0 ? (
          <div className="no-posts" style={{ textAlign: 'center', padding: '20px', color: 'var(--capy-text-secondary)' }}>
            {selectedTrend ? `No posts found for ${selectedTrend}` : 'No posts yet. Be the first to chirp!'}
          </div>
        ) : (
          displayedPosts.map((post, index) => (
            <div 
              key={post.id} 
              className="post-card capy-card"
              style={{ animation: `slideUp 0.5s ease-out ${index * 0.1}s backwards` }}
            >
              <div className="post-header">
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
                    size={40}
                  />
                )}
                <div className="post-info">
                  <span className="post-author">{post.author}</span>
                  <span className="post-separator">•</span>
                  <span className="post-time">
                    {getRelativeTime(post.timestamp)}
                    {post.privacy === 'cappies' && <span title="Friends Only" style={{marginLeft: '4px'}}>🐾</span>}
                    {post.privacy === 'self' && <span title="Private" style={{marginLeft: '4px'}}>🔒</span>}
                    {post.isEdited && <span className="edited-label"> - edited</span>}
                  </span>
                </div>
                
                {/* Options Menu - Only for Author */}
                {user && user.uid === post.authorId && (
                  <div className="post-options-container">
                    <button 
                      className="post-options" 
                      onClick={() => toggleDropdown(post.id)}
                    >
                      •••
                    </button>
                    {openDropdownId === post.id && (
                      <div className="options-dropdown">
                        <button onClick={() => handleEditClick(post)}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                          Edit
                        </button>
                        <button onClick={() => handleDeleteClick(post)} className="delete-option">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                          Delete
                        </button>
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
                      <button onClick={() => handleSaveEdit(post.id)} className="save-btn">Save</button>
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
                           {post.repostData.image && (
                              <div className="post-image-container-mini">
                                <img src={post.repostData.image} alt="Repost content" className="post-image" />
                              </div>
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
              
              {post.image && (
                <div className="post-image-container">
                  <img src={post.image} alt="Post content" className="post-image" />
                </div>
              )}
              
              <div className="post-actions">
                <button 
                  className={`action-btn like-btn ${post.userVotes && post.userVotes[user?.uid] === 1 ? 'active' : ''}`}
                  onClick={() => handleVote(post.id, 1)}
                  title="Like"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={post.userVotes && post.userVotes[user?.uid] === 1 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                  </svg>
                  <span>{post.score || 0}</span>
                </button>

                <button 
                  className={`action-btn dislike-btn ${post.userVotes && post.userVotes[user?.uid] === -1 ? 'active' : ''}`}
                  onClick={() => handleVote(post.id, -1)}
                  title="Dislike"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>

                <button className="action-btn comment-btn" onClick={() => toggleComments(post.id)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                  </svg>
                  <span>{post.comments > 0 ? post.comments : 'Comment'}</span>
                </button>

                <button className="action-btn repost-btn" onClick={() => handleRepost(post)}>
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
                  onClick={() => handleSavePost(post.id)}
                  title={savedPosts[post.id] ? "Unsave" : "Save"}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={savedPosts[post.id] ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                  </svg>
                </button>
              </div>

              {/* Comments Section */}
              {activeCommentPostId === post.id && (
                <div className="comments-section">
                  <div className="comments-list">
                    {commentsData[post.id] && commentsData[post.id].length > 0 ? (
                      commentsData[post.id].map(comment => (
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
                                    if (e.key === 'Enter') handleSaveEditComment(post.id, comment.id);
                                    if (e.key === 'Escape') setEditingCommentId(null);
                                  }}
                                />
                                <div className="edit-comment-actions">
                                  <button onClick={() => handleSaveEditComment(post.id, comment.id)} className="save-btn-mini">Save</button>
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
                                          <button className="delete-option" onClick={() => handleDeleteCommentClick(post.id, comment.id)}>Delete</button>
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
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment(post.id)}
                      className="comment-input"
                    />
                    <button onClick={() => handleSubmitComment(post.id)} className="comment-submit-btn">
                      ➤
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </main>

      {/* Right Sidebar */}
      <aside className="home-sidebar right-sidebar">
        <div className="sidebar-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="sidebar-title" style={{ margin: 0 }}>Hacker News</h3>
            <span style={{ fontSize: '12px', color: 'var(--capy-text-secondary)' }}>
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          {loadingNews && news.length === 0 ? (
            <p className="loading-text">Fetching latest intel...</p>
          ) : (
            <>
              {news.slice(0, newsLimit).map(item => (
                <div key={item.id} className="news-item">
                  <span className="news-icon">📰</span>
                  <div className="news-content" style={{ textAlign: 'left' }}>
                    <h4>
                      <a href={item.url || `https://news.ycombinator.com/item?id=${item.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                        {item.title}
                      </a>
                    </h4>
                    <p style={{ fontSize: '11px', color: 'var(--capy-text-secondary)' }}>
                      <a href={`https://news.ycombinator.com/item?id=${item.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--capy-accent)' }}>Discuss</a>
                    </p>
                  </div>
                </div>
              ))}
              
              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '12px', borderTop: '1px solid var(--capy-border)', paddingTop: '8px' }}>
                <button 
                  onClick={() => setNewsLimit(prev => Math.max(3, prev - 3))}
                  style={{ background: 'transparent', border: 'none', color: 'var(--capy-text-secondary)', cursor: 'pointer', opacity: newsLimit <= 3 ? 0.3 : 1 }}
                  disabled={newsLimit <= 3}
                  title="Show Less"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15"></polyline>
                  </svg>
                </button>
                <button 
                  onClick={() => setNewsLimit(prev => prev + 3)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--capy-text-secondary)', cursor: 'pointer', opacity: newsLimit >= newsIds.length ? 0.3 : 1 }}
                  disabled={newsLimit >= newsIds.length}
                  title="Show More"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>
            </>
          )}
          {!loadingNews && news.length === 0 && (
             <p className="loading-text">No news available.</p>
          )}
        </div>

        <div className="sidebar-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="sidebar-title" style={{ margin: 0 }}>Trending Topics</h3>
            <span style={{ fontSize: '12px', color: 'var(--capy-text-secondary)' }}>
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <div className="trend-timeframe-selector" style={{ display: 'flex', gap: '8px', marginBottom: '16px', fontSize: '12px' }}>
            {['Daily', 'Weekly', 'Monthly', 'Yearly'].map((tf) => (
              <button 
                key={tf}
                onClick={() => setTrendTimeframe(tf.toLowerCase())}
                style={{
                   background: trendTimeframe === tf.toLowerCase() ? 'var(--capy-accent)' : 'transparent',
                   color: trendTimeframe === tf.toLowerCase() ? '#fff' : 'var(--capy-text-secondary)',
                   border: 'none',
                   padding: '4px 8px',
                   borderRadius: '12px',
                   cursor: 'pointer',
                   fontWeight: trendTimeframe === tf.toLowerCase() ? 'bold' : 'normal',
                   transition: 'all 0.2s'
                }}
              >
                {tf}
              </button>
            ))}
          </div>

          {trends.length > 0 ? (
            <>
              {trends.slice(0, trendLimit).map((trend, index) => (
                <div 
                  key={index} 
                  className={`trending-item ${selectedTrend === trend.tag ? 'active' : ''}`}
                  onClick={() => handleTrendClick(trend.tag)}
                >
                  <span className="hashtag">{trend.tag}</span>
                  <span className="post-count">{trend.count} posts</span>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '12px', borderTop: '1px solid var(--capy-border)', paddingTop: '8px' }}>
                <button 
                  onClick={() => setTrendLimit(prev => Math.max(3, prev - 3))}
                  style={{ background: 'transparent', border: 'none', color: 'var(--capy-text-secondary)', cursor: 'pointer', opacity: trendLimit <= 3 ? 0.3 : 1 }}
                  disabled={trendLimit <= 3}
                  title="Show Less"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15"></polyline>
                  </svg>
                </button>
                <button 
                  onClick={() => setTrendLimit(prev => prev + 3)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--capy-text-secondary)', cursor: 'pointer', opacity: trendLimit >= trends.length ? 0.3 : 1 }}
                  disabled={trendLimit >= trends.length}
                  title="Show More"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <div className="trending-item">
              <span className="hashtag">--</span>
              <span className="post-count">No trends yet</span>
            </div>
          )}
        </div>
      </aside>
      
      {/* Floating Action Button */}
      <button className="fab-create" onClick={() => document.querySelector('.create-post-input').focus()}>
        <span>+</span>
      </button>

      <CapyModal {...modalConfig} onClose={closeModal} />
    </div>
  );
};

export default CapyHome;
