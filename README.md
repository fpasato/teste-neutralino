# SOS Manager

Sistema de Gerenciamento de Emergências - Aplicativo desktop desenvolvido com NeutralinoJS e React para gerenciamento de chamados de emergência, atendentes e visualização em mapa.

## Características

- Interface React moderna com Vite
- Autenticação de usuários e gerenciamento de atendentes
- Dashboard administrativo com estatísticas
- Visualização de emergências em mapa interativo

## Pré-requisitos

- Node.js (para build do frontend)
- NeutralinoJS CLI instalado globalmente:
  ```bash
  npm install -g @neutralinojs/neu
  ```

## Instruções de Build

1. **Instalar dependências do frontend:**
   ```bash
   cd frontend
   npm install
   ```

2. **Build do frontend:**
   ```bash
   npm run build
   ```

3. **Voltar para a pasta principal:**
   ```bash
   cd ..
   ```

4. **Build do aplicativo Neutralino:**
   ```bash
  neu build --embed-resources
   ```

O executável final será gerado na pasta `dist/`.

## Desenvolvimento

Para desenvolvimento local:

```bash
# Terminal 1 - Frontend dev server
cd frontend
npm run dev

# Terminal 2 - Neutralino dev mode
neu run
```

## Estrutura do Projeto

```
sos-manager-neu/
├── frontend/           # Aplicação React
│   ├── src/           # Código fonte
│   └── package.json   # Dependências do frontend
├── resources/         # Recursos estáticos
├── neutralino.config.json  # Configuração do Neutralino
└── update.json        # Manifesto de atualizações
```

## Licença

MIT
