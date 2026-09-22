import { MdArrowBack } from "react-icons/md";
import { BsTelephone } from "react-icons/bs";
import { HiMiniCalendarDateRange } from "react-icons/hi2";
import { FiClock } from "react-icons/fi";
import { PiMapPinSimpleBold } from "react-icons/pi";
import { GiPoliceOfficerHead } from "react-icons/gi";
import {TbReport } from "react-icons/tb";
import { FaTruck, FaUserAlt} from "react-icons/fa";

import { OccurrenceMap } from "../../../components/OccurrenceMap";
import { useSosDetail } from "./scripts";
import styles from "./styles.module.css";

export function SosDetail() {
  const {
    sos,
    loading,
    error,
    attendant,
    accuracy,
    getShortId,
    formattedDate,
    formattedTime,
    statusLabelMap,
    isFinished,
    sortedLocations,
    handleAttend,
    handleDispatch,
    handleFinish,
    goBack,
    getElapsedTime,
    getVehicleStatus,
  } = useSosDetail();

  if (loading)
    return <div className={styles.stateMessage}>Carregando ocorrência...</div>;

  if (error || !sos) {
    return (
      <div className={styles.stateMessage}>
        {error ?? "Ocorrência não encontrada."}
        <button type="button" onClick={goBack}>
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <button type="button" className={styles.backButton} onClick={goBack}>
        <MdArrowBack /> Voltar
      </button>

      <div className={styles.layout}>
        {/* Coluna esquerda: mapa */}
        <div className={styles.mapColumn}>
          <div className={styles.mapWrapper}>
            <OccurrenceMap locations={sos.locations} navigable />
          </div>
        </div>

        {/* Coluna direita: painel */}
        <div className={styles.sidePanel}>
          {/* Painéis de informações */}
          <div className={styles.infoContainer}>
            <div className={styles.infoPanel}>
              <div className={styles.infoHeader}>
                <h1 className={styles.name}>Informações do SOS</h1>
                <span
                  className={`${styles.statusBadge} ${styles[`status_${sos.status}`] ?? ""}`}
                >
                  {statusLabelMap[sos.status] ?? sos.status}
                </span>
              </div>
              <ul className={styles.infoList}>
                <li className={styles.infoItem}>
                  <h4>
                    <TbReport /> ID da Ocorrência:
                  </h4>
                  <span>{getShortId()}</span>
                </li>
                <li className={styles.infoItem}>
                  <h4>
                    <BsTelephone /> Telefone:
                  </h4>
                  <span>{sos.profiles?.phone ?? "-"}</span>
                </li>
                <li className={styles.infoItem}>
                  <h4>
                    <HiMiniCalendarDateRange /> Data de Envio:
                  </h4>
                  <span>
                    {formattedDate} {formattedTime}
                  </span>
                </li>
                <li className={styles.infoItem}>
                  <h4>
                    <FiClock /> Tempo Decorrido:
                  </h4>
                  <span>{getElapsedTime(sos.created_at)}</span>
                </li>
                <li className={styles.infoItem}>
                  <h4>
                    <PiMapPinSimpleBold /> Pontos Recebidos:
                  </h4>
                  <span>{sos.locations?.length ?? 0}</span>
                </li>
                <li className={styles.infoItem}>
                  <h4>
                    <FaUserAlt /> Enviado Por:
                  </h4>
                  <span>{sos.profiles?.name ?? "-"}</span>
                </li>
                <li className={styles.infoItem}>
                  <h4>
                    <GiPoliceOfficerHead /> Atendido Por:
                  </h4>
                  <span
                    style={{
                      color: sos.attendants?.name
                        ? "var(--finished)"
                        : "var(--cancelled)",
                    }}
                  >
                    {sos.attendants?.name ?? "Aguardando atendimento"}
                  </span>
                </li>
              </ul>
            </div>

            <div className={styles.infoPanel}>
              <h1 className={styles.name}>Localização</h1>
              <ul className={styles.infoList}>
                <li className={styles.infoItem}>
                  Latitude: <span>{sos.latitude?.toFixed(6) ?? "-"}</span>
                </li>
                <li className={styles.infoItem}>
                  Longitude: <span>{sos.longitude?.toFixed(6) ?? "-"}</span>
                </li>
                <li className={styles.infoItem}>
                  Precisão:{" "}
                  <span>
                    {accuracy != null ? `${accuracy.toFixed(1)} m` : "-"}
                  </span>
                </li>
                <li className={styles.infoItem}>
                  Cidade: <span>{sos.city ?? "-"}</span>
                </li>
                <li className={styles.infoItem}>
                  Estado: <span>{sos.uf ?? "-"}</span>
                </li>
              </ul>
            </div>

            <div className={styles.actionsContainer}>
              {!isFinished ? (
                sos.attendant_id === attendant.id ? (
                  <div className={styles.actions}>
                    <div className={styles.vehicleStatus}>
                      <h4>
                        <FaTruck /> Status da Viatura:
                      </h4>
                      <span>{getVehicleStatus(sos)}</span>
                    </div>
                    <div className={styles.actionButtons}>
                      <button
                        type="button"
                        className={styles.dispatchButton}
                        onClick={handleDispatch}
                        disabled={!!sos.dispatched_at}
                      >
                        {sos.dispatched_at
                          ? "Viatura a caminho..."
                          : "Despachar viatura"}
                      </button>
                      <button
                        type="button"
                        className={styles.finishButton}
                        onClick={handleFinish}
                      >
                        Finalizar
                      </button>
                    </div>
                  </div>
                ) : sos.attendant_id ? (
                  <div className={styles.readOnlyMessage}>
                    Este chamado está sendo atendido por{" "}
                    {sos.attendants?.name ?? "outro atendente"}.
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.attendButton}
                    onClick={handleAttend}
                  >
                    Atender
                  </button>
                )
              ) : (
                <div className={styles.finishedMessage}>
                  Esta ocorrência já foi encerrada
                  {sos.closed_at &&
                    ` em ${new Date(sos.closed_at).toLocaleString()}`}
                  .
                </div>
              )}
            </div>
          </div>

          {/* Tabela de coordenadas */}
          <div className={`${styles.panelCard} ${styles.coordsFullWidth}`}>
            <h2 className={styles.sectionTitle}>
              <PiMapPinSimpleBold /> Localizações recebidas
            </h2>

            <div className={styles.tableWrapper}>
              {sortedLocations.length === 0 ? (
                <div className={styles.emptyLocations}>
                  Nenhuma localização recebida ainda.
                </div>
              ) : (
                <table className={styles.coordsTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Hora</th>
                      <th>Latitude</th>
                      <th>Longitude</th>
                      <th>Precisão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...sortedLocations].reverse().map((loc, index) => {
                      const locTime = new Date(
                        loc.created_at,
                      ).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      });
                      return (
                        <tr
                          key={
                            loc.id ??
                            `${loc.latitude}-${loc.longitude}-${index}`
                          }
                        >
                          <td>{index + 1}</td>
                          <td>{locTime}</td>
                          <td>{loc.latitude.toFixed(6)}</td>
                          <td>{loc.longitude.toFixed(6)}</td>
                          <td>
                            {loc.accuracy != null
                              ? `${loc.accuracy.toFixed(1)} m`
                              : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
