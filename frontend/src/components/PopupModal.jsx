import React, { useState } from "react";
import { FaCopy, FaCheck } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function PopupModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState(null); // { roomId, shareLink }
  const [copied, setCopied] = useState(false);

  const navigate = useNavigate();

  const openModal = async () => {
    setIsOpen(true);
    setError("");
    setSession(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/sessions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Interview Session" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSession({ roomId: data.roomId, shareLink: data.shareLink });
      } else {
        setError(data.error || "Failed to create interview room");
      }
    } catch (err) {
      console.error(err);
      setError("Unable to reach the server");
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => setIsOpen(false);

  const handleCopy = () => {
    if (!session) return;
    navigator.clipboard.writeText(session.shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const closeModalAndJoin = () => {
    if (!session) return;
    setIsOpen(false);
    navigate(`/room/${session.roomId}`);
  };

  return (
    <div>
      <button
        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-95 transition-all text-base"
        onClick={openModal}
      >
        Start an Interview
      </button>

      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-md text-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold tracking-tight uppercase text-slate-200">Interview Room</h2>
              <button
                className="text-slate-400 hover:text-slate-200 text-2xl transition-all"
                onClick={closeModal}
              >
                &times;
              </button>
            </div>

            {loading && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Creating room...</span>
              </div>
            )}

            {error && (
              <div className="w-full bg-rose-950/40 border border-rose-900/50 text-rose-300 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider mb-4 text-center">
                {error}
              </div>
            )}

            {session && !loading && (
              <>
                <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Share this link with your candidate</p>
                <div className="mb-6 flex items-center justify-between bg-slate-950 border border-slate-850 p-3 rounded-xl gap-2">
                  <p className="text-sm font-mono font-bold text-blue-400 select-all truncate">
                    {session.shareLink}
                  </p>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 text-slate-400 hover:text-slate-200 p-1.5 hover:bg-slate-900 rounded-lg transition-all"
                    title="Copy link"
                  >
                    {copied ? <FaCheck className="text-base text-emerald-400" /> : <FaCopy className="text-base" />}
                  </button>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2.5 rounded-xl text-sm transition-all"
                    onClick={closeModal}
                  >
                    Cancel
                  </button>
                  <button
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-95"
                    onClick={closeModalAndJoin}
                  >
                    Enter Room
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PopupModal;
