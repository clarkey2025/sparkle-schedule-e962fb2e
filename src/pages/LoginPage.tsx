import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Eye, EyeOff, Droplets } from "lucide-react";
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
    // Small delay for UX
    await new Promise((r) => setTimeout(r, 400));
    const ok = login(username.trim(), password);
    setLoading(false);
    if (ok) {
      navigate(from, { replace: true });
    } else {
      setError("Incorrect username or password.");
    }
  };

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-up">
        {/* Card */}
        <div className="surface-raised rounded-2xl p-8">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 border border-primary/20">
              <img src={bucketListIcon} alt="Paneless" className="h-7 w-7 rounded" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-foreground tracking-tight">Paneless</h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">Sign in to your account</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2.5 pr-10 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-[12px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-5">
          © {new Date().getFullYear()} Paneless · Window cleaning management
        </p>
      </div>
    </div>
  );
}
