import React, { useState, useEffect, useRef } from 'react';
import './WhatsAppStyle.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function WhatsAppStyle({ user, onClose }) {
  const [view, setView] = useState('chats'); // 'chats', 'chat', 'calls', 'contacts'
  const [conversations, setConversations] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [callHistory, setCallHistory] = useState([]);
  
  // Voice call states
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callTimerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    loadAllContacts();
    fetchConversations();
    fetchCallHistory();
    updateOnlineStatus();
    
    const conversationInterval = setInterval(fetchConversations, 2000);
    const onlineInterval = setInterval(updateOnlineStatus, 5000);
    const callCheckInterval = setInterval(checkIncomingCalls, 2000);
    
    return () => {
      clearInterval(conversationInterval);
      clearInterval(onlineInterval);
      clearInterval(callCheckInterval);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      endCall();
    };
  }, []);

  useEffect(() => {
    if (view === 'chat' && selectedContact) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 2000);
      return () => clearInterval(interval);
    }
  }, [view, selectedContact]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Calculate total unread
    const total = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
    setTotalUnread(total);
  }, [conversations]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('game_token')}`
  });

  const loadAllContacts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/contacts/all`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAllContacts(data.contacts || []);
      }
    } catch (err) {
      console.error('Load contacts error:', err);
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await fetch(`${API_URL}/api/chat/conversations`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Fetch conversations error:', err);
    }
  };

  const fetchMessages = async () => {
    if (!selectedContact) return;
    try {
      const res = await fetch(`${API_URL}/api/chat/messages/${selectedContact.id}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        markAsRead(selectedContact.id);
      }
    } catch (err) {
      console.error('Fetch messages error:', err);
    }
  };

  const markAsRead = async (contactId) => {
    try {
      await fetch(`${API_URL}/api/chat/mark-read/${contactId}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch (err) {
      console.error('Mark as read error:', err);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedContact) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/chat/send`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          recipientId: selectedContact.id,
          message: newMessage.trim() 
        })
      });
      if (res.ok) {
        setNewMessage('');
        fetchMessages();
        fetchConversations();
      }
    } catch (err) {
      console.error('Send message error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateOnlineStatus = async () => {
    try {
      // Send heartbeat
      await fetch(`${API_URL}/api/user/heartbeat`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      // Get online users
      const res = await fetch(`${API_URL}/api/user/online`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setOnlineUsers(new Set(data.onlineUserIds || []));
      }
    } catch (err) {
      console.error('Update online status error:', err);
    }
  };

  const fetchCallHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/voice/history`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setCallHistory(data.calls || []);
      }
    } catch (err) {
      console.error('Fetch call history error:', err);
    }
  };

  const checkIncomingCalls = async () => {
    if (isCallActive) return;
    try {
      const res = await fetch(`${API_URL}/api/voice/check-call`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.call) {
        setIncomingCall(data.call);
        playRingtone();
        // Show notification
        showNotification('Incoming Call', `${data.call.fromUsername} is calling...`);
      }
    } catch (err) {
      // Silent fail
    }
  };

  const showNotification = (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '🎮' });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { body, icon: '🎮' });
        }
      });
    }
  };

  const playRingtone = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 440;
      gainNode.gain.value = 0.2;
      oscillator.start();
      setTimeout(() => oscillator.stop(), 800);
    } catch (err) {
      console.error('Ringtone error:', err);
    }
  };

  const startCall = async (contact) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }, 
        video: false 
      });
      
      localStreamRef.current = stream;
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
      }

      const pc = setupPeerConnection();
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await fetch(`${API_URL}/api/voice/call`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          toUserId: contact.id,
          offer: offer
        })
      });

      setActiveCall({ contact, status: 'calling' });
      checkCallStatus();
    } catch (err) {
      console.error('Start call error:', err);
      alert('Failed to start call. Please check microphone permissions.');
    }
  };

  const setupPeerConnection = () => {
    const pc = new RTCPeerConnection(iceServers);
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 ICE candidate generated');
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setIsCallActive(true);
        setActiveCall(prev => ({ ...prev, status: 'connected' }));
        startCallTimer();
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        endCall();
      }
    };

    pc.ontrack = (event) => {
      remoteStreamRef.current = event.streams[0];
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(err => console.log('Autoplay prevented'));
      }
    };

    return pc;
  };

  const startCallTimer = () => {
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const checkCallStatus = async () => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/voice/call-status`, {
          headers: getAuthHeaders()
        });
        const data = await res.json();

        if (data.status === 'accepted' && data.answer) {
          clearInterval(interval);
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
        } else if (data.status === 'declined') {
          clearInterval(interval);
          endCall();
        }
      } catch (err) {
        console.error('Check status error:', err);
      }
    }, 1000);

    setTimeout(() => clearInterval(interval), 30000);
  };

  const answerCall = async () => {
    if (!incomingCall) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }, 
        video: false 
      });
      
      localStreamRef.current = stream;
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
      }

      const pc = setupPeerConnection();
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      await pc.setRemoteDescription(
        new RTCSessionDescription(incomingCall.offer)
      );

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await fetch(`${API_URL}/api/voice/answer`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          callId: incomingCall.id,
          answer: answer
        })
      });

      setActiveCall({ 
        contact: { 
          id: incomingCall.fromUserId,
          username: incomingCall.fromUsername 
        }, 
        status: 'connected' 
      });
      setIncomingCall(null);
    } catch (err) {
      console.error('Answer error:', err);
      alert('Failed to answer call. Please check microphone permissions.');
      setIncomingCall(null);
    }
  };

  const declineCall = async () => {
    if (!incomingCall) return;
    try {
      await fetch(`${API_URL}/api/voice/decline`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ callId: incomingCall.id })
      });
      setIncomingCall(null);
    } catch (err) {
      console.error('Decline error:', err);
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const endCall = async () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (localAudioRef.current) localAudioRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    try {
      await fetch(`${API_URL}/api/voice/end-call`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch (err) {
      // Silent fail
    }

    setIsCallActive(false);
    setIsMuted(false);
    setActiveCall(null);
    setCallDuration(0);
    fetchCallHistory();
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString();
  };

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatCallDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const openChat = (contact) => {
    setSelectedContact(contact);
    setView('chat');
  };

  return (
    <div className="whatsapp-container">
      {/* Incoming Call Overlay */}
      {incomingCall && (
        <div className="incoming-call-overlay">
          <div className="incoming-call-popup">
            <div className="caller-avatar">📞</div>
            <h2>{incomingCall.fromUsername}</h2>
            <p>WhatsApp Voice Call</p>
            <div className="incoming-call-actions">
              <button className="decline-call-btn" onClick={declineCall}>
                <span className="call-icon">📵</span>
                Decline
              </button>
              <button className="accept-call-btn" onClick={answerCall}>
                <span className="call-icon">📞</span>
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Call Overlay */}
      {activeCall && (
        <div className="active-call-overlay">
          <div className="active-call-popup">
            <div className="call-avatar">👤</div>
            <h2>{activeCall.contact.username}</h2>
            <p className="call-status">
              {activeCall.status === 'calling' ? 'Calling...' : 
               activeCall.status === 'connected' ? formatCallDuration(callDuration) : 'Connecting...'}
            </p>
            <div className="call-controls">
              <button 
                className={`call-control-btn ${isMuted ? 'active' : ''}`}
                onClick={toggleMute}
              >
                {isMuted ? '🔇' : '🎤'}
              </button>
              <button className="end-call-btn-round" onClick={endCall}>
                📞
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="whatsapp-header">
        <h3>WhatsApp</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      {/* Navigation Tabs */}
      <div className="whatsapp-tabs">
        <button 
          className={`tab ${view === 'chats' ? 'active' : ''}`}
          onClick={() => setView('chats')}
        >
          💬 Chats
          {totalUnread > 0 && (
            <span className="tab-badge">{totalUnread}</span>
          )}
        </button>
        <button 
          className={`tab ${view === 'calls' ? 'active' : ''}`}
          onClick={() => setView('calls')}
        >
          📞 Calls
        </button>
        <button 
          className={`tab ${view === 'contacts' ? 'active' : ''}`}
          onClick={() => setView('contacts')}
        >
          👥 Contacts
        </button>
      </div>

      {/* Chats View */}
      {view === 'chats' && !selectedContact && (
        <div className="chats-list">
          {conversations.length === 0 ? (
            <div className="empty-state">
              <p className="empty-icon">💬</p>
              <p>No chats yet</p>
              <p className="empty-hint">Go to Contacts to start chatting</p>
            </div>
          ) : (
            conversations.map((conv, idx) => (
              <div
                key={idx}
                className="chat-item"
                onClick={() => openChat({
                  id: conv.other_user_id,
                  username: conv.other_username
                })}
              >
                <div className="chat-avatar">
                  <span>👤</span>
                  {onlineUsers.has(conv.other_user_id) && (
                    <span className="online-dot"></span>
                  )}
                </div>
                <div className="chat-info">
                  <div className="chat-header">
                    <span className="chat-name">{conv.other_username}</span>
                    <span className="chat-time">{formatTime(conv.last_message_at)}</span>
                  </div>
                  <div className="chat-preview-row">
                    <p className="chat-preview">{conv.last_message || 'No messages'}</p>
                    {conv.unread_count > 0 && (
                      <span className="unread-count">{conv.unread_count}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Chat View */}
      {view === 'chat' && selectedContact && (
        <div className="chat-view">
          <div className="chat-header-bar">
            <button className="back-btn" onClick={() => {
              setView('chats');
              setSelectedContact(null);
            }}>
              ←
            </button>
            <div className="chat-header-info">
              <h4>{selectedContact.username}</h4>
              <p className="online-status">
                {onlineUsers.has(selectedContact.id) ? 'online' : 'offline'}
              </p>
            </div>
            <button 
              className="call-btn"
              onClick={() => startCall(selectedContact)}
            >
              📞
            </button>
          </div>

          <div className="messages-area">
            {messages.map((msg, idx) => {
              const isOwn = msg.sender_id === user.id;
              return (
                <div key={idx} className={`message ${isOwn ? 'own' : 'other'}`}>
                  <div className="message-content">{msg.message}</div>
                  <span className="message-time">{formatMessageTime(msg.created_at)}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <form className="message-input-form" onSubmit={sendMessage}>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message"
              disabled={loading}
            />
            <button type="submit" disabled={loading || !newMessage.trim()}>
              📤
            </button>
          </form>
        </div>
      )}

      {/* Calls View */}
      {view === 'calls' && (
        <div className="calls-list">
          {callHistory.length === 0 ? (
            <div className="empty-state">
              <p className="empty-icon">📞</p>
              <p>No call history</p>
            </div>
          ) : (
            callHistory.map((call, idx) => (
              <div key={idx} className="call-item">
                <div className="call-avatar">📞</div>
                <div className="call-info">
                  <p className="call-name">{call.other_username}</p>
                  <p className="call-details">
                    {call.type === 'incoming' ? '📥' : '📤'} {formatTime(call.created_at)}
                  </p>
                </div>
                <button 
                  className="call-again-btn"
                  onClick={() => startCall({ id: call.other_user_id, username: call.other_username })}
                >
                  📞
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Contacts View */}
      {view === 'contacts' && (
        <div className="contacts-list">
          {allContacts.map((contact) => (
            <div key={contact.id} className="contact-item">
              <div className="contact-avatar">
                <span>👤</span>
                {onlineUsers.has(contact.id) && (
                  <span className="online-dot"></span>
                )}
              </div>
              <div className="contact-info">
                <p className="contact-name">{contact.username}</p>
                <p className="contact-status">
                  {onlineUsers.has(contact.id) ? 'Online' : 'Offline'}
                </p>
              </div>
              <div className="contact-actions">
                <button 
                  className="contact-action-btn"
                  onClick={() => openChat(contact)}
                >
                  💬
                </button>
                <button 
                  className="contact-action-btn"
                  onClick={() => startCall(contact)}
                >
                  📞
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hidden audio elements */}
      <audio ref={localAudioRef} autoPlay muted playsInline style={{ display: 'none' }} />
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
    </div>
  );
}
