import { useContext, useEffect, useRef, useState } from "react";
import { DataContext } from "../context/DataProvider";
import { useNavigate } from "react-router-dom";
import Notepad from "./Notepad";
import CodeEditor from "./CodeEditor";
import { FaCopy, FaCheck } from "react-icons/fa";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function AudioVideoScreen({ roomId, isHost, shareLink, pendingRequests = [], onRespondToRequest }) {
  const { socket, peerInstance, peerId, peerReady } = useContext(DataContext);
  const navigate = useNavigate();
  const remoteVideoRef = useRef(null);
  const currentUserVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const activeCallRef = useRef(null);
  const localStreamPromiseRef = useRef(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [streamError, setStreamError] = useState("");
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ending, setEnding] = useState(false);

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks.forEach((track) => {
          track.enabled = !track.enabled;
        });
        setIsMuted(!audioTracks[0]?.enabled);
      } else {
        setIsMuted(!isMuted);
      }
    } else {
      setIsMuted(!isMuted);
    }
  };

  const getVideoSender = () => {
    if (!activeCallRef.current || !activeCallRef.current.peerConnection) return null;
    const transceivers = activeCallRef.current.peerConnection.getTransceivers();
    const videoTransceiver = transceivers.find(
      (t) => t.receiver && t.receiver.track && t.receiver.track.kind === "video"
    );
    if (videoTransceiver) return videoTransceiver.sender;
    const senders = activeCallRef.current.peerConnection.getSenders();
    return senders.find((sender) => sender.track && sender.track.kind === "video") || null;
  };

  const toggleVideo = async () => {
    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: !isMuted });
        localStreamRef.current = stream;
        setStreamError("");
        setIsVideoOff(false);

        if (currentUserVideoRef.current) {
          currentUserVideoRef.current.srcObject = stream;
          currentUserVideoRef.current.play().catch((err) => console.error("Error playing local video:", err));
        }

        const newTrack = stream.getVideoTracks()[0];
        const videoSender = getVideoSender();
        if (videoSender && newTrack) {
          await videoSender.replaceTrack(newTrack);
        }
        return;
      } catch (err) {
        console.error("Failed to acquire stream in toggleVideo:", err);
        setStreamError(err.message || "Failed to access camera.");
        return;
      }
    }

    const videoTracks = localStreamRef.current.getVideoTracks();
    if (videoTracks.length > 0 && !isVideoOff) {
      const track = videoTracks[0];
      track.stop();
      localStreamRef.current.removeTrack(track);

      try {
        const videoSender = getVideoSender();
        if (videoSender) {
          await videoSender.replaceTrack(null);
        }
      } catch (err) {
        console.error("Error replacing track with null:", err);
      }

      setIsVideoOff(true);
    } else {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = tempStream.getVideoTracks()[0];

        localStreamRef.current.getVideoTracks().forEach((t) => {
          t.stop();
          localStreamRef.current.removeTrack(t);
        });
        localStreamRef.current.addTrack(newTrack);

        try {
          const videoSender = getVideoSender();
          if (videoSender) {
            await videoSender.replaceTrack(newTrack);
          } else if (activeCallRef.current && activeCallRef.current.peerConnection) {
            activeCallRef.current.peerConnection.addTrack(newTrack, localStreamRef.current);
          }
        } catch (err) {
          console.error("Error replacing track with new track:", err);
        }

        if (currentUserVideoRef.current) {
          currentUserVideoRef.current.srcObject = localStreamRef.current;
          currentUserVideoRef.current.play().catch((err) => {
            console.error("Error playing local video:", err);
          });
        }
        setIsVideoOff(false);
      } catch (err) {
        console.error("Failed to re-acquire camera stream:", err);
        setStreamError(err.message || "Failed to access camera.");
      }
    }
  };

  const handleEndOrLeave = async () => {
    if (isHost) {
      setEnding(true);
      try {
        await fetch(`${API_URL}/api/sessions/${roomId}/end`, {
          method: "POST",
          credentials: "include",
        });
      } catch (err) {
        console.warn("Failed to mark session ended:", err);
      }
    }
    socket?.emit("leaveRoom", roomId);
    navigate("/");
  };

  // Attach the incoming-call / remote-stream handling once PeerJS is ready.
  useEffect(() => {
    if (!peerInstance.current) return;

    const bindRemoteStream = (call) => {
      call.on("stream", (remoteStream) => {
        setHasRemoteStream(true);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch((err) => console.error("Error playing remote video:", err));
        }
      });
      call.on("close", () => {
        setHasRemoteStream(false);
      });
      call.on("error", (err) => console.error("Call error:", err));
    };

    const handleIncomingCall = async (incomingCall) => {
      if (activeCallRef.current) {
        activeCallRef.current.close();
      }
      activeCallRef.current = incomingCall;

      let stream = localStreamRef.current;
      if (!stream && localStreamPromiseRef.current) {
        stream = await localStreamPromiseRef.current;
      }
      incomingCall.answer(stream || new MediaStream());
      bindRemoteStream(incomingCall);
    };

    peerInstance.current.on("call", handleIncomingCall);
    return () => {
      peerInstance.current?.off("call", handleIncomingCall);
    };
  }, [peerInstance, peerReady]);

  // Grab local media as soon as we mount.
  useEffect(() => {
    const getLocalStream = async () => {
      try {
        let mediaStream = null;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (err) {
          console.warn("Failed to get video and audio, trying video-only...", err);
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } catch (err2) {
            console.warn("Failed to get video-only, trying audio-only...", err2);
            try {
              mediaStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
              setIsVideoOff(true);
            } catch (err3) {
              if (err.name === "NotReadableError" || err.message?.includes("Could not start video source")) {
                throw new Error("Webcam is locked by another window/app. Try closing other tabs using it.");
              }
              throw new Error("Could not access camera or microphone. Please check your browser permissions.");
            }
          }
        }

        localStreamRef.current = mediaStream;
        setStreamError("");

        mediaStream.getAudioTracks().forEach((track) => {
          track.enabled = !isMuted;
        });
        mediaStream.getVideoTracks().forEach((track) => {
          track.enabled = !isVideoOff;
        });

        if (currentUserVideoRef.current) {
          currentUserVideoRef.current.srcObject = mediaStream;
          currentUserVideoRef.current.play().catch((err) => console.error("Error playing local video:", err));
        }

        return mediaStream;
      } catch (err) {
        console.error("Failed to get local stream:", err);
        setStreamError(err.message || "Failed to access camera/microphone.");
        return null;
      }
    };

    localStreamPromiseRef.current = getLocalStream();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (activeCallRef.current) {
        activeCallRef.current.close();
      }
      setHasRemoteStream(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The host places the call as soon as the backend tells the room a new
  // peer (candidate) is ready — see socket/socketHandlers.js's "peer-ready"
  // broadcast on approval. Both sides use their socket.io id as their
  // PeerJS id (see DataProvider), so `peerId` here IS a valid PeerJS target.
  useEffect(() => {
    if (!socket || !isHost || !peerReady) return;

    const initiateCall = async (targetPeerId) => {
      let stream = localStreamRef.current;
      if (!stream && localStreamPromiseRef.current) {
        stream = await localStreamPromiseRef.current;
      }
      if (activeCallRef.current) {
        activeCallRef.current.close();
      }
      const call = peerInstance.current.call(targetPeerId, stream || new MediaStream());
      activeCallRef.current = call;
      call.on("stream", (remoteStream) => {
        setHasRemoteStream(true);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch((err) => console.error("Error playing remote video:", err));
        }
      });
      call.on("close", () => setHasRemoteStream(false));
      call.on("error", (err) => console.error("Call error:", err));
    };

    const handlePeerReady = ({ peerId: readyPeerId }) => {
      if (readyPeerId && readyPeerId !== peerId) {
        initiateCall(readyPeerId);
      }
    };

    socket.on("peer-ready", handlePeerReady);
    return () => socket.off("peer-ready", handlePeerReady);
  }, [socket, isHost, peerReady, peerId, peerInstance]);

  // Reflect the other side leaving.
  useEffect(() => {
    if (!socket) return;
    const handlePeerGone = () => {
      setHasRemoteStream(false);
      if (activeCallRef.current) {
        activeCallRef.current.close();
        activeCallRef.current = null;
      }
    };
    socket.on("peer-left", handlePeerGone);
    socket.on("host-left", handlePeerGone);
    return () => {
      socket.off("peer-left", handlePeerGone);
      socket.off("host-left", handlePeerGone);
    };
  }, [socket]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col">
      {/* Header / Navbar */}
      <header className="flex items-center justify-between px-6 md:px-12 py-4 border-b border-slate-800/80 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <img src="/codemeet_logo.svg" alt="CodeMeet Logo" className="h-8 w-8 rounded-lg shadow-sm object-contain" />
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">CodeMeet</h1>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider -mt-0.5">Collaborative Interview</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {isHost && (
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 px-3.5 py-1.5 rounded-xl shadow-sm transition-all active:scale-95"
              title="Copy invite link"
            >
              {copied ? <FaCheck className="text-emerald-400 text-xs" /> : <FaCopy className="text-slate-400 text-xs" />}
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{copied ? "Copied" : "Invite Link"}</span>
            </button>
          )}
          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3.5 py-1.5 rounded-xl shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Room:</span>
            <span className="text-xs font-mono font-bold text-blue-400 select-all">{roomId}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3.5 py-1.5 rounded-xl shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Role:</span>
            <span className={`text-xs font-bold uppercase tracking-wider ${isHost ? "text-indigo-400" : "text-emerald-400"}`}>
              {isHost ? "interviewer" : "interviewee"}
            </span>
          </div>
          <button
            onClick={handleEndOrLeave}
            disabled={ending}
            className="text-xs font-bold text-slate-400 hover:text-white bg-slate-900/50 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900/50 px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-60"
          >
            {ending ? "Ending..." : isHost ? "End Interview" : "Leave Room"}
          </button>
        </div>
      </header>

      {/* Pending join requests banner (host only) */}
      {isHost && pendingRequests.length > 0 && (
        <div className="px-6 md:px-12 pt-4">
          <div className="max-w-7xl mx-auto flex flex-col gap-2">
            {pendingRequests.map((req) => (
              <div
                key={req.socketId}
                className="flex items-center justify-between bg-amber-950/30 border border-amber-800/50 rounded-xl px-4 py-3 shadow-lg animate-in fade-in duration-200"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-sm text-amber-200 font-semibold">{req.name} wants to join the interview</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onRespondToRequest?.(req.socketId, true)}
                    className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 rounded-lg transition-all active:scale-95"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => onRespondToRequest?.(req.socketId, false)}
                    className="text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 px-3.5 py-1.5 rounded-lg transition-all active:scale-95"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full gap-6">
        {/* Top Section: Videos and Notepad */}
        <div className="flex flex-col md:flex-row w-full gap-6 items-stretch min-h-[320px]">
          {/* User Video */}
          <div className="w-full md:w-1/3 flex flex-col">
            <span className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Your Camera</span>
            <div className="flex-1 relative rounded-2xl border border-slate-800/80 bg-slate-950/60 overflow-hidden shadow-xl aspect-video md:aspect-auto flex items-center justify-center min-h-[280px]">
              <video
                ref={currentUserVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />

              {streamError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 p-4 text-center z-10">
                  <div className="w-12 h-12 rounded-full bg-rose-950/50 flex items-center justify-center border border-rose-900/40 text-rose-400 mb-2">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <span className="text-xs text-rose-400 font-bold tracking-wide uppercase mb-1">Stream Error</span>
                  <p className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed">{streamError}</p>
                </div>
              )}

              {!streamError && isVideoOff && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-10">
                  <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800 text-slate-500 mb-2">
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
                      <path d="M10.68 10.68a2 2 0 0 1-2.83-2.83" />
                      <path d="m22 8-6 4 6 4V8Z" />
                      <line x1="2" x2="22" y1="2" y2="22" />
                    </svg>
                  </div>
                  <span className="text-xs text-slate-500 font-semibold tracking-wide uppercase">Camera is off</span>
                </div>
              )}

              <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md border border-slate-800/60 text-[10px] font-bold text-slate-200 px-2.5 py-1 rounded-full uppercase tracking-wider z-20">
                {isHost ? "Interviewer" : "Interviewee"} (You)
              </div>

              <div className="absolute bottom-3 right-3 flex items-center gap-2 z-20">
                <button
                  onClick={toggleMute}
                  className={`p-2 rounded-xl border transition-all active:scale-95 ${isMuted
                    ? "bg-rose-500/25 border-rose-500/40 text-rose-400 hover:bg-rose-500/35"
                    : "bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                >
                  {isMuted ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="1" x2="23" y1="1" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                      <path d="M15 9.34V5a3 3 0 0 0-5.94-.6" />
                      <path d="M17 14.89A7.12 7.12 0 0 0 19 11v-1" />
                      <path d="M5 10v1a7 7 0 0 0 8 6.92" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={toggleVideo}
                  className={`p-2 rounded-xl border transition-all active:scale-95 ${isVideoOff
                    ? "bg-rose-500/25 border-rose-500/40 text-rose-400 hover:bg-rose-500/35"
                    : "bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
                >
                  {isVideoOff ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
                      <path d="M10.68 10.68a2 2 0 0 1-2.83-2.83" />
                      <path d="m22 8-6 4 6 4V8Z" />
                      <line x1="2" x2="22" y1="2" y2="22" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m22 8-6 4 6 4V8Z" />
                      <rect x="2" y="6" width="14" height="12" rx="2" ry="2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Notepad */}
          <div className="w-full md:w-1/3 flex flex-col bg-slate-900/30 border border-slate-800/60 rounded-2xl p-4 shadow-xl backdrop-blur-sm">
            <Notepad socket={socket} roomId={roomId} />
          </div>

          {/* Remote Video */}
          <div className="w-full md:w-1/3 flex flex-col">
            <span className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Peer Camera</span>
            <div className="flex-1 relative rounded-2xl border border-slate-800/80 bg-slate-950/60 overflow-hidden shadow-xl aspect-video md:aspect-auto flex items-center justify-center min-h-[280px]">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-3 left-3 bg-indigo-950/90 backdrop-blur-md border border-indigo-900/60 text-[10px] font-bold text-indigo-300 px-2.5 py-1 rounded-full uppercase tracking-wider">
                {isHost ? "Interviewee" : "Interviewer"}
              </div>
              {!hasRemoteStream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 p-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800 text-slate-400 animate-pulse mb-2">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-xs text-slate-500 font-semibold tracking-wide uppercase">Waiting for peer stream...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section: Code Editor */}
        <div className="flex-1 flex flex-col">
          <CodeEditor socket={socket} roomId={roomId} />
        </div>
      </main>
    </div>
  );
}

export default AudioVideoScreen;
