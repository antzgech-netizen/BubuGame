import React, { useState, useEffect, useRef } from 'react';
import './VoiceChat.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function VoiceChat({ user, onClose }) {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [callStatus, setCallStatus] = useState('Select someone to call');
  const [incomingCall, setIncomingCall] = useState(null);
  const [connectedUser, setConnectedUser] = useState(null);

  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // ICE servers for WebRTC
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    console.log('🎙️ VoiceChat component mounted! User:', user);
    loadAvailableUsers();
    const interval = setInterval(() => {
      checkIncomingCalls();
    }, 2000);

    return () => {
      console.log('🎙️ VoiceChat component unmounting');
      clearInterval(interval);
      endCall();
    };
  }, []);

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('game_token')}`
  });

  const loadAvailableUsers = async () => {
    try {
      console.log('🔍 Loading players for voice chat...');
      console.log('API URL:', API_URL);
      
      // Use the SAME endpoint as Gebeta game (which works!)
      const res = await fetch(`${API_URL}/api/gebeta/players`, {
        headers: getAuthHeaders()
      });
      
      console.log('Response status:', res.status);
      console.log('Response OK:', res.ok);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Failed to load players:', res.status, errorData);
        setCallStatus(`Failed to load players (${res.status}). Please check login.`);
        return;
      }
      
      const data = await res.json();
      console.log('✅ Players API Response:', data);
      
      if (!data.players) {
        console.error('❌ No players array in response:', data);
        setCallStatus('Invalid response from server');
        return;
      }
      
      // Already filtered by backend (excludes current user)
      const players = data.players || [];
      console.log('📋 Available players:', players);
      
      setAvailableUsers(players);
      
      if (players.length === 0) {
        setCallStatus('No other players found. Create another account to test!');
        console.log('⚠️ No players available. You need to register at least one more user.');
      } else {
        setCallStatus(`${players.length} player(s) available to call`);
        console.log(`✅ ${players.length} player(s) loaded:`, players.map(u => u.username).join(', '));
      }
    } catch (err) {
      console.error('❌ Load players error:', err);
      setCallStatus(`Error: ${err.message}. Check backend is running.`);
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
      }
    } catch (err) {
      console.error('Check calls error:', err);
    }
  };

  const playRingtone = () => {
    // Create a simple ringtone sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 440;
    gainNode.gain.value = 0.3;
    
    oscillator.start();
    setTimeout(() => oscillator.stop(), 1000);
  };

  const startCall = async () => {
    if (!selectedUser) {
      setCallStatus('Please select someone to call');
      return;
    }

    try {
      setCallStatus('Calling...');

      // Get local audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
      }

      // Create peer connection
      const peerConnection = new RTCPeerConnection(iceServers);
      peerConnectionRef.current = peerConnection;

      // Add local stream tracks
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Handle incoming tracks
      peerConnection.ontrack = (event) => {
        remoteStreamRef.current = event.streams[0];
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      // Create and send offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Send call request to server
      await fetch(`${API_URL}/api/voice/call`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          toUserId: selectedUser.id,
          offer: offer
        })
      });

      setCallStatus('Ringing...');
      checkCallStatus();
    } catch (err) {
      console.error('Start call error:', err);
      setCallStatus('Failed to start call. Please check microphone permissions.');
    }
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
          setIsCallActive(true);
          setConnectedUser(selectedUser);
          setCallStatus('Connected');
        } else if (data.status === 'declined') {
          clearInterval(interval);
          endCall();
          setCallStatus('Call declined');
        }
      } catch (err) {
        console.error('Check call status error:', err);
      }
    }, 1000);

    setTimeout(() => clearInterval(interval), 30000); // Stop after 30 seconds
  };

  const answerCall = async () => {
    if (!incomingCall) return;

    try {
      setCallStatus('Connecting...');

      // Get local audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
      }

      // Create peer connection
      const peerConnection = new RTCPeerConnection(iceServers);
      peerConnectionRef.current = peerConnection;

      // Add local stream tracks
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Handle incoming tracks
      peerConnection.ontrack = (event) => {
        remoteStreamRef.current = event.streams[0];
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      // Set remote description and create answer
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(incomingCall.offer)
      );

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // Send answer to server
      await fetch(`${API_URL}/api/voice/answer`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          callId: incomingCall.id,
          answer: answer
        })
      });

      setIsCallActive(true);
      setConnectedUser({ username: incomingCall.fromUsername });
      setIncomingCall(null);
      setCallStatus('Connected');
    } catch (err) {
      console.error('Answer call error:', err);
      setCallStatus('Failed to answer call');
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
      console.error('Decline call error:', err);
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
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    // Notify server
    try {
      await fetch(`${API_URL}/api/voice/end-call`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch (err) {
      console.error('End call error:', err);
    }

    setIsCallActive(false);
    setIsMuted(false);
    setConnectedUser(null);
    setCallStatus('Call ended');
    
    setTimeout(() => {
      setCallStatus('Select someone to call');
    }, 2000);
  };

  return (
    <div className="voice-chat-panel">
      <div className="voice-header">
        <h3>🎙️ Voice Chat</h3>
        <button className="voice-close-btn" onClick={onClose}>×</button>
      </div>

      {/* Incoming Call */}
      {incomingCall && !isCallActive && (
        <div className="incoming-call">
          <div className="caller-icon">📞</div>
          <p className="caller-name">{incomingCall.fromUsername} is calling...</p>
          <div className="call-actions">
            <button className="answer-btn" onClick={answerCall}>
              ✓ Answer
            </button>
            <button className="decline-btn" onClick={declineCall}>
              ✗ Decline
            </button>
          </div>
        </div>
      )}

      {/* Active Call */}
      {isCallActive ? (
        <div className="active-call">
          <div className="call-info">
            <div className="connected-icon">🔊</div>
            <p className="connected-user">{connectedUser?.username}</p>
            <p className="call-duration">{callStatus}</p>
          </div>

          <div className="call-controls">
            <button 
              className={`control-btn ${isMuted ? 'muted' : ''}`}
              onClick={toggleMute}
            >
              {isMuted ? '🔇 Unmute' : '🎤 Mute'}
            </button>
            <button className="end-call-btn" onClick={endCall}>
              📞 End Call
            </button>
          </div>
        </div>
      ) : !incomingCall && (
        <div className="call-setup">
          <p className="status-text">{callStatus}</p>

          <div className="user-select">
            <div className="select-header">
              <label>Call a player:</label>
              <button 
                className="refresh-users-btn"
                onClick={loadAvailableUsers}
                title="Refresh player list"
              >
                🔄
              </button>
            </div>
            <select
              value={selectedUser?.id || ''}
              onChange={(e) => {
                const user = availableUsers.find(u => String(u.id) === e.target.value);
                setSelectedUser(user || null);
                console.log('👤 Selected player:', user);
              }}
            >
              <option value="">
                {availableUsers.length === 0 
                  ? 'No players available' 
                  : `Select from ${availableUsers.length} player(s)`
                }
              </option>
              {availableUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.username}
                </option>
              ))}
            </select>
          </div>

          <button 
            className="start-call-btn" 
            onClick={startCall}
            disabled={!selectedUser}
          >
            📞 Start Call
          </button>
        </div>
      )}

      {/* Hidden audio elements */}
      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />
    </div>
  );
}
