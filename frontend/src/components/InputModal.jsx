import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

// Extracts a bare roomId whether the user pastes a raw id or a full share link.
const extractRoomId = (raw) => {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("room");
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
  } catch {
    // not a URL, fall through
  }
  return trimmed;
};

function InputModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [roomInput, setRoomInput] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const openModal = () => setIsOpen(true);
  const closeModal = () => {
    setIsOpen(false);
    setError("");
    setRoomInput("");
  };

  const handleJoin = () => {
    const id = extractRoomId(roomInput);
    if (!id) {
      setError("Please enter a Room ID or paste the interview link");
      return;
    }
    setIsOpen(false);
    navigate(`/room/${id}`);
  };

  return (
    <div>
      <button
        className="bg-transparent hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 font-semibold px-6 py-3 rounded-xl shadow-lg active:scale-95 transition-all text-base"
        onClick={openModal}
      >
        Join an Interview
      </button>

      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-md text-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold tracking-tight uppercase text-slate-200">Join Room</h2>
              <button
                className="text-slate-400 hover:text-slate-200 text-2xl transition-all"
                onClick={closeModal}
              >
                &times;
              </button>
            </div>
            <div className="mb-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Room ID or Link</label>
              <input
                type="text"
                className="w-full bg-slate-950 border border-slate-700/60 focus:border-blue-500 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all font-semibold font-mono"
                placeholder="Paste Room ID or interview link..."
                value={roomInput}
                onChange={(e) => {
                  setRoomInput(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-rose-400 font-semibold mb-4">{error}</p>}
            <div className="flex justify-end gap-3 mt-4">
              <button
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2.5 rounded-xl text-sm transition-all"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-95"
                onClick={handleJoin}
              >
                Join Interview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InputModal;
