import { FiClock } from "react-icons/fi";
import { HiMiniCalendarDateRange } from "react-icons/hi2";
import styles from "./styles.module.css";
import { useNow, capitalize } from "../../hooks/useNow.js";
import logo from "../../assets/logo_2.png";

export function Header() {
  const now = useNow();

  const time = now.toLocaleTimeString("pt-BR", { hour12: false });
  const date = now.toLocaleDateString("pt-BR");
  const weekday = capitalize(
    now.toLocaleDateString("pt-BR", { weekday: "long" })
  );

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <img src={logo} alt="Logo" className={styles.logo} />
      </div>

      <div className={styles.timeContainer}>
        <div className={styles.timeItem}>
          <FiClock />
          <div className={styles.timeContent}>
            <h3>{time}</h3>
            <p>Horário</p>
          </div>
        </div>

        <span className={styles.timeDivider} />

        <div className={styles.timeItem}>
          <HiMiniCalendarDateRange />
          <div className={styles.timeContent}>
            <h3>{date}</h3>
            <p>{weekday}</p>
          </div>
        </div>
      </div>
    </header>
  );
}