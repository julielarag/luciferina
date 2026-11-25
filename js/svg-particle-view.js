const PARTICLE_SIZE_MIN = 1.7; // Minimum random scale applied to each SVG particle.
const PARTICLE_SIZE_MAX = 1.7; // Maximum random scale applied to each SVG particle.
const PARTICLE_MIN_RADIUS = 3.5; // Minimum final radius in SVG units.

class Particle {
  constructor(shape, keyword) {
    this.element = shape;
    this.keyword = keyword;
    this.id = keyword.id;

    const scale = PARTICLE_SIZE_MIN + Math.random() * (PARTICLE_SIZE_MAX - PARTICLE_SIZE_MIN);
    if (shape.tagName.toLowerCase() === "circle") {
      const radius = Number(shape.getAttribute("r"));
      if (!Number.isFinite(radius) || radius <= 0) {
        throw new Error(`La partícula ${this.id} no tiene un radio válido.`);
      }
      shape.setAttribute("r", String(Math.max(radius * scale, PARTICLE_MIN_RADIUS)));
    } else {
      const radiusX = Number(shape.getAttribute("rx"));
      const radiusY = Number(shape.getAttribute("ry"));
      if (!Number.isFinite(radiusX) || !Number.isFinite(radiusY) || radiusX <= 0 || radiusY <= 0) {
        throw new Error(`La partícula ${this.id} no tiene radios válidos.`);
      }
      const scaledRadiusX = radiusX * scale;
      const scaledRadiusY = radiusY * scale;
      const minimumRadius = Math.min(scaledRadiusX, scaledRadiusY);
      const radiusScale = Math.max(1, PARTICLE_MIN_RADIUS / minimumRadius);
      shape.setAttribute("rx", String(scaledRadiusX * radiusScale));
      shape.setAttribute("ry", String(scaledRadiusY * radiusScale));
    }

    this.hitArea = shape.cloneNode(false);
    this.hitArea.removeAttribute("class");
    this.hitArea.setAttribute("fill", "none");
    this.hitArea.setAttribute("stroke", "transparent");
    this.hitArea.setAttribute("stroke-width", "10");
    this.hitArea.setAttribute("vector-effect", "non-scaling-stroke");
    this.hitArea.setAttribute("pointer-events", "stroke");
    this.hitArea.setAttribute("aria-hidden", "true");
    shape.before(this.hitArea);

    shape.classList.add("particle-shape");
    shape.setAttribute("data-keyword-id", String(this.id));
    shape.setAttribute("role", "button");
    shape.setAttribute("tabindex", "0");
    shape.setAttribute("aria-label", `${keyword.name}: ${keyword.definition}`);
    shape.setAttribute("aria-pressed", "false");
    shape.setAttribute("aria-disabled", "false");

    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = keyword.name;
    shape.prepend(title);
  }
}

export class SvgParticleView {
  constructor({ shapes, keywords, svg }) {
    this.svg = svg;
    const orderedKeywords = [...keywords.values()];
    this.particles = shapes.map((shape, index) => new Particle(shape, orderedKeywords[index]));
  }

  mount(stage, onSelect) {
    this.svg.setAttribute("preserveAspectRatio", "none");
    this.svg.setAttribute("aria-label", "Partículas interactivas de keywords");
    this.svg.setAttribute("role", "group");
    stage.append(this.svg);
    for (const particle of this.particles) {
      const select = () => onSelect(particle.id);
      particle.element.addEventListener("click", select);
      particle.hitArea.addEventListener("click", select);
      particle.element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select();
        }
      });
    }
  }

  renderStates(state) {
    for (const particle of this.particles) {
      const flags = state.forKeyword(particle.id);
      const shape = particle.element;
      shape.classList.toggle("is-selected", flags.isSelected);
      shape.classList.toggle("is-related", flags.isRelated);
      shape.classList.toggle("is-species-match", flags.isSpeciesMatch);
      shape.classList.toggle("is-species-muted", flags.isSpeciesMuted);
      shape.setAttribute("tabindex", flags.isSpeciesMuted ? "-1" : "0");
      shape.setAttribute("aria-disabled", String(flags.isSpeciesMuted));
      shape.setAttribute("aria-pressed", String(flags.isSelected));
      particle.hitArea.setAttribute("pointer-events", flags.isSpeciesMuted ? "none" : "stroke");
    }
  }
}

