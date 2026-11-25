import { GUI } from "dat.gui";

export function createParticleControls(space) {
  const host = document.createElement("div");
  host.className = "particle-controls";
  const gui = new GUI({ autoPlace: false, width: 260, hideable: false });
  host.append(gui.domElement);
  document.querySelector("#particle-stage").append(host);
  const options = space.options;
  const density = gui.addFolder("Partículas");
  density.add(options, "ambientCount", 2000, 24000, 1000).name("Ambientales").onFinishChange(() => space.rebuild());
  density.add(options, "satellitesPerKeyword", 4, 40, 1).name("Reactivas / keyword").onFinishChange(() => space.rebuild());
  density.add(options, "size", 0.4, 2, 0.05).name("Tamaño");
  const light = gui.addFolder("Brillo");
  light.add(options, "ambientGlow", 0.05, 0.6, 0.01).name("Ambiente");
  light.add(options, "keywordGlow", 1, 4, 0.1).name("Keywords");
  light.add(options, "reactiveGlow", 1.5, 6, 0.1).name("Estado activo");
  const motion = gui.addFolder("Movimiento");
  motion.add(options, "speed", 0, 2, 0.05).name("Velocidad");
  motion.add(options, "amplitude", 0, 24, 1).name("Oscilación");
  motion.add(options, "depth", 80, 420, 10).name("Profundidad");
  motion.add(options, "parallax").name("Paralaje del cursor");
  gui.add({ replay: () => space.replayIntro() }, "replay").name("Repetir entrada");
  gui.closed = false;
  if (innerWidth < 761) gui.close();
  gui.domElement.querySelector(".close-button").textContent = "Controles";
  return {
    destroy() {
      gui.destroy();
      host.remove();
    },
  };
}
