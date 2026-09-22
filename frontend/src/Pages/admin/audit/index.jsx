import React, { useEffect, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import styles from "./styles.module.css";
import {
  getAuditLogs,
  getAuditStats,
  exportAuditLogsCsv,
} from "../../../services/supabase/audit";
import { getAllRegions, getMunicipalitiesByRegion } from "../../../services/supabase/municipalities";

import { IoMdPaper } from "react-icons/io";
import { GoDatabase } from "react-icons/go";
import { AiTwotoneThunderbolt } from "react-icons/ai";
import { FaUsersGear } from "react-icons/fa6";

const TABLE_NAMES = {
  attendants: "Atendentes",
  sos: "Ocorrências",
  audit_log: "Auditoria",
  profiles: "Usuários",
  locations: "Localizações",
};

const ACTION_LABELS = {
  INSERT: "INSERT",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  EVENT: "EVENTO",
};

function getChangedFields(oldData, newData) {
  if (!oldData && !newData) return [];
  if (!oldData)
    return Object.keys(newData).map((key) => ({
      field: key,
      from: null,
      to: newData[key],
    }));
  if (!newData)
    return Object.keys(oldData).map((key) => ({
      field: key,
      from: oldData[key],
      to: null,
    }));

  const fields = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  return [...fields]
    .filter(
      (key) => JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]),
    )
    .map((key) => ({ field: key, from: oldData[key], to: newData[key] }));
}

function formatValue(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

export function AuditTab() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [exporting, setExporting] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tableName, setTableName] = useState("all");
  const [action, setAction] = useState("all");

  const [regions, setRegions] = useState([]);
  const [regionId, setRegionId] = useState("all");
  const [ibgeCode, setIbgeCode] = useState("all");
  const [citiesInRegion, setCitiesInRegion] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);

  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));


  useEffect(() => {
    if (regionId === "all") {
      setCitiesInRegion([]);
      setIbgeCode("all");
      return;
    }
    setLoadingCities(true);
    getMunicipalitiesByRegion(regionId)
      .then(setCitiesInRegion)
      .finally(() => setLoadingCities(false));
    setIbgeCode("all");
  }, [regionId]);

  const currentFilters = { startDate, endDate, tableName, action, regionId, ibgeCode };

  const loadLogs = useCallback(
    async (targetPage = 1) => {
      setLoading(true);
      setError(null);
      try {
        const [logsResult, statsResult] = await Promise.all([
          getAuditLogs(currentFilters, targetPage),
          getAuditStats(currentFilters),
        ]);
        setLogs(logsResult.data);
        setTotalCount(logsResult.count || 0);
        setStats(statsResult);
        setPage(targetPage);
      } catch (err) {
        console.error(err);
        setError("Erro ao carregar auditoria.");
      } finally {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [startDate, endDate, tableName, action, regionId, ibgeCode],
  );

  useEffect(() => {
    loadLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilter() {
    loadLogs(1);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const count = await exportAuditLogsCsv(currentFilters);
      if (count === 0) {
        alert("Nenhum registro encontrado para os filtros atuais.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao exportar auditoria.");
    } finally {
      setExporting(false);
    }
  }

  function handleClear() {
    setStartDate("");
    setEndDate("");
    setTableName("all");
    setAction("all");
    setRegionId("all");
    setIbgeCode("all");
    setTimeout(() => loadLogs(1), 0);
  }

  function handleRowClick(log) {
    setSelectedLog((prev) => (prev?.id === log.id ? null : log));
  }

  function copyToClipboard(e, text) {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
  }

  const diffFields = selectedLog
    ? getChangedFields(selectedLog.old_data, selectedLog.new_data)
    : [];


  useEffect(() => {
    getAllRegions().then(setRegions);
  }, []);

  return (
    <div className={styles.container}>
      {/* FILTROS — filho direto do grid, ocupa as 2 colunas */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <label>Data Inicial</label>
          <input
            type="datetime-local"
            className={styles.filterInput}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className={styles.filterGroup}>
          <label>Data Final</label>
          <input
            type="datetime-local"
            className={styles.filterInput}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className={styles.filterGroup}>
          <label>Tabela / Módulo</label>
          <select
            className={styles.filterInput}
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
          >
            <option value="all">Todos</option>
            {Object.entries(TABLE_NAMES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label>Ação / Evento</label>
          <select
            className={styles.filterInput}
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="all">Todos</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label>Região</label>
          <select
            className={styles.filterInput}
            value={regionId}
            onChange={(e) => setRegionId(e.target.value)}
          >
            <option value="all">Todas</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label>Cidade</label>
          <select
            className={styles.filterInput}
            value={ibgeCode}
            onChange={(e) => setIbgeCode(e.target.value)}
            disabled={regionId === "all" || loadingCities}
          >
            <option value="all">
              {regionId === "all" ? "Selecione uma região" : "Todas"}
            </option>
            {citiesInRegion.map((c) => (
              <option key={c.ibge_code} value={c.ibge_code}>{c.city}</option>
            ))}
          </select>
        </div>
        <button className={styles.clearButton} onClick={handleClear}>
          Limpar
        </button>
        <button className={styles.filterButton} onClick={handleFilter}>
          Filtrar
        </button>
        <button
          className={styles.exportButton}
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? "Exportando..." : "Exportar"}
        </button>
      </div>

      {/* Coluna esquerda: estatísticas + gráficos, tabela */}
      <div className={styles.leftColumn}>
        {/* CARDS DE ESTATÍSTICA + GRÁFICOS (lado a lado) */}
        {stats && stats.total > 0 && (
          <div className={styles.statsAndChartsRow}>
            {/* Cards de estatística */}
            <div className={styles.statsCards}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Total de Registros</span>
                <div className={styles.statValueWithIcon}>
                  <span className={styles.statValue}>{stats.total}</span>
                  <IoMdPaper
                    className={`${styles.statIcon} ${styles.statRegister}`}
                  />
                </div>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Ações (CRUD)</span>
                <div className={styles.statValueWithIcon}>
                  <span className={styles.statValue}>{stats.crud}</span>
                  <GoDatabase
                    className={`${styles.statIcon} ${styles.statCrud}`}
                  />
                </div>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Eventos</span>
                <div className={styles.statValueWithIcon}>
                  <span className={styles.statValue}>{stats.events}</span>
                  <AiTwotoneThunderbolt
                    className={`${styles.statIcon} ${styles.statEvent}`}
                  />
                </div>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Usuários Ativos</span>
                <div className={styles.statValueWithIcon}>
                  <span className={styles.statValue}>{stats.activeUsers}</span>
                  <FaUsersGear
                    className={`${styles.statIcon} ${styles.statUser}`}
                  />
                </div>
              </div>
            </div>

            {/* Gráficos pequenos */}
            <div className={styles.chartsContainer}>
              <div className={styles.chartCard}>
                <h4 className={styles.chartTitle}>Atividade por Dia</h4>
                <div className={styles.chartBody}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={stats.byDay}
                      margin={{ top: 4, right: 6, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#94a3b8", fontSize: 9 }}
                        tickFormatter={(d) =>
                          d.slice(5).split("-").reverse().join("/")
                        }
                        stroke="#334155"
                        interval="preserveStartEnd"
                        minTickGap={20}
                        height={16}
                      />
                      <YAxis
                        tick={{ fill: "#94a3b8", fontSize: 9 }}
                        stroke="#334155"
                        allowDecimals={false}
                        width={24}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#0b1220",
                          border: "1px solid #1f2937",
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                        labelStyle={{ color: "#e2e8f0" }}
                        labelFormatter={(d) =>
                          new Date(d + "T00:00:00").toLocaleDateString()
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        name="Registros"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={styles.chartCard}>
                <h4 className={styles.chartTitle}>Ações por Tipo</h4>
                <div className={styles.donutWrapper}>
                  <div className={styles.donutChart}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.byAction}
                          dataKey="count"
                          nameKey="action"
                          innerRadius={26}
                          outerRadius={42}
                          paddingAngle={2}
                        >
                          {stats.byAction.map((entry) => (
                            <Cell
                              key={entry.action}
                              fill={entry.color}
                              stroke="none"
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "#0b1220",
                            border: "1px solid #1f2937",
                            borderRadius: 8,
                          }}
                          labelStyle={{ color: "#e2e8f0" }}
                          formatter={(value, name) => [
                            `${value} (${stats.byAction.find((a) => a.action === name)?.percent}%)`,
                            name,
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className={styles.donutLegend}>
                    {stats.byAction.map((entry) => (
                      <li key={entry.action}>
                        <span
                          className={styles.legendDot}
                          style={{ background: entry.color }}
                        />
                        <span>
                          {ACTION_LABELS[entry.action] || entry.action}
                        </span>
                        <span className={styles.legendValue}>
                          {entry.count} ({entry.percent}%)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && <p className={styles.errorMessage}>{error}</p>}

        {/* TABELA */}
        <div className={styles.tableWrapper}>
          {loading ? (
            <p className={styles.emptyState}>Carregando auditoria...</p>
          ) : logs.length === 0 ? (
            <p className={styles.emptyState}>
              Nenhum registro de auditoria encontrado.
            </p>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Ação/Evento</th>
                    <th>Tabela/Módulo</th>
                    <th>Descrição</th>
                    <th>Usuário</th>
                    <th>Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => handleRowClick(log)}
                      className={
                        selectedLog?.id === log.id ? styles.expandedRow : ""
                      }
                    >
                      <td>{new Date(log.created_at).toLocaleString()}</td>
                      <td>
                        <span
                          className={styles.actionBadge}
                          data-action={log.action}
                        >
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td>{TABLE_NAMES[log.table_name] || log.table_name}</td>
                      <td>{log.description || "—"}</td>
                      <td>{log.changed_by_email || "Sistema"}</td>
                      <td>
                        <div className={styles.idCell} title={log.record_id}>
                          {log.record_id?.split("-")[0]}...
                          <button
                            className={styles.copyButton}
                            onClick={(e) => copyToClipboard(e, log.record_id)}
                            title="Copiar ID completo"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect
                                x="9"
                                y="9"
                                width="13"
                                height="13"
                                rx="2"
                                ry="2"
                              ></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className={styles.pagination}>
                <span>
                  Mostrando {(page - 1) * PAGE_SIZE + 1} a{" "}
                  {Math.min(page * PAGE_SIZE, totalCount)} de {totalCount}{" "}
                  registros
                </span>
                <div className={styles.paginationControls}>
                  <button
                    disabled={page <= 1}
                    onClick={() => loadLogs(page - 1)}
                  >
                    {"<"}
                  </button>
                  <span>
                    {page} / {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => loadLogs(page + 1)}
                  >
                    {">"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {/* Coluna direita: painel de detalhes */}
      <div className={styles.rightColumn}>
        <div className={styles.sidePanel}>
          {selectedLog ? (
            <>
              <div className={styles.sidePanelHeader}>
                <h3>Detalhes da Ação</h3>
                <button onClick={() => setSelectedLog(null)}>✕</button>
              </div>

              <span
                className={styles.actionBadge}
                data-action={selectedLog.action}
              >
                {ACTION_LABELS[selectedLog.action] || selectedLog.action}
              </span>
              <p className={styles.sidePanelTimestamp}>
                {new Date(selectedLog.created_at).toLocaleString()}
              </p>

              <section className={styles.sidePanelSection}>
                <h4>Informações Gerais</h4>
                <dl>
                  <dt>Tabela / Módulo</dt>
                  <dd>
                    {TABLE_NAMES[selectedLog.table_name] ||
                      selectedLog.table_name}
                  </dd>
                  <dt>Registro</dt>
                  <dd>{selectedLog.record_id}</dd>
                  <dt>Usuário</dt>
                  <dd>{selectedLog.changed_by_email || "Sistema"}</dd>
                  <dt>Origem</dt>
                  <dd>{selectedLog.origin || "—"}</dd>
                  <dt>Descrição</dt>
                  <dd>{selectedLog.description || "—"}</dd>
                </dl>
              </section>

              {selectedLog.old_data && (
                <section className={styles.sidePanelSection}>
                  <h4>Dados Anteriores</h4>
                  <pre className={styles.diffPre}>
                    {JSON.stringify(selectedLog.old_data, null, 2)}
                  </pre>
                </section>
              )}

              {selectedLog.new_data && (
                <section className={styles.sidePanelSection}>
                  <h4>Novos Dados</h4>
                  <pre className={styles.diffPre}>
                    {JSON.stringify(selectedLog.new_data, null, 2)}
                  </pre>
                </section>
              )}

              {diffFields.length > 0 && (
                <section className={styles.sidePanelSection}>
                  <h4>Campos Alterados ({diffFields.length})</h4>
                  <ul className={styles.diffList}>
                    {diffFields.map((d) => (
                      <li key={d.field}>
                        <strong>{d.field}:</strong>
                        <span className={styles.diffFrom}>
                          {formatValue(d.from)}
                        </span>
                        {" → "}
                        <span className={styles.diffTo}>
                          {formatValue(d.to)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {selectedLog.metadata && (
                <section className={styles.sidePanelSection}>
                  <h4>Metadados</h4>
                  <dl>
                    {Object.entries(selectedLog.metadata).map(
                      ([key, value]) => (
                        <React.Fragment key={key}>
                          <dt>{key}</dt>
                          <dd>{formatValue(value)}</dd>
                        </React.Fragment>
                      ),
                    )}
                  </dl>
                </section>
              )}
            </>
          ) : (
            <div className={styles.sidePanelEmpty}>
              <IoMdPaper className={styles.sidePanelEmptyIcon} />
              <p className={styles.sidePanelEmptyTitle}>
                Nenhuma ação selecionada
              </p>
              <p className={styles.sidePanelEmptyText}>
                Clique em uma linha da tabela para ver os detalhes completos do
                registro, incluindo dados anteriores, alterações e metadados.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
