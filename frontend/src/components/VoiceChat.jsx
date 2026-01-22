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
  const [callDuration, setCallDuration] = useState(0);

  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callTimerRef = useRef(null);

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    console.log('🎙️ VoiceChat mounted');
    loadAvailableUsers();
    const interval = setInterval(checkIncomingCalls, 2000);

    return () => {
      clearInterval(interval);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      endCall();
    };
  }, []);

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('game_token')}`
  });

  const loadAvailableUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/gebeta/players`, {
        headers: getAuthHeaders()
      });
      
      if (!res.ok) {
        setCallStatus(`Failed to load players`);
        return;
      }
      
      const data = await res.json();
      const players = data.players || [];
      
      setAvailableUsers(players);
      setCallStatus(players.length === 0 
        ? 'No other players online' 
        : 'Select someone to call'
      );
    } catch (err) {
      console.error('Load players error:', err);
      setCallStatus(`Error loading players`);
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
      // Silent fail
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

  const setupPeerConnection = () => {
    const pc = new RTCPeerConnection(iceServers);
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 ICE candidate generated');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('🔌 Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallStatus('Connected');
        startCallTimer();
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setCallStatus('Connection lost');
        setTimeout(() => endCall(), 2000);
      }
    };

    pc.ontrack = (event) => {
      console.log('🎵 Received remote audio track');
      remoteStreamRef.current = event.streams[0];
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(err => {
          console.log('Autoplay prevented - user interaction needed');
        });
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

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startCall = async () => {
    if (!selectedUser) {
      setCallStatus('Please select someone to call');
      return;
    }

    try {
      setCallStatus('Requesting microphone...');
      
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

      setCallStatus('Setting up call...');
      const pc = setupPeerConnection();
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      setCallStatus('Calling...');
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
      if (err.name === 'NotAllowedError') {
        setCallStatus('Microphone access denied. Please allow microphone access.');
      } else {
        setCallStatus('Failed to start call');
      }
      endCall();
    }
  };

  const checkCallStatus = async () => {
    let attempts = 0;
    const maxAttempts = 30;
    
    const interval = setInterval(async () => {
      attempts++;
      
      if (attempts > maxAttempts) {
        clearInterval(interval);
        setCallStatus('No answer');
        endCall();
        return;
      }

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
          setCallStatus('Connecting...');
        } else if (data.status === 'declined') {
          clearInterval(interval);
          setCallStatus('Call declined');
          endCall();
        }
      } catch (err) {
        console.error('Check status error:', err);
      }
    }, 1000);
  };

  const answerCall = async () => {
    if (!incomingCall) return;

    try {
      setCallStatus('Getting microphone...');
      
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

      setIsCallActive(true);
      setConnectedUser({ username: incomingCall.fromUsername });
      setIncomingCall(null);
      setCallStatus('Connecting...');
    } catch (err) {
      console.error('Answer error:', err);
      if (err.name === 'NotAllowedError') {
        setCallStatus('Microphone access denied');
      } else {
        setCallStatus('Failed to answer');
      }
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
    setConnectedUser(null);
    setCallDuration(0);
    setCallStatus('Call ended');
    
    setTimeout(() => setCallStatus('Select someone to call'), 2000);
  };

  return (
    <div className="voice-chat-panel">
      <div className="voice-header">
        <h3>🎙️ Voice Chat</h3>
        <button className="voice-close-btn" onClick={onClose}>×</button>
      </div>

      {incomingCall && !isCallActive && (
        <div className="incoming-call">
          <div className="caller-icon">📞</div>
          <p className="caller-name">{incomingCall.fromUsername} is calling...</p>
          <div className="call-actions">
            <button className="answer-btn" onClick={answerCall}>✓ Answer</button>
            <button className="decline-btn" onClick={declineCall}>✗ Decline</button>
          </div>
        </div>
      )}

      {isCallActive ? (
        <div className="active-call">
          <div className="call-info">
            <div className="connected-icon">🔊</div>
            <p className="connected-user">{connectedUser?.username}</p>
            <p className="call-duration">
              {callStatus === 'Connected' ? formatDuration(callDuration) : callStatus}
            </p>
          </div>
          <div className="call-controls">
            <button 
              className={`control-btn ${isMuted ? 'muted' : ''}`}
              onClick={toggleMute}
            >
              {isMuted ? '🔇 Unmute' : '🎤 Mute'}
            </button>
            <button className="end-call-btn" onClick={endCall}>📞 End Call</button>
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
              }}
            >
              <option value="">
                {availableUsers.length === 0 
                  ? 'No players available' 
                  : 'Select a player'
                }
              </option>
              {availableUsers.map(u => (
                <option key={u.id} value={u.id}>{u.username}</option>
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

      <audio ref={localAudioRef} autoPlay muted playsInline />
      <audio ref={remoteAudioRef} autoPlay playsInline />
    </div>
  );
}
