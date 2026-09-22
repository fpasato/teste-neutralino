// Sidebar.jsx
import { useNavigate } from "react-router-dom";
import styles from "./styles.module.css";

import { MdRule, MdOutlineDashboard, MdEmergencyShare } from "react-icons/md";
import { RxExit } from "react-icons/rx";
import { TbAlertSquare } from "react-icons/tb";
import { FaUsers } from "react-icons/fa6";
import { AiOutlineAudit } from "react-icons/ai";
import { GrMapLocation } from "react-icons/gr";

import { useAuth } from "../../contexts/AuthContext";
import { signOut } from "../../services/supabase/auth";

const ROLE_LABELS = {
  admin: "Administrador",
  supervisor: "Supervisor",
  attendant: "Atendente",
};

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function Sidebar() {
  const navigate = useNavigate();
  const { attendant } = useAuth();

  const canAccessUsers =
    attendant?.role === "admin" || attendant?.role === "supervisor";

  const onlyAdmin = attendant?.role === "admin";

  async function handleSignOut() {
    try {
      await signOut();
      navigate("/");
    } catch (err) {
      console.error("Erro ao sair:", err);
    }
  }

  // Helper: navega só se habilitado, pra não duplicar lógica
  function goTo(path, enabled = true) {
    if (enabled) navigate(path);
  }

  if (!attendant) return null;

  return (
    <div className={styles.sidebar}>
      <div className={styles.menuContainer}>
        <h3>Menu</h3>
        <nav className={styles.menu}>
          <button
            type="button"
            className={styles.navLink}
            onClick={() => goTo("/home")}
          >
            <MdEmergencyShare /> Ocorrências
          </button>
          <button
            type="button"
            className={styles.navLink}
            onClick={() => goTo("/mapview")}
          >
            <GrMapLocation /> Mapa
          </button>
          <button
            type="button"
            className={`${styles.navLink} ${
              !canAccessUsers ? styles.disabled : ""
            }`}
            onClick={() => goTo("/dashboard", canAccessUsers)}
            disabled={!canAccessUsers}
          >
            <MdOutlineDashboard /> Dashboard
          </button>
        </nav>
      </div>

      <div className={styles.adminSection}>
        <h3>Administração</h3>
        <nav className={styles.menu}>
          <button
            type="button"
            className={`${styles.navLink} ${
              !canAccessUsers ? styles.disabled : ""
            }`}
            onClick={() => goTo("/profiles", canAccessUsers)}
            disabled={!canAccessUsers}
          >
            <FaUsers /> Usuários
          </button>
          <button
            type="button"
            className={`${styles.navLink} ${
              !canAccessUsers ? styles.disabled : ""
            }`}
            onClick={() => goTo("/attendants", canAccessUsers)}
            disabled={!canAccessUsers}
          >
            <MdRule /> Perfis e Permissões
          </button>
          <button
            type="button"
            className={`${styles.navLink} ${
              !canAccessUsers ? styles.disabled : ""
            }`}
            onClick={() => goTo("/sos", canAccessUsers)}
            disabled={!canAccessUsers}
          >
            <TbAlertSquare /> Ocorrências
          </button>
          <button
            type="button"
            className={`${styles.navLink} ${
              !onlyAdmin ? styles.disabled : ""
            }`}
            onClick={() => goTo("/audit", onlyAdmin)}
            disabled={!onlyAdmin}
          >
            <AiOutlineAudit /> Auditoria
          </button>
        </nav>
      </div>

      <div className={styles.footer}>
        <div className={styles.userArea}>
          <div className={styles.avatar} data-active={attendant.active}>
            {getInitials(attendant.name)}
            <span
              className={styles.statusDot}
              data-active={attendant.active}
              title={attendant.active ? "Ativo" : "Inativo"}
            />
          </div>
          <div className={styles.userText}>
            <span className={styles.userName}>{attendant.name}</span>
            <span className={styles.userRole}>
              {ROLE_LABELS[attendant.role] || attendant.role}
              {!attendant.active && (
                <span className={styles.inactiveBadge}> · Inativo</span>
              )}
            </span>
          </div>
        </div>
        <button
          type="button"
          className={styles.logoutButton}
          onClick={handleSignOut}
        >
          <RxExit /> Sair
        </button>

        <div className={styles.version}>
          <span>SOS Manager</span>
          <span>v1.0.1</span>
        </div>
      </div>
    </div>
  );
}