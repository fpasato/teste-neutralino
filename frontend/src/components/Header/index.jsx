// Header.jsx
import { useState, useEffect } from "react";
import styles from "./styles.module.css";
import logo from "../../assets/logo_3.png";


import { MdOutlineCalendarMonth } from "react-icons/md";
import { FaRegClock } from "react-icons/fa";

export function Header() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <img src={logo} alt="SOS Manager" className={styles.logo} />
      </div>
      <nav className={styles.nav}>
        <div className={styles.timeContainer}>
          <div className={styles.timeItem}>
            <MdOutlineCalendarMonth />
            <h3>{time.toLocaleDateString()}</h3>
          </div>
          <div className={styles.timeItem}>
            <FaRegClock />
            <p>{time.toLocaleTimeString()}</p>
          </div>
        </div>
      </nav>
    </header>
  );
}
