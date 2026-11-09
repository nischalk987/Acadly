import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, GraduationCap, LoaderCircle, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../../lib/supabase.js";

const BRAND_NAME = import.meta.env.VITE_BRAND_NAME?.trim() || "Acadly";

function friendlyAuthError(error) {
  const message = error?.message || "Something went wrong. Please try again.";
  if (/invalid login credentials/i.test(message)) return "Email or password is incorrect. Check your details and try again.";
  if (/user already registered/i.test(message)) return "An account with this email already exists. Sign in instead.";
  if (/password should be at least/i.test(message)) return "Choose a stronger password with at least 8 characters.";
  if (/email not confirmed/i.test(message)) return "Please verify your email before signing in. Check your inbox and spam folder.";
  if (/rate limit|too many requests/i.test(message)) return "Too many attempts. Please wait a little before trying again.";
  return message;
}

export function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showResend, setShowResend] = useState(false);

  useEffect(() => {
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setMode("update-password");
        setNotice("Choose a new password for your account.");
      }
    });
    return () => data.subscription.unsubscribe();
  }, [onAuthenticated]);

  function switchMode(next) {
    setMode(next);
    setError("");
    setNotice("");
    setShowResend(false);
    setPassword("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "signup") {
        if (password.length < 8) throw new Error("Password should be at least 8 characters.");
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim() || "Student" },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (authError) throw authError;
        if (data.session) onAuthenticated(data.session);
        else {
          setMode("login");
          setPassword("");
          setNotice("Account created. Open the verification link sent to your email, then return here to sign in.");
        }
      } else if (mode === "login") {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) {
          setShowResend(/email not confirmed/i.test(authError.message));
          throw authError;
        }
        if (data.session) onAuthenticated(data.session);
      } else if (mode === "forgot") {
        const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (authError) throw authError;
        setNotice("If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.");
      } else if (mode === "update-password") {
        if (password.length < 8) throw new Error("Password should be at least 8 characters.");
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setNotice("Your password has been updated. You are now signed in.");
      }
    } catch (authError) {
      setError(friendlyAuthError(authError));
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (resendError) throw resendError;
      setNotice("Verification email sent. Check your inbox and spam folder.");
      setShowResend(false);
    } catch (resendError) {
      setError(friendlyAuthError(resendError));
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";
  const isUpdate = mode === "update-password";
  const title = isSignup ? "Create your account" : isForgot ? "Reset your password" : isUpdate ? "Set a new password" : "Welcome back";
  const subtitle = isSignup
    ? "A calmer, more organized way to study starts here."
    : isForgot
      ? "We'll email you a secure link to reset your password."
      : isUpdate
        ? "Choose a strong password you haven't used before."
        : "Sign in to continue to your learning space.";

  return (
    <main className="auth-page">
      <div className="auth-ambient auth-ambient-one" />
      <div className="auth-ambient auth-ambient-two" />
      <section className="auth-card" aria-labelledby="auth-title">
        <a className="auth-brand" href="/" aria-label={`${BRAND_NAME} home`}>
          <span className="auth-brand-mark"><GraduationCap size={22} /></span>
          <strong>{BRAND_NAME}<i>.</i></strong>
        </a>
        <div className="auth-heading">
          <span className="auth-heading-icon"><ShieldCheck size={19} /></span>
          <p className="auth-eyebrow">YOUR PRIVATE STUDY SPACE</p>
          <h1 id="auth-title">{title}</h1>
          <p>{subtitle}</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="auth-alert" role="alert">
            <strong>Authentication isn't configured yet.</strong>
            <span>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env, then restart Vite.</span>
          </div>
        )}
        {error && <div className="auth-message auth-error" role="alert">{error}</div>}
        {notice && <div className="auth-message auth-success" role="status">{notice}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && (
            <label className="auth-label">
              Your name
              <span className="auth-input-wrap">
                <UserRound size={16} />
                <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="How should we call you?" maxLength={80} required />
              </span>
            </label>
          )}
          {!isUpdate && (
            <label className="auth-label">
              Email address
              <span className="auth-input-wrap">
                <Mail size={16} />
                <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
              </span>
            </label>
          )}
          {!isForgot && (
            <label className="auth-label">
              {isUpdate ? "New password" : "Password"}
              <span className="auth-input-wrap">
                <LockKeyhole size={16} />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={isSignup || isUpdate ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
                <button type="button" className="auth-eye" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>
          )}
          {mode === "login" && (
            <div className="auth-forgot-row">
              <button type="button" onClick={() => switchMode("forgot")}>Forgot password?</button>
            </div>
          )}
          <button className="auth-submit" type="submit" disabled={busy || !isSupabaseConfigured}>
            {busy ? <LoaderCircle className="auth-spinner" size={17} /> : null}
            {busy ? "Please wait..." : isSignup ? "Create account" : isForgot ? "Send reset link" : isUpdate ? "Update password" : "Sign in"}
            <span aria-hidden="true">→</span>
          </button>
        </form>

        {showResend && (
          <button type="button" className="auth-inline-link" onClick={resendVerification} disabled={busy}>
            Resend verification email
          </button>
        )}
        <div className="auth-switch">
          {isSignup
            ? <>Already have an account? <button type="button" onClick={() => switchMode("login")}>Sign in</button></>
            : isForgot || isUpdate
              ? <button type="button" onClick={() => switchMode("login")}><ArrowLeft size={14} /> Back to sign in</button>
              : <>New to {BRAND_NAME}? <button type="button" onClick={() => switchMode("signup")}>Create a free account</button></>}
        </div>
        <p className="auth-privacy"><LockKeyhole size={12} /> Your study data is private and protected by account-level access rules.</p>
      </section>
      <footer className="auth-footer">Free for every student <span>·</span> Made for focused learning</footer>
    </main>
  );
}
