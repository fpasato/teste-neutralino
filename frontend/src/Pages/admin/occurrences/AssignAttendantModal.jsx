import { useEffect, useState } from "react";
import {
  getAssignableAttendants,
  assignSos,
  unassignSos,
} from "../../../services/supabase/sos";
import formStyles from "./modalStyles.module.css";

export default function AssignAttendantModal({ occurrence, onClose, onSuccess }) {
  const [attendants, setAttendants] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState(occurrence.attendant_id || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await getAssignableAttendants({
          ibgeCode: occurrence.ibge_code,
        });
        if (active) setAttendants(data);
      } catch (err) {
        if (active) setError(err.message || "Erro ao carregar atendentes.");
      } finally {
        if (active) setLoadingList(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [occurrence.ibge_code]);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      if (selectedId) {
        await assignSos(occurrence.id, selectedId);
      } else {
        await unassignSos(occurrence.id);
      }
      onSuccess();
    } catch (err) {
      setError(err.message || "Erro ao atribuir ocorrencia.");
      setSubmitting(false);
    }
  }

  return (
    <div className={formStyles.overlay}>
      <div className={formStyles.modal}>
        <div className={formStyles.modalHeader}>
          <h2 className={formStyles.title}>Atribuir ocorrência</h2>
          <button
            type="button"
            className={formStyles.closeButton}
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <p className={formStyles.subtitle}>
          Solicitante: <strong>{occurrence.profiles?.name || "-"}</strong>
          {occurrence.city ? ` - ${occurrence.city}/${occurrence.uf || ""}` : ""}
        </p>

        {error && <div className={formStyles.errorBanner}>{error}</div>}

        {loadingList ? (
          <p>Carregando atendentes...</p>
        ) : attendants.length === 0 ? (
          <p className={formStyles.emptyNotice}>
            Nenhum atendente ativo cadastrado neste municipio.
          </p>
        ) : (
          <div className={formStyles.field}>
            <label htmlFor="attendant-select">Atendente</label>
            <select
              id="attendant-select"
              value={selectedId || ""}
              onChange={(e) => setSelectedId(e.target.value)}
              className={formStyles.select}
            >
              <option value="">Nao atribuido</option>
              {attendants.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.role})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={formStyles.actions}>
          <button
            type="button"
            className={formStyles.cancelButton}
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={formStyles.confirmButton}
            onClick={handleConfirm}
            disabled={submitting || loadingList}
          >
            {submitting ? "Salvando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}