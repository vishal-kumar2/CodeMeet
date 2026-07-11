import { useContext } from "react";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Homepage from "./pages/Homepage";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DataContext } from "./context/DataProvider";
import MainPage from "./pages/MainPage";

function App() {
  const { user, authLoading } = useContext(DataContext);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loading CodeMeet</span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/signup" element={!user ? <Signup /> : <Navigate to="/" />} />
        <Route path="/" element={<Homepage />} />
        {/* Candidates can open a shared /room/:roomId link without an account -
            the room itself decides (via the join handshake) whether they're
            the host or need approval. */}
        <Route path="/room/:roomId" element={<MainPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
