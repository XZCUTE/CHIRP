import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Activities.css';

const Activities = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [events, setEvents] = useState([]);
  const [dailyChallenge, setDailyChallenge] = useState(null);

  // Sidebar items (matching other pages)
  const sidebarItems = [
    { label: 'CapyHome', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg> },
    { label: 'Connections', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> },
    { label: 'CapyDEVS', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg> },
    { label: 'CapyTips', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg> },
    { label: 'Reels', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg> },
    { label: 'Activities', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> },
    { label: 'Learn', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10v6"></path><path d="M20 16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8c0-1.1.9-2 2-2h12a2 2 0 0 1 2 2v8Z"></path><path d="M10 12h4"></path></svg> },
    { label: 'Offers', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg> },
    { label: 'CHIRPY', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> },
    { label: 'Squads', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> },
    { label: 'Play', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"></rect><path d="M6 12h4"></path><path d="M8 10v4"></path><circle cx="17" cy="12" r="1.5"></circle></svg> },
    { label: 'Settings', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> }
  ];

  const handleSidebarClick = (item) => {
    if (item.label === 'CapyHome') navigate('/home');
    else if (item.label === 'Connections') navigate('/connections');
    else if (item.label === 'CapyDEVS') navigate('/devs');
    else if (item.label === 'CapyTips') navigate('/tips');
    else if (item.label === 'Reels') navigate('/reels');
    else if (item.label === 'Activities') navigate('/activities');
    else if (item.label === 'Learn') navigate('/learn');
    else if (item.label === 'Offers') navigate('/offers');
    else if (item.label === 'CHIRPY') navigate('/chirpy'); // Assuming route exists
    else if (item.label === 'Squads') navigate('/squads');
    else if (item.label === 'Play') navigate('/play');
    else if (item.label === 'Settings') navigate('/settings');
  };

  useEffect(() => {
    // Mock Data Fetching
    const fetchActivities = async () => {
      // In a real app, this would fetch from Firebase
      const mockEvents = [
        {
          id: 1,
          title: "Global Cyber CTF 2025",
          type: "ctf",
          date: "2026-02-15T10:00:00",
          description: "Join the biggest Capture The Flag event of the year. Teams of 4. Prizes up to $10k.",
          image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=500&q=60",
          attendees: 1240
        },
        {
          id: 2,
          title: "Secure Coding Webinar",
          type: "webinar",
          date: "2026-02-05T18:00:00",
          description: "Live stream with industry experts on preventing SQL injection and XSS.",
          image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=500&q=60",
          attendees: 450
        },
        {
          id: 3,
          title: "Capy Meetup: Tokyo",
          type: "meetup",
          date: "2026-02-20T19:00:00",
          description: "Local community meetup in Shibuya. Free pizza and networking.",
          image: "https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=500&q=60",
          attendees: 85
        },
        {
          id: 4,
          title: "Midnight Hackathon",
          type: "hackathon",
          date: "2026-02-10T22:00:00",
          description: "24-hour virtual hackathon. Build something awesome using the Chirp API.",
          image: "https://images.unsplash.com/photo-1504384308090-c54be3855833?auto=format&fit=crop&w=500&q=60",
          attendees: 300
        }
      ];

      const mockChallenge = {
        id: 101,
        title: "Daily Challenge: Buffer Overflow",
        description: "Identify the vulnerability in this C code snippet and patch it.",
        difficulty: "Medium",
        points: 50,
        completed: false
      };

      setEvents(mockEvents);
      setDailyChallenge(mockChallenge);
    };

    fetchActivities();
  }, []);

  const formatDate = (dateString) => {
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const getFilteredEvents = () => {
    if (activeTab === 'all') return events;
    return events.filter(event => event.type === activeTab);
  };

  return (
    <div className="activities-page-wrapper">
      {/* Sidebar */}
      <aside className="activities-sidebar">
        <div className="sidebar-menu">
          {sidebarItems.map((item, index) => (
            <div 
              key={index} 
              className={`sidebar-item ${item.label === 'Activities' ? 'active' : ''}`}
              onClick={() => handleSidebarClick(item)}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="activities-content">
        <header className="activities-header">
          <h1>Events & Hackathons</h1>
          <p>Join the community, test your skills, and learn together.</p>
        </header>

        {/* Daily Challenge Section */}
        {dailyChallenge && (
          <section className="daily-challenge-section">
            <div className="challenge-card">
              <div className="challenge-header">
                <span className="challenge-badge">Daily Challenge</span>
                <span className={`difficulty-badge ${dailyChallenge.difficulty.toLowerCase()}`}>{dailyChallenge.difficulty}</span>
              </div>
              <h2>{dailyChallenge.title}</h2>
              <p>{dailyChallenge.description}</p>
              <div className="challenge-footer">
                <span className="points">+{dailyChallenge.points} XP</span>
                <button className="start-challenge-btn">Start Challenge</button>
              </div>
            </div>
          </section>
        )}

        {/* Filters */}
        <div className="activities-tabs">
          {['all', 'ctf', 'webinar', 'meetup', 'hackathon'].map(tab => (
            <button 
              key={tab} 
              className={`activity-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Events Grid */}
        <div className="events-grid">
          {getFilteredEvents().map(event => (
            <div key={event.id} className="event-card">
              <div className="event-image-wrapper">
                <img src={event.image} alt={event.title} className="event-image" />
                <div className="event-type-overlay">{event.type.toUpperCase()}</div>
              </div>
              <div className="event-details">
                <div className="event-date">{formatDate(event.date)}</div>
                <h3 className="event-title">{event.title}</h3>
                <p className="event-description">{event.description}</p>
                <div className="event-footer">
                  <div className="attendees-count">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    {event.attendees} Joining
                  </div>
                  <button className="join-btn">Register</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Activities;