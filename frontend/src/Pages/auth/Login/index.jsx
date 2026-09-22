import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signIn } from "../../../services/supabase/auth";
import { useAuth } from "../../../contexts/AuthContext";
import styles from "./styles.module.css";

export function Login() {
  const navigate = useNavigate();
  const { attendant } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (attendant) {
      navigate("/home", { replace: true });
    }
  }, [attendant, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn({ email, password });
    } catch (err) {
      console.error(err);
      if (err.message && err.message.includes("Sua conta está desativada")) {
        setError(err.message);
      } else {
        setError("Email ou senha inválidos.");
      }
      setLoading(false); 
    }
  }

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <h1 className={styles.title}>SOS Manager</h1>
        <p className={styles.subtitle}>Entre com sua conta de atendente</p>

        <label className={styles.label}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className={styles.label}>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
