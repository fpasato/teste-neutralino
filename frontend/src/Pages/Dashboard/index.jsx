  import {
    useDashboard,
    STATUS_LABELS,
    getShortId,
    buildAreaChartOptions,
    buildDonutChartOptions,
    toISODateOnly,
  } from "./scripts";
  import styles from "./styles.module.css";
  import Chart from "react-apexcharts";

  import { GoShield } from "react-icons/go";
  import { FiActivity } from "react-icons/fi";
  import { MdDoneOutline } from "react-icons/md";
  import { FaRegClock, FaRunning } from "react-icons/fa";
  import { IoIosCloseCircleOutline } from "react-icons/io";
  import { useNavigate } from "react-router-dom";
  import { useAuth } from "../../contexts/AuthContext";


  function Variacao({ value }) {
    const positivo = value >= 0;
    return (
      <span className={positivo ? styles.positivo : styles.negativo}>
        {positivo ? "▲" : "▼"} {Math.abs(value)}%
      </span>
    );
  }

  export function Dashboard() {
    const navigate = useNavigate();
    const { attendant } = useAuth();
    const {
      range,
      rangeError,
      stats,
      loading,
      refreshing,
      today,
      donutData,
      donutTotal,
      recentes,
      regions,
      municipalities,
      selectedRegion,
      selectedCity,
      regionName,
      setSelectedRegion,
      setSelectedCity,
      handleStartDateChange,
      handleEndDateChange,
    } = useDashboard(attendant);

    return (
      <div className={styles.container}>
        {/* Filtros de data */}
        <div className={styles.filterBar}>
          <div className={styles.dateField}>
            <label htmlFor="startDate">De</label>
            <input
              id="startDate"
              type="date"
              value={range.startDate}
              max={range.endDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className={styles.dateInput}
            />
          </div>
          <div className={styles.dateField}>
            <label htmlFor="endDate">Até</label>
            <input
              id="endDate"
              type="date"
              value={range.endDate}
              min={range.startDate}
              max={toISODateOnly(today)}
              onChange={(e) => handleEndDateChange(e.target.value)}
            />
          </div>

          <div className={styles.geoFilters}>
            {attendant?.role === "admin" && (
              <div className={styles.dateField}>
                <label htmlFor="regionSelect">Região</label>
                <select
                  id="regionSelect"
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                >
                  <option value="">Global (Todas)</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {attendant?.role === "supervisor" && (
              <div className={styles.dateField}>
                <label>Região</label>
                <input type="text" value={regionName || "Carregando..."} disabled />
              </div>
            )}

            {(selectedRegion || attendant?.role === "supervisor") && (
              <div className={styles.dateField}>
                <label htmlFor="citySelect">Cidade</label>
                <select
                  id="citySelect"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  disabled={!selectedRegion && attendant?.role !== "supervisor"}
                >
                  <option value="">Todas as cidades da região</option>
                  {municipalities.map((m) => (
                    <option key={m.ibge_code} value={m.ibge_code}>
                      {m.city}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {rangeError && <p className={styles.rangeError}>{rangeError}</p>}
          {refreshing && (
            <span className={styles.refreshDot} aria-label="Atualizando" />
          )}
        </div>

        {loading && !stats ? (
          <div className={styles.loading}>Carregando estatísticas...</div>
        ) : (
          <>
            {/* Cards de resumo */}
            <div className={styles.rowBlocks}>
              <div className={styles.block}>
                <h4 className={styles.blockTitle}>Ocorrências Totais</h4>
                <div className={styles.totalGeral}>
                  <span className={styles.blockValue}>
                    {stats.cards.totalGeral}
                  </span>
                  <GoShield className={styles.icon} />
                </div>
                <div className={styles.variacao}>
                  <Variacao value={stats.cards.pctTotalSemana} />
                  <p>vs semana anterior</p>
                </div>
              </div>

              <div className={styles.block}>
                <h4 className={styles.blockTitle}>Em andamento</h4>
                <div className={styles.emAndamento}>
                  <span className={styles.blockValue}>
                    {stats.cards.emAndamento}
                  </span>
                  <FiActivity className={styles.icon} />
                </div>
                <p className={styles.variacao}>
                  {stats.cards.pctEmAndamento}% do total
                </p>
              </div>

              <div className={styles.block}>
                <h4 className={styles.blockTitle}>Finalizadas hoje</h4>
                <div className={styles.finalizadasHoje}>
                  <span className={styles.blockValue}>
                    {stats.cards.finalizadasHoje}
                  </span>
                  <MdDoneOutline className={styles.icon} />
                </div>
                <p className={styles.variacao}>
                  <Variacao value={stats.cards.pctFinalizadasHoje} /> vs ontem
                </p>
              </div>

              <div className={styles.block}>
                <h4 className={styles.blockTitle}>Tempo médio de resposta</h4>
                <div className={styles.tempoMedio}>
                  <span className={styles.blockValue}>
                    {stats.cards.tempoMedioAtual} min
                  </span>
                  <FaRegClock className={styles.icon} />
                </div>
                <p className={styles.variacao}>
                  <Variacao value={stats.cards.pctTempoMedio} /> vs semana
                  anterior
                </p>
              </div>

              <div className={styles.block}>
                <h4 className={styles.blockTitle}>Canceladas</h4>
                <div className={styles.canceladas}>
                  <span className={styles.blockValue}>
                    {stats.cards.canceladas}
                  </span>
                  <IoIosCloseCircleOutline className={styles.icon} />
                </div>
                <p className={styles.variacao}>
                  <Variacao value={stats.cards.pctCanceladas} /> vs semana
                  anterior
                </p>
              </div>
            </div>

            {/* Gráfico de linha + heatmap */}
            <div className={styles.graphContainer}>
              <div className={styles.graph}>
                <h4>Ocorrências ao longo do tempo</h4>
                <Chart
                  type="area"
                  height={250}
                  series={[
                    {
                      name: "Ocorrências",
                      data: stats.lineData.map((d) => d.total),
                    },
                  ]}
                  options={buildAreaChartOptions(stats.lineData)}
                />
              </div>

              <div className={styles.graph}>
                <h4>Ocorrências por dia da semana e horário</h4>
                <div className={styles.heatmapWrapper}>
                  <div className={styles.heatmapHeaderRow}>
                    <div className={styles.heatmapCorner} />
                    {Array.from({ length: 24 }, (_, hour) => (
                      <div key={hour} className={styles.heatmapHourLabel}>
                        {hour}
                      </div>
                    ))}
                  </div>
                  {stats.heatmapMatrix.rows.map((row) => (
                    <div key={row.label} className={styles.heatmapRow}>
                      <div className={styles.heatmapDayLabel}>{row.label}</div>
                      {row.cells.map((cell) => (
                        <div
                          key={cell.hour}
                          className={styles.heatmapCell}
                          style={{
                            backgroundColor: `rgba(246,59,59,${cell.count === 0
                                ? 0.05
                                : 0.15 + cell.intensity * 0.85
                              })`,
                          }}
                          title={`${row.label} ${cell.hour}h - ${cell.count} ocorrência(s)`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Gráfico de rosca + ocorrências recentes */}
            <div className={styles.subInfoContainer}>
              <div className={styles.donutBlock}>
                <h4>Status das ocorrências</h4>
                <div className={styles.donutRow}>
                  <div className={styles.donutChartWrapper}>
                    <Chart
                      type="donut"
                      width="100%"
                      height={Math.min(220, window.innerHeight * 0.2)}
                      series={donutData.map((d) => d.value)}
                      options={buildDonutChartOptions(donutData)}
                    />
                  </div>
                  <ul className={styles.donutLegend}>
                    {donutData.map((s) => (
                      <li key={s.name}>
                        <span
                          className={styles.legendDot}
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name}: {s.value}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className={styles.recentBlock}>
                <div className={styles.recentHeader}>
                  <h4>Ocorrências recentes</h4>
                  <button onClick={() => {
                    const params = new URLSearchParams();
                    if (selectedRegion) params.set('region', selectedRegion);
                    if (selectedCity) params.set('city', selectedCity);
                    navigate(`/home?${params.toString()}`);
                  }}>Ver todas</button>
                </div>

                <ul className={styles.recentList}>
                  {recentes.length === 0 && (
                    <li>Nenhuma ocorrência no período.</li>
                  )}
                  {recentes.map((sos) => (
                    <li key={sos.id}>
                      {/* icones de status */}
                      {sos.status === "active" && (
                        <FaRunning
                          className={`${styles.statusIcon} ${styles.statusActiveIcon}`}
                        />
                      )}
                      {sos.status === "finished" && (
                        <MdDoneOutline
                          className={`${styles.statusIcon} ${styles.statusFinishedIcon}`}
                        />
                      )}
                      {sos.status === "in_progress" && (
                        <FiActivity
                          className={`${styles.statusIcon} ${styles.statusInProgressIcon}`}
                        />
                      )}
                      {sos.status === "cancelled" && (
                        <IoIosCloseCircleOutline
                          className={`${styles.statusIcon} ${styles.statusCancelledIcon}`}
                        />
                      )}
                      <h4>{getShortId(sos)}</h4>
                      {sos.status === "active" && (
                        <span
                          className={`${styles.statusText} ${styles.statusActive}`}
                        >
                          {STATUS_LABELS.active}
                        </span>
                      )}
                      {sos.status === "finished" && (
                        <span
                          className={`${styles.statusText} ${styles.statusFinished}`}
                        >
                          {STATUS_LABELS.finished}
                        </span>
                      )}
                      {sos.status === "in_progress" && (
                        <span
                          className={`${styles.statusText} ${styles.statusInProgress}`}
                        >
                          {STATUS_LABELS.in_progress}
                        </span>
                      )}
                      {sos.status === "cancelled" && (
                        <span
                          className={`${styles.statusText} ${styles.statusCancelled}`}
                        >
                          {STATUS_LABELS.cancelled}
                        </span>
                      )}
                      <span>
                        {new Date(sos.created_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }
