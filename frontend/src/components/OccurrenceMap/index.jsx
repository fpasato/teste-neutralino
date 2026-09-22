import { useMemo, memo } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import styles from "./styles.module.css";

// Função para criar ícone numerado
const createNumberedIcon = (number, color = "var(--active)") => {
  return L.divIcon({
    className: "numbered-icon",
    html: `<div style="
      background: ${color};
      color: white;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      border: 2px solid white;
      box-shadow: 0 0 4px rgba(0,0,0,0.3);
    ">${number}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const OccurrenceMap = memo(function OccurrenceMap({
  locations = [],
  navigable = false,
}) {
  // Memoriza os arrays de pontos, evitando recálculos a cada renderização
  const { points, firstPoint, lastPoint, middlePoints } = useMemo(() => {
    if (!locations || locations.length === 0) {
      return {
        points: [],
        firstPoint: null,
        lastPoint: null,
        middlePoints: [],
      };
    }

    const pts = locations.map((loc) => [loc.latitude, loc.longitude]);
    return {
      points: pts,
      firstPoint: pts[0],
      lastPoint: pts[pts.length - 1],
      middlePoints: pts.slice(1, -1),
    };
  }, [locations]);

  if (points.length === 0) {
    return <div className={styles.empty}>Sem localização registrada</div>;
  }

  return (
    <MapContainer
      key={navigable ? "navigable" : "static"}
      bounds={points}
      boundsOptions={{ padding: [20, 20] }}
      scrollWheelZoom={navigable}
      dragging={navigable}
      zoomControl={navigable}
      doubleClickZoom={navigable}
      touchZoom={navigable}
      className={navigable ? styles.mapNavigable : styles.map}
      whenReady={() => {}}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors"
        updateWhenIdle
        keepBuffer={4}
      />

      <Polyline positions={points} color="#2563eb" weight={4} />

      {middlePoints.map((point, index) => {
        const globalNumber = index + 2;
        return (
          <Marker
            key={index}
            position={point}
            icon={createNumberedIcon(globalNumber, "var(--active)")}
          >
            <Popup>Ponto {globalNumber}</Popup>
          </Marker>
        );
      })}

      <Marker position={firstPoint} icon={createNumberedIcon(1, "var(--finished)")}>
        <Popup>Início</Popup>
      </Marker>

      {points.length > 1 && (
        <Marker
          position={lastPoint}
          icon={createNumberedIcon(points.length, "var(--accent)")}
        >
          <Popup>Última localização</Popup>
        </Marker>
      )}
    </MapContainer>
  );
});

export { OccurrenceMap };
