import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { useNavigate } from "react-router-dom";

// ── Animated floating design card ──────────────────────────────────────────
function FloatingCard({ style, children, delay = 0 }) {
  return (
    <div
      className="absolute rounded-2xl shadow-2xl border border-white/20 backdrop-blur-sm overflow-hidden"
      style={{
        animation: `floatCard 6s ease-in-out infinite`,
        animationDelay: `${delay}s`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Feature pill ────────────────────────────────────────────────────────────
function FeaturePill({ icon, label }) {
  return (
    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2">
      <span className="text-lg">{icon}</span>
      <span className="text-white text-sm font-medium">{label}</span>
    </div>
  );
}

// ── Auth form ───────────────────────────────────────────────────────────────
function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate("/dashboard");
    } catch (err) {
      setError(
        err.message
          .replace("Firebase: ", "")
          .replace(/\(auth.*\)\.?/, "")
          .trim(),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      navigate("/dashboard");
    } catch (err) {
      setError(
        err.message
          .replace("Firebase: ", "")
          .replace(/\(auth.*\)\.?/, "")
          .trim(),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 w-full max-w-md border border-white/50"
      style={{ animation: "slideUp 0.6s cubic-bezier(0.16,1,0.3,1) both" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 mb-7">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-violet-300">
          K
        </div>
        <div>
          <p className="text-base font-bold text-gray-900">KonvaCraft Studio</p>
          <p className="text-xs text-gray-400">Design without limits</p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-1">
        {isSignUp ? "Create account" : "Welcome back"}
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        {isSignUp
          ? "Join thousands of designers today"
          : "Sign in to continue designing"}
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-5 text-sm flex items-start gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Google */}
      <button
        onClick={handleGoogle}
        disabled={loading}
        className="w-full border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-2xl transition-all flex items-center justify-center gap-3 mb-5 disabled:opacity-50"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </button>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs text-gray-400 font-medium">
            OR
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border-2 border-gray-200 focus:border-violet-500 rounded-xl px-4 py-3 text-sm outline-none transition-all bg-gray-50 focus:bg-white"
            placeholder="you@example.com"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border-2 border-gray-200 focus:border-violet-500 rounded-xl px-4 py-3 text-sm outline-none transition-all bg-gray-50 focus:bg-white"
            placeholder="••••••••"
            required
            minLength={6}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-2xl text-sm font-bold text-white shadow-lg shadow-violet-300 transition-all disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {isSignUp ? "Creating account…" : "Signing in…"}
            </span>
          ) : isSignUp ? (
            "Create Account — Free"
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-5">
        {isSignUp ? "Already have an account? " : "Don't have an account? "}
        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError("");
          }}
          className="font-semibold text-violet-600 hover:text-violet-700 transition-colors"
        >
          {isSignUp ? "Sign in" : "Sign up free"}
        </button>
      </p>
    </div>
  );
}

// ── Mock design preview cards ────────────────────────────────────────────────
const MOCK_DESIGNS = [
  {
    bg: "linear-gradient(135deg,#667eea,#764ba2)",
    label: "Social Post",
    w: 180,
    h: 180,
  },
  {
    bg: "linear-gradient(135deg,#f093fb,#f5576c)",
    label: "Presentation",
    w: 220,
    h: 130,
  },
  {
    bg: "linear-gradient(135deg,#4facfe,#00f2fe)",
    label: "Banner",
    w: 200,
    h: 90,
  },
  {
    bg: "linear-gradient(135deg,#43e97b,#38f9d7)",
    label: "Poster",
    w: 150,
    h: 210,
  },
  {
    bg: "linear-gradient(135deg,#fa709a,#fee140)",
    label: "Thumbnail",
    w: 195,
    h: 110,
  },
  {
    bg: "linear-gradient(135deg,#a18cd1,#fbc2eb)",
    label: "Card",
    w: 170,
    h: 170,
  },
];

const FEATURES = [
  {
    icon: "🎨",
    title: "Drag & Drop Canvas",
    desc: "Pixel-perfect design with an intuitive Konva-powered canvas that feels buttery smooth.",
  },
  {
    icon: "🖼",
    title: "Million+ Assets",
    desc: "Search and use stunning photos & videos from Unsplash and Pexels directly in your design.",
  },
  {
    icon: "✨",
    title: "26+ Font Families",
    desc: "From elegant serifs to playful scripts — beautiful typography at your fingertips.",
  },
  {
    icon: "📐",
    title: "10+ Shape Tools",
    desc: "Rectangles, circles, stars, polygons, arrows and more with full property controls.",
  },
  {
    icon: "🎬",
    title: "Video Elements",
    desc: "Embed and control video clips directly on your canvas with playback, loop and volume.",
  },
  {
    icon: "⬇",
    title: "Multi-format Export",
    desc: "Export your masterpiece as PNG, JPG or WebM video in up to 3× resolution.",
  },
];

export default function LoginPage() {
  return (
    <div
      className="min-h-screen w-full overflow-x-hidden"
      style={{ background: "#0a0a0f", minHeight: "100vh" }}
    >
      <style>{`
        html, body, #root {
          min-height: 100%;
          overflow-y: auto;
        }
        @keyframes floatCard {
          0%,100% { transform: translateY(0px) rotate(var(--r,0deg)); }
          50% { transform: translateY(-18px) rotate(var(--r,0deg)); }
        }
        @keyframes slideUp {
          from { opacity:0; transform:translateY(32px); }
          to { opacity:1; transform:translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(24px); }
          to { opacity:1; transform:translateY(0); }
        }
        @keyframes pulse-glow {
          0%,100% { opacity:0.5; }
          50% { opacity:1; }
        }
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(160px) rotate(0deg); }
          to { transform: rotate(360deg) translateX(160px) rotate(-360deg); }
        }
        @keyframes shimmerMove {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .glow-text {
          background: linear-gradient(135deg, #fff 0%, #c4b5fd 40%, #f9a8d4 70%, #fff 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmerMove 4s linear infinite;
        }
        .hero-glow {
          background: radial-gradient(ellipse 80% 60% at 50% 40%, rgba(124,58,237,0.3) 0%, rgba(236,72,153,0.15) 50%, transparent 100%);
        }
        .grid-bg {
          background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .card-glow:hover {
          box-shadow: 0 0 40px rgba(124,58,237,0.3), 0 20px 60px rgba(0,0,0,0.5);
          transform: translateY(-4px);
        }
        .pill-animate {
          animation: fadeInUp 0.5s ease both;
        }
      `}</style>

      {/* ── Hero section ── */}
      <section className="relative min-h-screen flex grid-bg overflow-hidden">
        <div className="hero-glow absolute inset-0 pointer-events-none" />

        {/* Floating orb decorations */}
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{
            background: "radial-gradient(circle, #7c3aed, transparent)",
          }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{
            background: "radial-gradient(circle, #ec4899, transparent)",
          }}
        />

        {/* Nav */}
        <div className="absolute top-0 left-0 right-0 flex items-center px-8 py-5 z-20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center text-white font-black text-base shadow-lg shadow-violet-900">
              K
            </div>
            <span className="text-white font-bold text-lg">
              KonvaCraft Studio
            </span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-lg">
              Turn ideas into stunning visuals
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="w-full flex flex-col lg:flex-row items-center justify-center gap-16 px-8 py-24 pt-32 max-w-7xl mx-auto">
          {/* Left: Hero text */}
          <div
            className="flex-1 max-w-xl"
            style={{ animation: "fadeInUp 0.8s ease both" }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-violet-950/60 border border-violet-700/50 rounded-full px-4 py-2 mb-8">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-violet-300 text-xs font-semibold">
                Free · No credit card needed
              </span>
            </div>

            <h1 className="text-5xl lg:text-6xl font-black leading-tight mb-6">
              <span className="glow-text">Design</span>
              <br />
              <span className="text-white">anything.</span>
              <br />
              <span className="text-white/40">In seconds.</span>
            </h1>

            <p className="text-white/60 text-lg leading-relaxed mb-8">
              A professional design editor built on Konva. Create stunning
              graphics, social posts, presentations and more — with
              drag-and-drop simplicity.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 mb-10">
              {[
                { icon: "🎨", label: "Drag & Drop" },
                { icon: "🖼", label: "Unsplash & Pexels" },
                { icon: "🎬", label: "Video Support" },
                { icon: "⬇", label: "Export PNG / MP4" },
              ].map((f, i) => (
                <div
                  key={i}
                  className="pill-animate"
                  style={{ animationDelay: `${0.1 * i + 0.4}s` }}
                >
                  <FeaturePill icon={f.icon} label={f.label} />
                </div>
              ))}
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {["#7c3aed", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"].map(
                  (c, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 border-gray-900 flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: c }}
                    >
                      {String.fromCharCode(65 + i)}
                    </div>
                  ),
                )}
              </div>
              <div>
                <div className="flex text-yellow-400 text-sm">★★★★★</div>
                <p className="text-white/40 text-xs">
                  Loved by 12,000+ designers
                </p>
              </div>
            </div>
          </div>

          {/* Right: Auth form */}
          <div className="w-full max-w-md shrink-0">
            <AuthForm />
          </div>
        </div>
      </section>

      {/* ── Features section ── */}
      <section className="py-24 px-8" style={{ background: "#0d0d18" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">
              Everything you need
            </p>
            <h2 className="text-4xl font-black text-white mb-4">
              Professional tools,
              <br />
              <span className="glow-text">zero complexity</span>
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              KonvaCraft Studio packs the power of professional design software
              into a clean, fast browser-based editor.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="card-glow rounded-2xl border border-white/10 p-6 transition-all duration-300 cursor-default"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                  animation: `fadeInUp 0.6s ease ${0.1 * i}s both`,
                }}
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Design templates showcase ── */}
      <section
        className="py-24 px-8 overflow-hidden"
        style={{ background: "#0a0a0f" }}
      >
        <div className="max-w-6xl mx-auto text-center mb-12">
          <p className="text-pink-400 text-sm font-semibold uppercase tracking-widest mb-3">
            Create anything
          </p>
          <h2 className="text-4xl font-black text-white">
            From social posts to
            <span className="glow-text"> full presentations</span>
          </h2>
        </div>

        {/* Scrolling design cards */}
        <div
          className="flex gap-4 overflow-x-auto pb-4 snap-x"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#7c3aed transparent",
          }}
        >
          {[...MOCK_DESIGNS, ...MOCK_DESIGNS].map((d, i) => (
            <div
              key={i}
              className="shrink-0 snap-center rounded-2xl flex flex-col items-center justify-center text-white font-bold text-sm shadow-xl border border-white/10 cursor-pointer hover:scale-105 transition-transform duration-200"
              style={{
                background: d.bg,
                width: d.w,
                height: d.h,
                animation: `fadeInUp 0.4s ease ${0.05 * (i % 6)}s both`,
              }}
            >
              {d.label}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA section ── */}
      <section
        className="py-20 px-8 text-center relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1e0533, #0f0a1e, #1a0a2e)",
        }}
      >
        <div className="absolute inset-0 hero-glow pointer-events-none" />
        <div className="relative max-w-2xl mx-auto">
          <h2 className="text-4xl font-black text-white mb-4">
            Ready to create?
          </h2>
          <p className="text-white/60 text-lg mb-8">
            Join thousands of designers and start building beautiful graphics
            today. It's completely free.
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-white text-lg shadow-2xl shadow-violet-900 transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
          >
            🎨 Start Designing Free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="py-8 px-8 border-t border-white/10 text-center"
        style={{ background: "#0a0a0f" }}
      >
        <p className="text-white/30 text-sm">
          © 2025 KonvaCraft Studio · Built with ♥ and Konva.js
        </p>
      </footer>
    </div>
  );
}
