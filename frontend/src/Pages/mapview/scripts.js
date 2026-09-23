import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "../../contexts/AuthContext";
import {
  fetchOccurrencesByMunicipality,
  fetchOccurrencesByIbgeCodes,
  fetchAllOccurrences,
  subscribeToOccurrences,
  unsubscribeFromOccurrences,
  assumeOccurrence,
} from "../../services/supabase/mapService";
import {
  getAllRegions,
  getMunicipalitiesByRegion,
} from "../../services/supabase/municipalities";
import { useNavigate } from "react-router-dom";
import styles from "./styles.module.css";

export const STATUS_COLOR = {
  active: "#e53935",
  unresolved: "#4b4b4bff",
  in_progress: "#d3c423ff",
  finished: "#43a047",
  cancelled: "#d36221ff",
};

export const STATUS_LABEL = {
  active: "Aguardando",
  unresolved: "Aguardando",
  in_progress: "Em atendimento",
  finished: "Concluído",
  cancelled: "Cancelado",
};

export const OPEN_STATUSES = ["active", "in_progress", "unresolved"];
export const FALLBACK_CENTER = [-21.7947, -48.1756]; // Araraquara

export const TILE_LAYERS = {
  normal: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
};

export function makeIcon(status) {
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.active;
  const isActive = status === "active";
  const pulseRing = isActive ? `<span class="${styles.pulseRing}"></span>` : "";

  const iconHtml = `
    <div class="${styles.pinWrapper}">
      ${pulseRing}
      <svg viewBox="0 0 24 24" width="40" height="40">
        <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 7 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" fill="${color}"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    className: styles.sosMarkerIcon,
    html: iconHtml,
    iconSize: [40, 40],
    iconAnchor: [20, 40], // base do pino sobre a coordenada
  });
}


export function FitBounds({
  occurrences,
  cityLat,
  cityLng,
  shouldFitBounds = true,
  focusOnOccurrence, // nova prop
}) {
  const map = useMap();

  useEffect(() => {
    const timeout = setTimeout(() => map.invalidateSize(), 200);

    // Se houver uma nova ocorrência para focar, centralize nela
    if (
      focusOnOccurrence &&
      focusOnOccurrence.latitude != null &&
      focusOnOccurrence.longitude != null
    ) {
      map.setView([focusOnOccurrence.latitude, focusOnOccurrence.longitude], 15);
    } else {
      let targetOccurrences = occurrences.filter(
        (o) => (o.status === "active" || o.status === "unresolved") && o.latitude != null && o.longitude != null
      );

      if (targetOccurrences.length === 0) {
        targetOccurrences = occurrences.filter(
          (o) => o.status === "in_progress" && o.latitude != null && o.longitude != null
        );
      }

      const bounds = targetOccurrences.map((o) => [o.latitude, o.longitude]);

      if (shouldFitBounds && bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      } else if (cityLat != null && cityLng != null) {
        map.setView([cityLat, cityLng], 13);
      }
    }

    return () => clearTimeout(timeout);
  }, [occurrences, map, cityLat, cityLng, shouldFitBounds, focusOnOccurrence]);

  return null;
}

export function useMapView() {
  const { attendant } = useAuth();
  const navigate = useNavigate();

  const role = attendant?.role;
  const isAdmin = role === "admin";
  const isSupervisor = role === "supervisor";
  const canChooseScope = isAdmin || isSupervisor;
  const [lastInsertedOccurrence, setLastInsertedOccurrence] = useState(null);

  const ownIbgeCode = attendant?.ibge_code;
  const ownMunicipality = attendant?.municipalities;
  const ownRegionId = ownMunicipality?.region_id ?? null;
  const ownRegionName = ownMunicipality?.regions?.name ?? null;
  const cityLabel = ownMunicipality
    ? `${ownMunicipality.city} - ${ownMunicipality.uf}`
    : null;

  const defaultCenter = useMemo(() => {
    if (ownMunicipality?.latitude && ownMunicipality?.longitude) {
      return [ownMunicipality.latitude, ownMunicipality.longitude];
    }
    return FALLBACK_CENTER;
  }, [ownMunicipality]);

  const [occurrences, setOccurrences] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapType, setMapType] = useState("normal");
  const markerRefs = useRef({});

  const [regions, setRegions] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [regionId, setRegionId] = useState(isSupervisor ? ownRegionId : null);
  const [cityFilter, setCityFilter] = useState("all");

  useEffect(() => {
    if (!isAdmin) return;
    getAllRegions()
      .then(setRegions)
      .catch((err) => console.error("Erro ao buscar regiões:", err));
  }, [isAdmin]);

  useEffect(() => {
    if (!canChooseScope || !regionId) {
      setMunicipalities([]);
      return;
    }
    getMunicipalitiesByRegion(regionId)
      .then(setMunicipalities)
      .catch((err) =>
        console.error("Erro ao buscar municípios da região:", err),
      );
  }, [canChooseScope, regionId]);

  useEffect(() => setCityFilter("all"), [regionId]);

  const scope = useMemo(() => {
    if (!canChooseScope) return "city";
    if (isAdmin && !regionId) return "all";
    if (cityFilter !== "all") return "city";
    return "region";
  }, [canChooseScope, isAdmin, regionId, cityFilter]);

  const effectiveIbgeCode =
    scope === "city" ? (canChooseScope ? cityFilter : ownIbgeCode) : null;
  const regionIbgeCodes = useMemo(
    () => municipalities.map((m) => m.ibge_code),
    [municipalities],
  );

  const getRegionCenter = (municipalitiesList) => {
    if (!municipalitiesList || municipalitiesList.length === 0) return null;
    const valid = municipalitiesList.filter(
      (m) => m.latitude != null && m.longitude != null,
    );
    if (valid.length === 0) return null;
    const latSum = valid.reduce((sum, m) => sum + m.latitude, 0);
    const lngSum = valid.reduce((sum, m) => sum + m.longitude, 0);
    return [latSum / valid.length, lngSum / valid.length];
  };

  const fetchOccurrences = useCallback(async () => {
    setLoading(true);
    try {
      let data;
      if (scope === "all") {
        data = await fetchAllOccurrences();
      } else if (scope === "region") {
        data = await fetchOccurrencesByIbgeCodes(regionIbgeCodes);
      } else if (effectiveIbgeCode) {
        data = await fetchOccurrencesByMunicipality(effectiveIbgeCode);
      } else {
        data = [];
      }
      setOccurrences(data);
    } catch (err) {
      console.error("Erro ao buscar ocorrências:", err);
    } finally {
      setLoading(false);
    }
  }, [scope, regionIbgeCodes, effectiveIbgeCode]);

  useEffect(() => {
    fetchOccurrences();
  }, [fetchOccurrences]);

  useEffect(() => {
    if (scope === "city" && !effectiveIbgeCode) return;
    if (scope === "region" && regionIbgeCodes.length === 0) return;

    const filterCodes =
      scope === "all"
        ? null
        : scope === "region"
          ? regionIbgeCodes
          : [effectiveIbgeCode];

    const channel = subscribeToOccurrences(filterCodes, {
      onInsert: (o) => {
        setOccurrences((prev) => [o, ...prev]);
        setLastInsertedOccurrence(o);
      },
      onUpdate: (o) =>
        setOccurrences((prev) => {
          if (!OPEN_STATUSES.includes(o.status))
            return prev.filter((x) => x.id !== o.id);
          const exists = prev.some((x) => x.id === o.id);
          return exists
            ? prev.map((x) => (x.id === o.id ? o : x))
            : [o, ...prev];
        }),
      onDelete: (o) =>
        setOccurrences((prev) => prev.filter((x) => x.id !== o.id)),
    });

    return () => unsubscribeFromOccurrences(channel);
  }, [scope, effectiveIbgeCode, regionIbgeCodes]);

  const activeCount = occurrences.filter(
    (o) => o.status !== "finished" && o.status !== "cancelled",
  ).length;
  const inProgressCount = occurrences.filter(
    (o) => o.status === "in_progress",
  ).length;

  const handleSelect = (id) => {
    setSelectedId(id);
    markerRefs.current[id]?.openPopup();
  };

  const handleAssume = async (id) => {
    try {
      await assumeOccurrence(id, attendant?.id);
      navigate(`/sos/${id}`);
    } catch (err) {
      console.error("Erro ao assumir atendimento:", err);
    }
  };

  const occurrencesWithCoords = occurrences.filter(
    (o) => o.latitude != null && o.longitude != null,
  );
  const tileLayer = TILE_LAYERS[mapType];

  const selectedMunicipality =
    canChooseScope && cityFilter !== "all"
      ? municipalities.find((m) => String(m.ibge_code) === String(cityFilter))
      : null;

  let mapCenter = defaultCenter;

  if (
    canChooseScope &&
    cityFilter !== "all" &&
    selectedMunicipality?.latitude &&
    selectedMunicipality?.longitude
  ) {
    mapCenter = [selectedMunicipality.latitude, selectedMunicipality.longitude];
  } else if (scope === "region" && municipalities.length > 0) {
    const regionCenter = getRegionCenter(municipalities);
    if (regionCenter) mapCenter = regionCenter;
  }

  return {
    attendant,
    navigate,
    isAdmin,
    isSupervisor,
    canChooseScope,
    ownIbgeCode,
    cityLabel,
    regions,
    regionId,
    setRegionId,
    municipalities,
    cityFilter,
    setCityFilter,
    occurrences,
    selectedId,
    setSelectedId,
    loading,
    mapType,
    setMapType,
    markerRefs,
    activeCount,
    inProgressCount,
    handleSelect,
    handleAssume,
    occurrencesWithCoords,
    tileLayer,
    selectedMunicipality,
    mapCenter,
    scope,
    lastInsertedOccurrence
  };
}
