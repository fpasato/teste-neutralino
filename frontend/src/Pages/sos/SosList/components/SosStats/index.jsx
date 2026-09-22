// components/HomeComponents/SosStats/index.jsx
import { useNavigate } from "react-router-dom";
import { GoShieldCheck, GoAlert } from "react-icons/go";
import { LuTruck, LuClock1 } from "react-icons/lu";
import { FaUserCircle } from "react-icons/fa";
import { RiRadioButtonLine } from "react-icons/ri";

import { useSosStats } from "./scripts";
import { useAuth } from "../../../../../contexts/AuthContext";
import { signOut } from "../../../../../services/supabase/auth";
import styles from "./styles.module.css";

export function SosStats({ status, startDate, endDate, ibgeCode, ibgeCodes }) {
  const navigate = useNavigate();
  const { attendant } = useAuth();
  const { stats, error } = useSosStats({ status, startDate, endDate, ibgeCode, ibgeCodes });

  const total = stats?.total ?? "-";
  const inProgress = stats?.inProgress ?? "-";
  const finishedToday = stats?.finishedToday ?? "-";
  const avgResponseMinutes = stats?.avgResponseMinutes;
  const active = stats?.active ?? 0;

  async function handleSignOut() {
    try {
      await signOut();
      navigate("/login");
    } catch (err) {
      console.error("Erro ao sair:", err);
    }
  }

  return (
    <div className={styles.container}>
      {error && <p className={styles.errorText}>{error}</p>}
      <div className={styles.statsList}>
        <h2 className={styles.title}>Estatísticas</h2>
        {active > 0 && (
          <div className={`${styles.statItem} ${styles.statItemAlert}`}>
            <span className={styles.statIconAlert}><GoAlert /></span>
            <div className={styles.statInfo}>
              <span className={styles.statValueAlert}>{active}</span>
              <span className={styles.statLabel}>
                {active === 1 ? "ocorrência ativa aguardando" : "ocorrências ativas aguardando"}
              </span>
            </div>
          </div>
        )}

        <div className={styles.statItem}>
          <span className={styles.statIcon}><GoShieldCheck /></span>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{total}</span>
            <span className={styles.statLabel}>Total no filtro atual</span>
          </div>
        </div>

        <div className={styles.statItem}>
          <span className={styles.statIcon}><LuTruck /></span>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{inProgress}</span>
            <span className={styles.statLabel}>Em andamento</span>
          </div>
        </div>

        <div className={styles.statItem}>
          <span className={styles.statIcon}><LuClock1 /></span>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{finishedToday}</span>
            <span className={styles.statLabel}>Finalizados hoje</span>
          </div>
        </div>

        <div className={styles.statItem}>
          <span className={styles.statIcon}><LuClock1 /></span>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>
              {avgResponseMinutes != null ? `${avgResponseMinutes} min` : "-"}
            </span>
            <span className={styles.statLabel}>Tempo médio de resposta</span>
          </div>
        </div>
      </div>
    </div>
  );
}