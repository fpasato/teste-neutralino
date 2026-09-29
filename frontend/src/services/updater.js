export async function verificarAtualizacao() {
  try {
    const update = await Neutralino.updater.checkForUpdates(
      "https://fpasato.github.io/teste-neutralino/update.json"
    );

    if (update.version !== NL_APPVERSION) {
      console.log(`Nova versão encontrada: ${update.version}`);

      await Neutralino.updater.install();
      await Neutralino.app.restartProcess();
    }
  } catch (error) {
    console.error("Erro ao verificar atualização:", error);
  }
}