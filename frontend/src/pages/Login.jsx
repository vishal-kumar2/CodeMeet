import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataContext } from "../context/DataProvider";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function Login() {
  const { login } = useContext(DataContext);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e?.preventDefault();
    setError("");
    if (!username || !password) {
      setError("Please enter both username and password");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        login(data.user, data.token);
        navigate("/");
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      console.error(err);
      setError("Unable to connect to login server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col justify-center items-center p-4 text-slate-100">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md bg-slate-900/50 border border-slate-800/80 rounded-2xl p-8 shadow-2xl backdrop-blur-md flex flex-col items-center"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <img src="/codemeet_logo.svg" alt="CodeMeet Logo" className="h-9 w-9 rounded-lg shadow-sm object-contain" />
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">CodeMeet</h1>
        </div>

        <h2 className="text-xl font-semibold text-slate-200 mb-6 uppercase tracking-wider text-center">Welcome Back</h2>

        {error && (
          <div className="w-full bg-rose-950/40 border border-rose-900/50 text-rose-300 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider mb-4 text-center">
            {error}
          </div>
        )}

        <div className="w-full space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Username</label>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/60 focus:border-blue-500 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/60 focus:border-blue-500 rounded-xl pl-4 pr-12 py-3 text-slate-100 placeholder-slate-600 text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-all p-1"
              >
                {showPassword ? <FaEyeSlash className="h-4.5 w-4.5" /> : <FaEye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-[0.98] transition-all text-sm mt-6 flex items-center justify-center gap-2"
          >
            {loading && <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
            {loading ? "Logging in..." : "Login to Account"}
          </button>

          <p className="text-sm text-slate-400 font-light text-center mt-6">
            New User?{" "}
            <Link className="text-blue-400 font-semibold hover:underline" to="/signup">
              Create an account
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}

export default Login;
