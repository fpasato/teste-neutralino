// components/CitySelector/index.jsx
import { useState, useRef, useEffect } from "react";
import { searchMunicipalities } from "../../services/supabase/municipalities";
import styles from "./styles.module.css";

export function CitySelector({ value, onChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchMunicipalities(query);
        setResults(data);
      } catch (err) {
        console.error("Erro ao buscar municípios:", err);
      } finally {
        setLoading(false);
      }
    }, 300); // espera 300ms depois que o usuário parou de digitar

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function handleSelect(municipio) {
    onChange(municipio); // { ibge_code, city, uf }
    setQuery(`${municipio.city} - ${municipio.uf}`);
    setShowResults(false);
  }

  return (
    <div className={styles.wrapper}>
      <input
        type="text"
        placeholder="Digite sua cidade"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowResults(true);
          if (value) onChange(null); // limpa seleção anterior se o usuário editar de novo
        }}
        onFocus={() => setShowResults(true)}
        required
      />

      {loading && <span className={styles.loading}>Buscando...</span>}

      {showResults && results.length > 0 && (
        <ul className={styles.resultsList}>
          {results.map((m) => (
            <li key={m.ibge_code} onClick={() => handleSelect(m)}>
              {m.city} - {m.uf}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}