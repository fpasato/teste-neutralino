import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Detecta uma combinação de teclas e força a navegação de volta pra /home.
 *
 * Serve como "trava de segurança": se o atendente clicar em algum link
 * dentro do mapa (créditos do Leaflet/OpenStreetMap/Esri, por exemplo) e
 * abrir uma aba nova ou navegar pra fora do app, ele consegue voltar
 * rápido sem precisar caçar o botão.
 *
 * Atalho padrão: Esc. Pode trocar por outra combinação, ex. Ctrl+Home.
 *
 * Uso (uma vez, num componente que fica montado sempre, tipo AppLayout):
 *   useEscapeToHome();
 */
export function useEscapeToHome({ key = "Escape", requireCtrl = false } = {}) {
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(event) {
      // Não interfere se o usuário estiver digitando em campo de texto
      const tag = event.target?.tagName;
      const isTyping =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        event.target?.isContentEditable;
      if (isTyping) return;

      const matchesKey = event.key === key;
      const matchesCtrl = requireCtrl ? event.ctrlKey || event.metaKey : true;

      if (matchesKey && matchesCtrl) {
        event.preventDefault();
        navigate("/home");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [key, requireCtrl, navigate]);
}

/**
 * Os links de atribuição do Leaflet (ex: "OpenStreetMap contributors",
 * "Esri") não abrem em aba nova por padrão - eles navegam a aba atual
 * pra fora do app. Quando isso acontece, o app é desmontado e o Esc do
 * useEscapeToHome deixa de funcionar (porque não tem mais app ali pra
 * escutar a tecla).
 *
 * Esse hook intercepta cliques em qualquer link de dentro de um
 * `.leaflet-control-attribution` e força abertura em aba nova
 * (noopener), mantendo o app intacto na aba original.
 *
 * Uso: chama uma vez, junto com useEscapeToHome, no AppLayout.
 */
export function useLeafletAttributionInNewTab() {
  useEffect(() => {
    function handleClick(event) {
      const link = event.target?.closest?.(".leaflet-control-attribution a");

      if (!link) return;

      event.preventDefault();
      event.stopPropagation();

      window.open(link.href, "_blank", "noopener,noreferrer");
    }

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, []);
}
