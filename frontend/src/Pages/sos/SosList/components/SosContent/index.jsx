import { useNavigate } from "react-router-dom";
import { PiMapPinSimpleBold } from "react-icons/pi";
import { HiMiniCalendarDateRange } from "react-icons/hi2";
import { FaRegClock, FaTreeCity } from "react-icons/fa6";

import { OccurrenceMap } from "../../../../../components/OccurrenceMap";
import { useSosContent } from "./scripts";
import styles from "./styles.module.css";

export function SosContent({
  selectedStatuses = [],
  startDate,
  endDate,
  sortBy,
  attendantId,
  ibgeCode,
  ibgeCodes,
  viewMode = "grid",
}) {
  const navigate = useNavigate();
  const {
    sosList,
    loading,
    error,
    getShortId,
    handleAttend,
    statusClassMap,
    statusLabelMap,
  } = useSosContent({
    selectedStatuses,
    startDate,
    endDate,
    sortBy,
    attendantId,
    ibgeCode,
    ibgeCodes,
  });

  if (loading) {
    return <div className={styles.stateMessage}>Carregando ocorrências...</div>;
  }

  if (error) {
    return <div className={styles.stateMessage}>Erro ao carregar: {error}</div>;
  }

  if (sosList.length === 0) {
    return (
      <div className={styles.stateMessage}>
        Nenhuma ocorrência encontrada com os filtros atuais.
      </div>
    );
  }

  const isList = viewMode === "list";

  return (
    <div className={styles.container}>
      <div className={isList ? styles.list : styles.grid}>
        {sosList.map((sos) => {
          const createdAt = new Date(sos.created_at);
          const formattedDate = createdAt.toLocaleDateString();
          const formattedTime = createdAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={sos.id}
              className={`${styles.card} ${isList ? styles.cardList : ""} ${sos.status === "active" ? styles.cardActive : ""}`}
              onClick={() => navigate(`/sos/${sos.id}`)}
            >
              <div className={styles.cardHeader}>
                <span
                  className={`${styles.statusBadge} ${styles[statusClassMap[sos.status]] || ""}`}
                >
                  {statusLabelMap[sos.status] || sos.status}
                </span>
                <h3 className={styles.name}>{getShortId(sos)}</h3>
              </div>

              <div className={styles.infoRow}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>
                    <FaTreeCity />
                  </span>
                  <span className={styles.infoValue}>{sos.city ?? "-"}</span>
                </div>
                <div>
                  <span className={styles.infoLabel}>
                    <PiMapPinSimpleBold />
                  </span>
                  <span className={styles.infoValue}>{sos.uf ?? "-"}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>
                    <HiMiniCalendarDateRange />
                  </span>
                  <span className={styles.infoValue}>{formattedDate}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>
                    <FaRegClock />
                  </span>
                  <span className={styles.infoValue}>{formattedTime}</span>
                </div>
              </div>

              {!isList && (
                <div className={styles.mapWrapper}>
                  <OccurrenceMap locations={sos.locations} />
                </div>
              )}

              <div className={styles.cardFooter}>
                <span className={styles.pointsBadge}>
                  <PiMapPinSimpleBold /> {sos.locations?.length ?? 0} pontos
                </span>

                {sos.status === "active" && (
                  <button
                    type="button"
                    className={styles.attendButton}
                    onClick={async (e) => {
                      e.stopPropagation();
                      const sosId = await handleAttend(sos.id);
                      if (sosId) navigate(`/sos/${sosId}`);
                    }}
                  >
                    Atender
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}