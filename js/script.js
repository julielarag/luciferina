import { DataRepository } from "./data-repository.js";
import { ParticleInteraction } from "./particle-interaction.js";
import { SvgParticleView } from "./svg-particle-view.js";

async function start() {
  const data = await DataRepository.load();
  const view = new SvgParticleView(data);
  const interaction = new ParticleInteraction(data, view);
  interaction.mount(
    document.querySelector("#particle-layer"),
    document.querySelector("#species-filters"),
    {
      container: document.querySelector("#definition-panel"),
      title: document.querySelector("#definition-title"),
      definition: document.querySelector("#definition-text"),
    },
  );
  document.querySelector("#app-status").textContent = `${data.keywords.size} partículas · ${data.species.size} especies`;
}

start().catch((error) => {
  console.error("No se pudo iniciar el sistema de partículas.", error);
  const status = document.querySelector("#app-status");
  status.classList.add("is-error");
  status.textContent = `No se pudo cargar la visualización: ${error.message}`;
});
