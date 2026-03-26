import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Eye, EyeOff } from "lucide-react";
import bucketListIcon from "@/assets/bucket-list-icon.png";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 350));
    const ok = login(username.trim(), password);
    setLoading(false);
    if (ok) {
      navigate(from, { replace: true });
    } else {
      setError("Incorrect username or password.");
    }
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-[340px] animate-fade-up">

        {/* Logo + name */}
        <div className="flex flex-col items-center gap-3 mb-10">
          <div className="flex items-center justify-center h-14 w-14 rounded-xl border border-border bg-card">
            <img src={bucketListIcon} alt="Paneless" className="h-8 w-8" />
          </div>
          <div className="text-center">
            <h1 className="text-[18px] font-bold text-foreground tracking-tight">Paneless</h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">Window cleaning management</p>
          </div>
        </div>

        {/* Form card */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="label-caps" htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                placeholder="your-username"
                required
                className="w-full rounded border border-border bg-background px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="label-caps" htmlFor="password">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="••••••••"
                  required
                  className="w-full rounded border border-border bg-background px-3 py-2.5 pr-9 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded border border-destructive/25 bg-destructive/10 px-3 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                <p className="text-[12px] text-destructive">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/40 font-mono mt-6">
          © {new Date().getFullYear()} Paneless
        </p>
      </div>
    </div>
  );
}
