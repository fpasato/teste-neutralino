import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getOccurrenceDetails,
  getSosAuditTrail,
  extractStatusHistory,
  findLastKnownAttendantId,
  getAttendantSnapshot,
} from "../../../../services/supabase/sosDetails";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { OccurrenceMap } from "../../../../components/OccurrenceMap";
import {
  STATUS_LABELS,
  ROLE_LABELS,
  shortId,
  formatDateTime,
  formatDate,
  diffToHuman,
} from "../../../../utils/occurrenceFormat";
import styles from "./styles.module.css";

const STATUS_CLASS = {
  active: styles.statusActive,
  in_progress: styles.statusInProgress,
  finished: styles.statusFinished,
  cancelled: styles.statusCancelled,
  unresolved: styles.statusUnresolved,
};

const EVENT_LABELS = {
  SOS_CREATED: "SOS criado pelo solicitante",
  SOS_ACCEPTED: "SOS aceito por atendente",
  SOS_ASSIGNED: "Ocorrência atribuída a atendente",
  SOS_UNASSIGNED: "Atendente removido da ocorrência",
  SOS_REASSIGNED: "Ocorrência reatribuída",
  SOS_DISPATCHED: "Viatura despachada",
  SOS_FINISHED: "Ocorrência finalizada",
};

function Field({ label, children }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{children ?? "-"}</span>
    </div>
  );
}

export function OccurrenceDetails({ sosId, onBack, onAssign, onRemoveAttendant }) {
  const [occurrence, setOccurrence] = useState(null);
  const [audit, setAudit] = useState([]);
  const [pastAttendant, setPastAttendant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [details, trail] = await Promise.all([
        getOccurrenceDetails(sosId),
        getSosAuditTrail(sosId),
      ]);
      setOccurrence(details);
      setAudit(trail);

      // Atendente removido: a query principal não traz mais nada sobre ele
      // (attendant_id virou null), então buscamos o último conhecido no
      // audit_log só pra exibir quem atendeu, mesmo sem estar mais atribuído.
      if (!details.attendant_id) {
        const lastId = findLastKnownAttendantId(trail);
        setPastAttendant(lastId ? await getAttendantSnapshot(lastId) : null);
      } else {
        setPastAttendant(null);
      }
    } catch (err) {
      setError(err.message || "Não foi possível carregar a ocorrência.");
    } finally {
      setLoading(false);
    }
  }, [sosId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const statusHistory = useMemo(() => extractStatusHistory(audit), [audit]);

  // Atendente a exibir: o atual, ou — se removido — o último conhecido.
  const displayedAttendant = occurrence?.attendants || pastAttendant;
  const attendantWasRemoved = !occurrence?.attendants && !!pastAttendant;

  /**
   * Linha do tempo: junta criação, despacho, encerramento, cada localização
   * recebida e cada evento registrado na auditoria, tudo em ordem cronológica.
   */
  const timeline = useMemo(() => {
    if (!occurrence) return [];
    const items = [];

    items.push({
      at: occurrence.created_at,
      kind: "create",
      text: "Ocorrência criada pelo solicitante",
    });

    (occurrence.locations || []).forEach((loc, idx) => {
      items.push({
        at: loc.created_at,
        kind: "location",
        text: `Localização ${idx + 1} recebida — ${Number(loc.latitude).toFixed(5)}, ${Number(
          loc.longitude
        ).toFixed(5)}${loc.accuracy != null ? ` (±${Math.round(loc.accuracy)} m)` : ""}`,
      });
    });

    // Cada ação do service grava DUAS linhas em audit_log: uma genérica
    // (action='UPDATE'/'INSERT', via logAuditContext) e uma semântica
    // (action='EVENT', via logEvent). Pra narrativa da timeline usamos só
    // as semânticas — senão cada ação aparece duplicada (e o INSERT cru
    // do trigger de criação aparece sem tradução nenhuma).
    audit
      .filter((row) => row.action === "EVENT")
      .forEach((row) => {
        // A criação já entrou acima; evita duplicar.
        if (row.event_type === "SOS_CREATED") return;
        const label = EVENT_LABELS[row.event_type] || row.description || "Evento registrado";
        const who = row.changed_by_email ? ` — ${row.changed_by_email}` : "";
        items.push({
          at: row.created_at,
          kind: row.event_type === "SOS_DISPATCHED" ? "dispatch" : "event",
          text: `${label}${who}`,
        });
      });

    if (
      occurrence.dispatched_at &&
      !audit.some((r) => r.action === "EVENT" && r.event_type === "SOS_DISPATCHED")
    ) {
      items.push({ at: occurrence.dispatched_at, kind: "dispatch", text: "Viatura despachada" });
    }
    if (
      occurrence.closed_at &&
      !audit.some((r) => r.action === "EVENT" && r.event_type === "SOS_FINISHED")
    ) {
      items.push({ at: occurrence.closed_at, kind: "close", text: "Ocorrência encerrada" });
    }

    return items
      .filter((i) => i.at)
      .sort((a, b) => new Date(a.at) - new Date(b.at));
  }, [occurrence, audit]);

  function handleExportPdf() {
    const full = occurrence;
    if (!full) return;

    const region = full.municipalities?.regions?.name || "";
    const cityUf = full.municipalities
      ? `${full.municipalities.city}/${full.municipalities.uf}`
      : full.city
        ? `${full.city}/${full.uf || ""}`
        : "-";

    const attendantCityUf = displayedAttendant?.municipalities
      ? `${displayedAttendant.municipalities.city}/${displayedAttendant.municipalities.uf}`
      : "-";

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const marginX = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    let cursorY = 48;

    const ensureSpace = (needed) => {
      const pageHeight = doc.internal.pageSize.getHeight();
      if (cursorY + needed > pageHeight - 40) {
        doc.addPage();
        cursorY = 48;
      }
    };

    const sectionTitle = (text) => {
      ensureSpace(28);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text(text, marginX, cursorY);
      cursorY += 6;
      doc.setDrawColor(203, 213, 225);
      doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
      cursorY += 16;
    };

    // Cabeçalho
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(`Ocorrência ${shortId(full.id)}`, marginX, cursorY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${STATUS_LABELS[full.status] || full.status} · gerado em ${formatDateTime(new Date().toISOString())}`,
      marginX,
      cursorY + 16
    );
    cursorY += 40;

    // -------- Campos em pares (2 colunas) via autoTable sem cabeçalho --------
    const fieldsTable = (title, pairs) => {
      sectionTitle(title);
      autoTable(doc, {
        startY: cursorY,
        margin: { left: marginX, right: marginX },
        theme: "plain",
        styles: { fontSize: 9, cellPadding: 3, textColor: [30, 41, 59] },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 150, textColor: [71, 85, 105] },
          1: { cellWidth: pageWidth - marginX * 2 - 150 },
        },
        body: pairs.map(([label, value]) => [label, value ?? "-"]),
      });
      cursorY = doc.lastAutoTable.finalY + 18;
    };

    fieldsTable("Ocorrência", [
      ["ID", full.id],
      ["Status atual", STATUS_LABELS[full.status] || full.status],
      ["Criada em", formatDateTime(full.created_at)],
      ["Encerrada em", formatDateTime(full.closed_at)],
      ["Despachada em", formatDateTime(full.dispatched_at)],
      ["Previsão de chegada (ETA)", formatDateTime(full.dispatch_eta)],
      ["Tempo até o despacho", diffToHuman(full.created_at, full.dispatched_at)],
      ["Tempo total da ocorrência", diffToHuman(full.created_at, full.closed_at)],
    ]);

    fieldsTable("Local", [
      ["Cidade/UF", cityUf],
      ["Região", region],
      ["Código IBGE", full.ibge_code],
      ["Latitude (registro inicial)", full.latitude],
      ["Longitude (registro inicial)", full.longitude],
      ["Total de pontos de localização recebidos", full.locations.length],
    ]);

    fieldsTable("Solicitante", [
      ["ID", full.profiles?.id || full.user_id],
      ["Nome", full.profiles?.name],
      ["E-mail", full.profiles?.email || "(não disponível)"],
      ["CPF", full.profiles?.cpf],
      ["Data de nascimento", formatDate(full.profiles?.birth_date)],
      ["Telefone", full.profiles?.phone],
      ["Cadastrado em", formatDateTime(full.profiles?.created_at)],
    ]);

    fieldsTable("Atendente", [
      [
        "Situação",
        displayedAttendant
          ? attendantWasRemoved
            ? "Removido da ocorrência (dados do último atendimento)"
            : "Atribuído"
          : "Não atribuído",
      ],
      ["ID", displayedAttendant?.id],
      ["Nome", displayedAttendant?.name || "Não atribuído"],
      ["E-mail", displayedAttendant?.email],
      ["Cargo", ROLE_LABELS[displayedAttendant?.role] || displayedAttendant?.role],
      ["Cidade", attendantCityUf],
      ["Região", displayedAttendant?.municipalities?.regions?.name],
      ["Código IBGE", displayedAttendant?.ibge_code],
    ]);

    // -------- Linha do tempo --------
    ensureSpace(60);
    sectionTitle("Linha do tempo");
    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX },
      head: [["Data/Hora", "Evento"]],
      body: timeline.map((item) => [formatDateTime(item.at), item.text]),
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      columnStyles: { 0: { cellWidth: 90 } },
    });
    cursorY = doc.lastAutoTable.finalY + 18;

    // -------- Histórico de localizações (precisão total, sem arredondar) --------
    ensureSpace(60);
    sectionTitle("Histórico de localizações");
    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX },
      head: [["#", "Data/Hora", "Latitude", "Longitude", "Precisão (m)"]],
      body: full.locations.map((loc, idx) => [
        idx + 1,
        formatDateTime(loc.created_at),
        loc.latitude,
        loc.longitude,
        loc.accuracy ?? "-",
      ]),
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    });
    cursorY = doc.lastAutoTable.finalY + 18;

    // -------- Histórico de status --------
    ensureSpace(60);
    sectionTitle("Histórico de status");
    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX },
      head: [["Data/Hora", "De", "Para", "Responsável"]],
      body: statusHistory.map((h) => [
        formatDateTime(h.at),
        STATUS_LABELS[h.from] || h.from || "-",
        STATUS_LABELS[h.to] || h.to,
        h.by,
      ]),
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    });

    doc.save(`ocorrencia_${full.id.slice(0, 8)}.pdf`);
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <button className={styles.backButton} onClick={onBack}>
          ← Voltar
        </button>
        <div className={styles.placeholder}>Carregando ocorrência...</div>
      </div>
    );
  }

  if (error || !occurrence) {
    return (
      <div className={styles.page}>
        <button className={styles.backButton} onClick={onBack}>
          ← Voltar
        </button>
        <div className={styles.errorBanner}>{error || "Ocorrência não encontrada."}</div>
      </div>
    );
  }

  const municipality = occurrence.municipalities;
  // SOS finalizado ou cancelado é estado terminal: não pode reatribuir nem remover atendente.
  const isLocked = occurrence.status === "finished" || occurrence.status === "cancelled";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backButton} onClick={onBack} aria-label="Voltar para a lista">
          ← Voltar
        </button>

        <div className={styles.headerTitle}>
          <h2>Ocorrência {shortId(occurrence.id)}</h2>
          <span className={`${styles.badge} ${STATUS_CLASS[occurrence.status] || ""}`}>
            {STATUS_LABELS[occurrence.status] || occurrence.status}
          </span>
        </div>

        <div className={styles.headerActions}>
          <button
            className={styles.actionButton}
            onClick={() => onAssign?.(occurrence)}
            disabled={isLocked}
            title={isLocked ? "Ocorrência finalizada/cancelada não pode ser reatribuída" : undefined}
          >
            {occurrence.attendant_id ? "Reatribuir" : "Atribuir"}
          </button>
          {occurrence.attendant_id && (
            <button
              className={styles.actionButtonDanger}
              disabled={isLocked}
              title={isLocked ? "Ocorrência finalizada/cancelada não pode ter o atendente removido" : undefined}
              onClick={async () => {
                await onRemoveAttendant?.(occurrence);
                load();
              }}
            >
              Remover atendente
            </button>
          )}
          <button className={styles.actionButtonSecondary} onClick={handleExportPdf}>
            Exportar PDF
          </button>
        </div>
      </header>

      {isLocked && (
        <p className={styles.placeholder}>
          Esta ocorrência está {STATUS_LABELS[occurrence.status]?.toLowerCase()} e não aceita mais
          alterações de atendente.
        </p>
      )}

      <div className={styles.grid}>
        <section className={styles.card}>
          <h3>Ocorrência</h3>
          <div className={styles.fields}>
            <Field label="ID">{occurrence.id}</Field>
            <Field label="Status atual">
              {STATUS_LABELS[occurrence.status] || occurrence.status}
            </Field>
            <Field label="Criada em">{formatDateTime(occurrence.created_at)}</Field>
            <Field label="Encerrada em">{formatDateTime(occurrence.closed_at)}</Field>
            <Field label="Despachada em">{formatDateTime(occurrence.dispatched_at)}</Field>
            <Field label="Previsão de chegada">{formatDateTime(occurrence.dispatch_eta)}</Field>
            <Field label="Tempo até o despacho">
              {diffToHuman(occurrence.created_at, occurrence.dispatched_at)}
            </Field>
            <Field label="Tempo total da ocorrência">
              {diffToHuman(occurrence.created_at, occurrence.closed_at)}
            </Field>
          </div>
        </section>

        <section className={styles.card}>
          <h3>Local</h3>
          <div className={styles.fields}>
            <Field label="Cidade">{municipality?.city || occurrence.city}</Field>
            <Field label="UF">{municipality?.uf || occurrence.uf}</Field>
            <Field label="Região">{municipality?.regions?.name}</Field>
            <Field label="Código IBGE">{occurrence.ibge_code}</Field>
          </div>
        </section>

        <section className={styles.card}>
          <h3>Solicitante</h3>
          <div className={styles.fields}>
            <Field label="ID">{occurrence.profiles?.id || occurrence.user_id}</Field>
            <Field label="Nome">{occurrence.profiles?.name}</Field>
            <Field label="E-mail">{occurrence.profiles?.email}</Field>
            <Field label="CPF">{occurrence.profiles?.cpf}</Field>
            <Field label="Data de nascimento">{formatDate(occurrence.profiles?.birth_date)}</Field>
            <Field label="Telefone">{occurrence.profiles?.phone}</Field>
            <Field label="Cadastrado em">{formatDateTime(occurrence.profiles?.created_at)}</Field>
          </div>
        </section>

        <section className={styles.card}>
          <h3>Atendente</h3>
          {attendantWasRemoved && (
            <p className={styles.placeholder}>Removido da ocorrência — dados do último atendimento:</p>
          )}
          {displayedAttendant ? (
            <div className={styles.fields}>
              <Field label="ID">{displayedAttendant.id}</Field>
              <Field label="Nome">{displayedAttendant.name}</Field>
              <Field label="E-mail">{displayedAttendant.email}</Field>
              <Field label="Cargo">
                {ROLE_LABELS[displayedAttendant.role] || displayedAttendant.role}
              </Field>
              <Field label="Cidade">
                {displayedAttendant.municipalities
                  ? `${displayedAttendant.municipalities.city}/${displayedAttendant.municipalities.uf}`
                  : null}
              </Field>
              <Field label="Região">{displayedAttendant.municipalities?.regions?.name}</Field>
              <Field label="Código IBGE">{displayedAttendant.ibge_code}</Field>
            </div>
          ) : (
            <p className={styles.placeholder}>
              Nenhum atendente atribuído. Use “Atribuir” para designar alguém.
            </p>
          )}
        </section>

        <section className={`${styles.card} ${styles.mapCard}`}>
          <h3>Trajeto</h3>
          <OccurrenceMap locations={occurrence.locations} navigable />
        </section>

        <section className={`${styles.card} ${styles.scrollCard}`}>
          <h3>Linha do tempo</h3>
          <ol className={styles.timeline}>
            {timeline.length === 0 && <li className={styles.placeholder}>Sem registros.</li>}
            {timeline.map((item, idx) => (
              <li key={idx} className={styles.timelineItem} data-kind={item.kind}>
                <span className={styles.timelineTime}>{formatDateTime(item.at)}</span>
                <span className={styles.timelineText}>{item.text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className={`${styles.card} ${styles.scrollCard}`}>
          <h3>Histórico de localizações</h3>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>#</th>
                <th>Data/Hora</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Precisão</th>
              </tr>
            </thead>
            <tbody>
              {occurrence.locations.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.placeholder}>
                    Nenhuma localização registrada.
                  </td>
                </tr>
              )}
              {occurrence.locations.map((loc, idx) => (
                <tr key={loc.id}>
                  <td>{idx + 1}</td>
                  <td>{formatDateTime(loc.created_at)}</td>
                  <td>{Number(loc.latitude).toFixed(6)}</td>
                  <td>{Number(loc.longitude).toFixed(6)}</td>
                  <td>{loc.accuracy != null ? `${Math.round(loc.accuracy)} m` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={`${styles.card} ${styles.scrollCard}`}>
          <h3>Histórico de status</h3>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>De</th>
                <th>Para</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              {statusHistory.length === 0 && (
                <tr>
                  <td colSpan={4} className={styles.placeholder}>
                    Nenhuma mudança de status registrada.
                  </td>
                </tr>
              )}
              {statusHistory.map((h) => (
                <tr key={h.id}>
                  <td>{formatDateTime(h.at)}</td>
                  <td>{STATUS_LABELS[h.from] || h.from || "-"}</td>
                  <td>
                    <span className={`${styles.badge} ${STATUS_CLASS[h.to] || ""}`}>
                      {STATUS_LABELS[h.to] || h.to}
                    </span>
                  </td>
                  <td>{h.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

export default OccurrenceDetails;