import { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, LogIn, User, Waves } from "lucide-react";

type LoginPageProps = {
  onLogin: (name: string) => void;
};

const letters = ["R", "A", "P", "I", "D"];

export function LoginPage({ onLogin }: LoginPageProps) {
  const [introDone, setIntroDone] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setIntroDone(true), 3200);
    return () => window.clearTimeout(timer);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName || !password.trim()) {
      setError("Enter your username and password to continue.");
      return;
    }

    setError("");
    onLogin(trimmedName);
  }

  return (
    <main className="login-shell" aria-label="RAPID-AI login">
      <div className="login-ocean-animation" aria-hidden="true">
        <span className="login-swell one" />
        <span className="login-swell two" />
        <span className="login-swell three" />
        <span className="login-current one" />
        <span className="login-current two" />
        <span className="login-bubble b1" />
        <span className="login-bubble b2" />
        <span className="login-bubble b3" />
        <span className="login-bubble b4" />
      </div>

      <motion.section
        className={`login-panel ${introDone ? "ready" : "intro"}`}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <div className="login-brand-stage">
          <motion.div
            className="login-logo-lockup"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <span aria-hidden="true"><Waves size={22} /></span>
            <strong>RAPID-AI</strong>
          </motion.div>

          <motion.span
            className="login-brand-mark"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <Waves size={30} />
          </motion.span>

          <div className="login-wordmark" aria-label="RAPID-AI">
            {letters.map((letter, index) => (
              <motion.span
                key={letter}
                initial={{ opacity: 0, y: 22, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.36 + index * 0.24, duration: 0.52, ease: "easeOut" }}
              >
                {letter}
              </motion.span>
            ))}
            <motion.em
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.8, duration: 0.45 }}
            >
              -AI
            </motion.em>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: introDone ? 1 : 0 }}
            transition={{ duration: 0.35 }}
          >
            India disaster intelligence
          </motion.p>
        </div>

        {introDone && (
          <motion.form
            className="login-form"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <label>
              <span>Username</span>
              <div>
                <User size={18} />
                <input
                  autoFocus
                  type="text"
                  value={name}
                  placeholder="Enter username"
                  onChange={(event) => setName(event.currentTarget.value)}
                />
              </div>
            </label>

            <label>
              <span>Password</span>
              <div>
                <Lock size={18} />
                <input
                  type="password"
                  value={password}
                  placeholder="Enter password"
                  onChange={(event) => setPassword(event.currentTarget.value)}
                />
              </div>
            </label>

            {error && <p className="login-error">{error}</p>}

            <button type="submit">
              <LogIn size={18} />
              <span>Enter Home</span>
            </button>
          </motion.form>
        )}
      </motion.section>
    </main>
  );
}

