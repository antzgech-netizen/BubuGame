import React, { useState, useEffect, useRef } from 'react';
import './ChatBox.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function ChatBox({ user, onClose, onNewMessage }) {
  const [view, setView] = useState('conversations'); // 'conversations' or 'chat'
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (view === 'conversations') {
      fetchConversations();
      const interval = setInterval(fetchConversations, 3000);
      return () => clearInterval(interval);
    }
  }, [view]);

  useEffect(() => {
    if (view === 'chat' && selectedUser) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 2000);
      return () => clearInterval(interval);
    }
  }, [view, selectedUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('game_token')}`
  });

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

  const fetchAvailableUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/gebeta/players`, {
        headers: getAuthHeaders()
      });
      
      if (res.ok) {
        const data = await res.json();
        setAvailableUsers(data.players || []);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
    }
  };

  const fetchMessages = async () => {
    if (!selectedUser) return;

    try {
      const res = await fetch(`${API_URL}/api/chat/messages/${selectedUser.id}`, {
        headers: getAuthHeaders()
      });

      if (res.ok) {
        const data = await res.json();
        const prevLength = messages.length;
        setMessages(data.messages || []);
        
        if (data.messages && data.messages.length > prevLength) {
          const lastMessage = data.messages[data.messages.length - 1];
          if (lastMessage.sender_id !== user.id) {
            onNewMessage?.();
          }
        }
      }
    } catch (err) {
      console.error('Fetch messages error:', err);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedUser) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/chat/send`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          recipientId: selectedUser.id,
          message: newMessage.trim() 
        })
      });

      if (res.ok) {
        setNewMessage('');
        fetchMessages();
      }
    } catch (err) {
      console.error('Send message error:', err);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = (userToChat) => {
    setSelectedUser(userToChat);
    setView('chat');
    setShowNewChat(false);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  };

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="whatsapp-chat-box">
      {/* Header */}
      <div className="whatsapp-header">
        {view === 'chat' && (
          <button className="back-arrow" onClick={() => {
            setView('conversations');
            setSelectedUser(null);
          }}>
            ←
          </button>
        )}
        <h3>
          {view === 'conversations' ? '💬 Chats' : selectedUser?.username}
        </h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      {/* Conversations List */}
      {view === 'conversations' && (
        <div className="conversations-view">
          <button 
            className="new-chat-btn"
            onClick={() => {
              setShowNewChat(true);
              fetchAvailableUsers();
            }}
          >
            + New Chat
          </button>

          {showNewChat && (
            <div className="new-chat-panel">
              <h4>Start a new chat</h4>
              <div className="users-list">
                {availableUsers.map(u => (
                  <div 
                    key={u.id} 
                    className="user-item"
                    onClick={() => startNewChat(u)}
                  >
                    <div className="user-avatar">👤</div>
                    <div className="user-name">{u.username}</div>
                  </div>
                ))}
              </div>
              <button className="cancel-btn" onClick={() => setShowNewChat(false)}>
                Cancel
              </button>
            </div>
          )}

          {!showNewChat && (
            <div className="conversations-list">
              {conversations.length === 0 ? (
                <div className="no-conversations">
                  <p>👋 No chats yet</p>
                  <p>Click "+ New Chat" to start!</p>
                </div>
              ) : (
                conversations.map((conv, index) => (
                  <div
                    key={index}
                    className="conversation-item"
                    onClick={() => {
                      setSelectedUser({
                        id: conv.other_user_id,
                        username: conv.other_username
                      });
                      setView('chat');
                    }}
                  >
                    <div className="conversation-avatar">👤</div>
                    <div className="conversation-info">
                      <div className="conversation-header">
                        <span className="conversation-name">{conv.other_username}</span>
                        <span className="conversation-time">
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>
                      <div className="conversation-preview">
                        {conv.last_message || 'No messages yet'}
                      </div>
                    </div>
                    {conv.unread_count > 0 && (
                      <div className="unread-badge">{conv.unread_count}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Chat View */}
      {view === 'chat' && selectedUser && (
        <>
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="no-messages">
                <p>👋 Start your conversation!</p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isOwn = msg.sender_id === user.id;
                const showDate = index === 0 || 
                  new Date(messages[index - 1].created_at).toDateString() !== 
                  new Date(msg.created_at).toDateString();

                return (
                  <React.Fragment key={index}>
                    {showDate && (
                      <div className="date-divider">
                        {new Date(msg.created_at).toLocaleDateString()}
                      </div>
                    )}
                    <div className={`message-bubble ${isOwn ? 'own' : 'other'}`}>
                      <div className="message-text">{msg.message}</div>
                      <div className="message-time">
                        {formatMessageTime(msg.created_at)}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="chat-input-form">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              disabled={loading}
              className="chat-input"
            />
            <button 
              type="submit" 
              disabled={loading || !newMessage.trim()} 
              className="send-btn"
            >
              {loading ? '⏳' : '📤'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
