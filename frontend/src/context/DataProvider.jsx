import Peer from "peerjs";
import React, {
  useState,
  createContext,
  useEffect,
  useRef,
} from "react";
import { io } from "socket.io-client";

export const DataContext = createContext();

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const DataProvider = ({ children }) => {
  // `user` = the logged-in user object from the backend ({_id, name, email, username, ...}), or null.
  const [user, setUser] = useState(null);
  // Whether we're still checking for an existing session (GET /api/me) on first load.
  const [authLoading, setAuthLoading] = useState(true);
  // The raw JWT, used only for the Socket.IO join handshake (proves host identity).
  // Normal API calls rely on the httpOnly cookie instead, sent automatically.
  const [authToken, setAuthToken] = useState(() => sessionStorage.getItem("cm_token") || null);

  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const [peerId, setPeerId] = useState("");
  const [peerReady, setPeerReady] = useState(false);
  const peerInstance = useRef(null);

  const login = (userObj, token) => {
    setUser(userObj);
    if (token) {
      setAuthToken(token);
      sessionStorage.setItem("cm_token", token);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.warn("Logout request failed:", err);
    }
    setUser(null);
    setAuthToken(null);
    sessionStorage.removeItem("cm_token");
  };

  // On first load, ask the backend who we are (cookie is sent automatically).
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_URL}/api/me`, {
          method: "GET",
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          setUser(null);
          setAuthToken(null);
          sessionStorage.removeItem("cm_token");
        }
      } catch (err) {
        console.warn("Auth check failed:", err);
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Socket connects once, for the lifetime of the app.
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || API_URL;
    const s = io(socketUrl, {
      withCredentials: true,
      autoConnect: true,
    });

    s.on("connect", () => setSocketConnected(true));
    s.on("disconnect", () => setSocketConnected(false));

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  // PeerJS: give our peer the same ID as our socket.io connection id. This
  // way, when the backend tells a room "peer X is ready" (X = socket id), we
  // already know exactly which PeerJS peer that corresponds to — no extra
  // signaling channel needed for WebRTC handshaking beyond what Socket.IO
  // already relays.
  useEffect(() => {
    if (!socket || !socketConnected || !socket.id) return;
    if (peerInstance.current && !peerInstance.current.destroyed) return;

    const peer = new Peer(socket.id, {
      config: {
        iceServers: [
          { urls: "stun:openrelay.metered.ca:80" },
          {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
        ],
      },
    });

    peer.on("open", (id) => {
      setPeerId(id);
      setPeerReady(true);
    });
    peer.on("error", (err) => {
      console.error("PeerJS error:", err);
    });
    peer.on("disconnected", () => {
      setPeerReady(false);
    });

    peerInstance.current = peer;

    return () => {
      // Keep the peer alive across route changes within the same tab session;
      // it's only really torn down when the whole app unmounts.
    };
  }, [socket, socketConnected]);

  return (
    <DataContext.Provider
      value={{
        user,
        setUser,
        authLoading,
        authToken,
        login,
        logout,
        socket,
        socketConnected,
        peerInstance,
        peerId,
        peerReady,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};
