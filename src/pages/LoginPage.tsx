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
    <div className="min-h-dvh bg-background flex">
      {/* Left panel — branding strip */}
      <div className="hidden lg:flex flex-col justify-between w-80 xl:w-96 border-r border-border p-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <img src={bucketListIcon} alt="Paneless" className="h-7 w-7" />
          <span className="text-[14px] font-semibold tracking-tight text-foreground">Paneless</span>
        </div>
        <div>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            "Paneless has completely transformed how I manage my round. Everything in one place."
          </p>
          <p className="text-[12px] text-muted-foreground/50 mt-3 font-medium">— James H., Window Cleaner</p>
        </div>
        <p className="text-[11px] text-muted-foreground/30 font-mono">
          © {new Date().getFullYear()} Paneless
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[360px] animate-fade-up">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <img src={bucketListIcon} alt="Paneless" className="h-6 w-6" />
            <span className="text-[13px] font-semibold text-foreground">Paneless</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Welcome back</h1>
            <p className="text-[13px] text-muted-foreground mt-1.5">Sign in to your Paneless account</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="label-caps" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                placeholder="your-username"
                required
                className="w-full rounded border border-border bg-card px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="label-caps" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="••••••••"
                  required
                  className="w-full rounded border border-border bg-card px-3 py-2.5 pr-10 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
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
              <div className="flex items-center gap-2 rounded border border-destructive/25 bg-destructive/8 px-3 py-2.5">
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
      </div>
    </div>
  );
}
