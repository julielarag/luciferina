import { DataRepository } from "./data-repository.js";

export async function loadLogoPoints() {
  const text = await DataRepository.fetchText("img/logotipo_luciferina.svg");
  const document = new DOMParser().parseFromString(text, "image/svg+xml");
  if (document.querySelector("parsererror")) throw new Error("El logotipo SVG no es válido.");
  const viewBox = document.documentElement.getAttribute("viewBox").split(/[\s,]+/).map(Number);
  const [x, y, width, height] = viewBox;
  if (viewBox.length !== 4 || !viewBox.every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new Error("El logotipo necesita un viewBox válido.");
  }
  const points = [...document.querySelectorAll("circle, ellipse")].map((shape) => ({
    x: (Number(shape.getAttribute("cx")) - x - width / 2) / width,
    y: -(Number(shape.getAttribute("cy")) - y - height / 2) / width,
    rx: Number(shape.getAttribute("rx") ?? shape.getAttribute("r")) / width,
    ry: Number(shape.getAttribute("ry") ?? shape.getAttribute("r")) / width,
  }));
  if (!points.length) throw new Error("El logotipo no contiene partículas.");
  return points;
}

// A seeded field stays in place when density changes; owners are keyword IDs,
// never array offsets or species IDs. -1 exclusively denotes inactive ambience.
export function createCloudData(keywords, logoPoints, { ambientCount, satellitesPerKeyword, fieldAspect = 2.2 }) {
  let seed = 173;
  let anchorSeed = 541;
  const anchorRandom = () => {
    anchorSeed = (Math.imul(anchorSeed, 1664525) + 1013904223) >>> 0;
    return anchorSeed / 4294967296;
  };
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const ids = [...keywords.keys()];
  const count = ids.length * (satellitesPerKeyword + 1) + ambientCount;
  const logo = new Float32Array(count * 3);
  const spread = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const kind = new Float32Array(count);
  const owner = new Int32Array(count).fill(-1);
  const anchors = [];
  const columns = Math.ceil(Math.sqrt(ids.length * fieldAspect));
  const rows = Math.ceil(ids.length / columns);
  let cursor = 0;

  function add(type, id, target, sharedPhase) {
    const index = cursor++;
    const point = logoPoints[(index * 131) % logoPoints.length];
    const angle = random() * Math.PI * 2;
    const radius = type === 2 ? 0 : Math.sqrt(random());
    logo.set([point.x + Math.cos(angle) * point.rx * radius,
      point.y + Math.sin(angle) * point.ry * radius, 0], index * 3);
    spread.set(target, index * 3);
    phase[index] = sharedPhase ?? random() * Math.PI * 2;
    kind[index] = type;
    owner[index] = id;
    return index;
  }

  ids.forEach((id, index) => {
    const target = [
      ((index % columns + 0.25 + anchorRandom() * 0.5) / columns * 2 - 1) * 0.78,
      (1 - (Math.floor(index / columns) + 0.25 + anchorRandom() * 0.5) / rows * 2) * 0.75,
      (anchorRandom() - 0.5) * 1.1,
    ];
    const sharedPhase = anchorRandom() * Math.PI * 2;
    const particleIndex = add(2, id, target, sharedPhase);
    anchors.push({ id, index: particleIndex });
    for (let satellite = 0; satellite < satellitesPerKeyword; satellite += 1) {
      add(1, id, [target[0] + (random() - 0.5) * 0.075,
        target[1] + (random() - 0.5) * 0.12,
        target[2] + (random() - 0.5) * 0.2], sharedPhase);
    }
  });
  for (let index = 0; index < ambientCount; index += 1) {
    add(0, -1, [(random() * 2 - 1) * 1.1, (random() * 2 - 1) * 1.1, random() * 2 - 1]);
  }
  return { count, logo, spread, phase, kind, owner, anchors };
}
