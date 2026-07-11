import React, { useContext, useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DataContext } from "../context/DataProvider";
import AudioVideoScreen from "../components/AudioVideoScreen";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Local join-flow states (distinct from the call UI itself, which only
// mounts once we're actually approved into the Socket.IO room).
const STAGE = {
  LOOKING_UP: "looking_up",
  NOT_FOUND: "not_found",
  ENDED: "ended",
  PREJOIN: "prejoin",
  REQUESTING: "requesting",
  PENDING: "pending",
  REJECTED: "rejected",
  ERROR: "error",
  APPROVED: "approved",
};

function CenteredShell({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col justify-center items-center p-4 text-slate-100">
      <div className="w-full max-w-md bg-slate-900/50 border border-slate-800/80 rounded-2xl p-8 shadow-2xl backdrop-blur-md flex flex-col items-center text-center">
        {children}
      </div>
    </div>
  );
}

function MainPage() {
  const { roomId } = useParams();
  const { user, authToken, socket, socketConnected } = useContext(DataContext);
  const navigate = useNavigate();

  const [stage, setStage] = useState(STAGE.LOOKING_UP);
  const [roomInfo, setRoomInfo] = useState(null); // { title, interviewerName, status }
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [errorMessage, setErrorMessage] = useState("");
  const [isHost, setIsHost] = useState(false);

  // Host-only: candidates currently waiting for approval.
  const [pendingRequests, setPendingRequests] = useState([]);

  // 1. Look up the room via the public session-info endpoint before touching sockets.
  useEffect(() => {
    let cancelled = false;
    setStage(STAGE.LOOKING_UP);
    fetch(`${API_URL}/api/sessions/${roomId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setErrorMessage(data.error || "Session not found");
          setStage(STAGE.NOT_FOUND);
          return;
        }
        setRoomInfo(data);
        if (data.status === "ended") {
          setStage(STAGE.ENDED);
        } else {
          setStage(STAGE.PREJOIN);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage("Unable to reach the server");
          setStage(STAGE.NOT_FOUND);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // 2. Socket listeners for the join handshake — active for the whole page lifetime.
  useEffect(() => {
    if (!socket) return;

    const onApproved = ({ isHost: hostFlag }) => {
      setIsHost(!!hostFlag);
      setStage(STAGE.APPROVED);
    };
    const onPending = () => setStage(STAGE.PENDING);
    const onRejected = ({ message }) => {
      setErrorMessage(message || "The interviewer declined your request to join");
      setStage(STAGE.REJECTED);
    };
    const onJoinError = ({ message }) => {
      setErrorMessage(message || "Unable to join this room");
      setStage(STAGE.ERROR);
    };
    const onJoinRequest = ({ socketId, name }) => {
      setPendingRequests((prev) => {
        if (prev.some((p) => p.socketId === socketId)) return prev;
        return [...prev, { socketId, name }];
      });
    };
    const onPendingList = (list) => {
      setPendingRequests(list || []);
    };
    const onPeerLeft = ({ peerId }) => {
      setPendingRequests((prev) => prev.filter((p) => p.socketId !== peerId));
    };

    socket.on("join-approved", onApproved);
    socket.on("join-pending", onPending);
    socket.on("join-rejected", onRejected);
    socket.on("join-error", onJoinError);
    socket.on("join-request", onJoinRequest);
    socket.on("pending-requests", onPendingList);
    socket.on("peer-left", onPeerLeft);

    return () => {
      socket.off("join-approved", onApproved);
      socket.off("join-pending", onPending);
      socket.off("join-rejected", onRejected);
      socket.off("join-error", onJoinError);
      socket.off("join-request", onJoinRequest);
      socket.off("pending-requests", onPendingList);
      socket.off("peer-left", onPeerLeft);
    };
  }, [socket]);

  const requestJoin = useCallback(() => {
    if (!socket || !socketConnected) return;
    setStage(STAGE.REQUESTING);
    socket.emit("join-room-request", {
      roomId,
      name: (displayName || "Guest").trim(),
      token: authToken || null,
    });
  }, [socket, socketConnected, roomId, displayName, authToken]);

  const respondToRequest = (socketId, approve) => {
    socket.emit("respond-join-request", { roomId, socketId, approve });
    setPendingRequests((prev) => prev.filter((p) => p.socketId !== socketId));
  };

  const shareLink = `${window.location.origin}/room/${roomId}`;

  // --- Render states ---

  if (stage === STAGE.LOOKING_UP) {
    return (
      <CenteredShell>
        <div className="h-8 w-8 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin mb-4" />
        <p className="text-sm text-slate-400 font-semibold uppercase tracking-wider">Looking up room...</p>
      </CenteredShell>
    );
  }

  if (stage === STAGE.NOT_FOUND) {
    return (
      <CenteredShell>
        <h2 className="text-lg font-bold text-slate-100 mb-2">Room Not Found</h2>
        <p className="text-sm text-slate-400 mb-6">{errorMessage || "This interview room doesn't exist."}</p>
        <button
          onClick={() => navigate("/")}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 text-sm"
        >
          Back to Home
        </button>
      </CenteredShell>
    );
  }

  if (stage === STAGE.ENDED) {
    return (
      <CenteredShell>
        <h2 className="text-lg font-bold text-slate-100 mb-2">Interview Ended</h2>
        <p className="text-sm text-slate-400 mb-6">This session has already been ended by the interviewer.</p>
        <button
          onClick={() => navigate("/")}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 text-sm"
        >
          Back to Home
        </button>
      </CenteredShell>
    );
  }

  if (stage === STAGE.PREJOIN) {
    return (
      <CenteredShell>
        <img src="/codemeet_logo.svg" alt="CodeMeet" className="h-10 w-10 rounded-lg mb-4" />
        <h2 className="text-lg font-bold text-slate-100 mb-1">{roomInfo?.title || "Interview Session"}</h2>
        {roomInfo?.interviewerName && (
          <p className="text-xs text-slate-500 mb-6">Hosted by {roomInfo.interviewerName}</p>
        )}
        <div className="w-full mb-4">
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider text-left">Your Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your name"
            onKeyDown={(e) => e.key === "Enter" && requestJoin()}
            className="w-full bg-slate-950 border border-slate-700/60 focus:border-blue-500 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
            autoFocus
          />
        </div>
        <button
          onClick={requestJoin}
          disabled={!socketConnected}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-blue-500/10 transition-all active:scale-95 text-sm"
        >
          {socketConnected ? "Join Room" : "Connecting..."}
        </button>
      </CenteredShell>
    );
  }

  if (stage === STAGE.REQUESTING) {
    return (
      <CenteredShell>
        <div className="h-8 w-8 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin mb-4" />
        <p className="text-sm text-slate-400 font-semibold uppercase tracking-wider">Requesting access...</p>
      </CenteredShell>
    );
  }

  if (stage === STAGE.PENDING) {
    return (
      <CenteredShell>
        <div className="h-10 w-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 animate-pulse">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-100 mb-2">Waiting for Approval</h2>
        <p className="text-sm text-slate-400">The interviewer has been notified you're here. Hang tight!</p>
      </CenteredShell>
    );
  }

  if (stage === STAGE.REJECTED) {
    return (
      <CenteredShell>
        <h2 className="text-lg font-bold text-slate-100 mb-2">Access Declined</h2>
        <p className="text-sm text-slate-400 mb-6">{errorMessage}</p>
        <button
          onClick={() => navigate("/")}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-6 py-2.5 rounded-xl transition-all active:scale-95 text-sm"
        >
          Back to Home
        </button>
      </CenteredShell>
    );
  }

  if (stage === STAGE.ERROR) {
    return (
      <CenteredShell>
        <h2 className="text-lg font-bold text-slate-100 mb-2">Couldn't Join</h2>
        <p className="text-sm text-slate-400 mb-6">{errorMessage}</p>
        <button
          onClick={() => navigate("/")}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 text-sm"
        >
          Back to Home
        </button>
      </CenteredShell>
    );
  }

  // STAGE.APPROVED
  return (
    <AudioVideoScreen
      roomId={roomId}
      isHost={isHost}
      shareLink={shareLink}
      pendingRequests={pendingRequests}
      onRespondToRequest={respondToRequest}
    />
  );
}

export default MainPage;
