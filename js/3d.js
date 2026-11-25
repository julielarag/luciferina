import { DataRepository } from "./data-repository.js";
import { ParticleInteraction } from "./particle-interaction.js";
import { loadLogoPoints } from "./particle-cloud-data.js";

const status = document.querySelector("#app-status");
function showError(error) {
  console.error("No se pudo iniciar el espacio 3D.", error);
  status.classList.add("is-error");
  status.textContent = `No se pudo cargar la visualización 3D: ${error.message}. Puedes abrir la vista original en index.html.`;
}

async function start() {
  // Dynamic imports also catch CDN failures and show a readable loading error.
  const [data, logoPoints, { ParticleSpace }, { createParticleControls }] = await Promise.all([
    DataRepository.load(),
    loadLogoPoints(),
    import("./particle-space.js"),
    import("./particle-controls.js"),
  ]);
  const space = new ParticleSpace(data, logoPoints);
  const interaction = new ParticleInteraction(data, space);
  interaction.mount(
    document.querySelector("#particle-layer"),
    document.querySelector("#species-filters"),
    {
      container: document.querySelector("#definition-panel"),
      title: document.querySelector("#definition-title"),
      definition: document.querySelector("#definition-text"),
    },
  );
  const controls = createParticleControls(space);
  space.onCountChange = (count) => {
    status.textContent = `${count.toLocaleString("es-MX")} partículas · ${data.keywords.size} keywords · ${data.species.size} especies`;
  };
  space.onError = (message) => showError(new Error(message));
  space.onCountChange(space.cloud.count);
  addEventListener("pagehide", (event) => {
    space.renderer.setAnimationLoop(null);
    if (!event.persisted) {
      controls.destroy();
      space.dispose();
    }
  });
  addEventListener("pageshow", (event) => {
    if (event.persisted) {
      space.lastFrame = null;
      space.renderer.setAnimationLoop(space.animate);
    }
  });
}

start().catch(showError);
