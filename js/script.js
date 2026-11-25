const PARTICLE_SIZE_MIN = 1.7; // Minimum random scale applied to each SVG particle.
const PARTICLE_SIZE_MAX = 1.7; // Maximum random scale applied to each SVG particle.
const PARTICLE_MIN_RADIUS = 3.5; // Minimum final radius in SVG units.
const PARTICLE_HITBOX_PADDING = 8;
const SPECIES_IMAGES = new Map([
  [1, "img/hongo.png"],
  [2, "img/luciernaga.png"],
  [3, "img/dinoflagelado.png"],
]);

class CsvParser {
  static parse(text) {
    const rows = [];
    let row = [];
    let field = "";
    let insideQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];

      if (insideQuotes) {
        if (character === '"' && text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (character === '"') {
          insideQuotes = false;
        } else {
          field += character;
        }
      } else if (character === '"' && field.length === 0) {
        insideQuotes = true;
      } else if (character === ",") {
        row.push(field);
        field = "";
      } else if (character === "\n" || character === "\r") {
        row.push(field);
        if (row.some((cell) => cell.trim() !== "")) rows.push(row);
        row = [];
        field = "";
        if (character === "\r" && text[index + 1] === "\n") index += 1;
      } else {
        field += character;
      }
    }

    if (insideQuotes) throw new Error("Un CSV contiene un campo entre comillas sin cerrar.");
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    }
    if (rows.length < 2) throw new Error("Un CSV no contiene encabezados y datos.");

    const headers = rows[0].map((header, index) =>
      (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim()
    );
    return rows.slice(1).map((cells) =>
      Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]))
    );
  }
}

class DataRepository {
  static async load() {
    const [speciesCsv, keywordsCsv, relationsCsv, svgText] = await Promise.all([
      this.fetchText("data/especies.csv"),
      this.fetchText("data/keywords.csv"),
      this.fetchText("data/keyword_especie.csv"),
      this.fetchText("img/particulas_activas.svg"),
    ]);

    const species = new Map(
      CsvParser.parse(speciesCsv).map((row) => [
        Number(row.id),
        { id: Number(row.id), name: row.nombre.trim() },
      ])
    );
    const keywords = new Map(
      CsvParser.parse(keywordsCsv).map((row) => {
        const id = Number(row.id);
        return [
          id,
          {
            id,
            name: row.keyword.trim(),
            definition: row.definicion.trim(),
            relatedKeywordIds: this.parseIds(row.keyword_ids, id),
            speciesIds: new Set(),
          },
        ];
      })
    );

    for (const row of CsvParser.parse(relationsCsv)) {
      const keywordId = Number(row.Keyword);
      const speciesId = Number(row.Especie);
      const keyword = keywords.get(keywordId);
      if (keyword && species.has(speciesId)) keyword.speciesIds.add(speciesId);
      else console.warn(`Relación keyword-especie inválida: ${keywordId}, ${speciesId}.`);
    }

    const svgDocument = new DOMParser().parseFromString(svgText, "image/svg+xml");
    if (svgDocument.querySelector("parsererror")) {
      throw new Error("No se pudo interpretar img/particulas_activas.svg.");
    }

    const svg = svgDocument.documentElement;
    const viewBox = (svg.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
    if (
      viewBox.length !== 4 ||
      viewBox.some((value) => !Number.isFinite(value)) ||
      viewBox[2] <= 0 ||
      viewBox[3] <= 0
    ) {
      throw new Error("El SVG de partículas necesita un viewBox válido.");
    }

    const shapes = [...svg.querySelectorAll("circle, ellipse")];
    if (shapes.length !== keywords.size) {
      throw new Error(
        `El SVG contiene ${shapes.length} partículas, pero keywords.csv contiene ${keywords.size} keywords.`
      );
    }

    const keywordIds = [...keywords.keys()];
    const particles = shapes.map((shape, index) => {
      const keyword = keywords.get(keywordIds[index]);
      if (!keyword) throw new Error(`No se encontró el keyword ${keywordIds[index]}.`);
      return new Particle(shape, keyword);
    });

    const relatedKeywords = new Map(
      [...keywords.keys()].map((keywordId) => [keywordId, new Set()])
    );
    for (const keyword of keywords.values()) {
      for (const relatedId of keyword.relatedKeywordIds) {
        if (!keywords.has(relatedId)) {
          console.warn(`El keyword ${keyword.id} refiere al keyword inexistente ${relatedId}.`);
        } else if (relatedId !== keyword.id) {
          relatedKeywords.get(keyword.id).add(relatedId);
          relatedKeywords.get(relatedId).add(keyword.id);
        }
      }
      if (keyword.speciesIds.size < 1 || keyword.speciesIds.size > 3) {
        console.warn(
          `El keyword ${keyword.id} tiene ${keyword.speciesIds.size} especies relacionadas en keyword_especie.csv.`
        );
      }
    }

    return { species, keywords, relatedKeywords, particles, svg };
  }

  static async fetchText(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`No se pudo cargar ${path} (HTTP ${response.status}).`);
    }
    return response.text();
  }

  static parseIds(value, keywordId) {
    return value.split(",").reduce((ids, value) => {
      const id = value.trim();
      if (!id) return ids;
      if (/^\d+$/.test(id)) ids.push(Number(id));
      else console.warn(`Relación keyword-keyword inválida en keyword ${keywordId}: "${id}".`);
      return ids;
    }, []);
  }
}

class Particle {
  constructor(shape, keyword) {
    this.element = shape;
    this.keyword = keyword;
    this.id = keyword.id;
    this.originalPosition = {
      x: shape.getAttribute("cx"),
      y: shape.getAttribute("cy"),
    };

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

class ParticleSystem {
  constructor({ particles, species, relatedKeywords, svg }) {
    this.particles = particles;
    this.species = species;
    this.relatedKeywords = relatedKeywords;
    this.svg = svg;
    this.desktopViewBox = svg.getAttribute("viewBox");
    this.mobileLayout = window.matchMedia("(max-width: 760px)");
    this.mobilePositions = null;
    this.selectedKeywordId = null;
    this.selectedSpeciesId = null;
    this.particlesById = new Map(particles.map((particle) => [particle.id, particle]));
  }

  mount(stage, filtersElement, panel) {
    this.stageElement = stage.closest(".stage");
    this.svg.setAttribute("preserveAspectRatio", "none");
    this.svg.setAttribute("aria-label", "Partículas interactivas de keywords");
    this.svg.setAttribute("role", "group");
    stage.append(this.svg);
    this.renderSpeciesFilters(filtersElement);
    this.bindParticleEvents(panel);
    this.renderParticleStates();
    this.updateLayout();
    this.layoutObserver = new ResizeObserver(() => this.updateLayout());
    this.layoutObserver.observe(this.stageElement);
  }

  updateLayout() {
    if (!this.mobileLayout.matches) {
      this.svg.setAttribute("viewBox", this.desktopViewBox);
      this.stageElement.style.height = "";
      for (const particle of this.particles) {
        particle.element.setAttribute("cx", particle.originalPosition.x);
        particle.element.setAttribute("cy", particle.originalPosition.y);
      }
      return;
    }

    const columnWidth = Math.max(1, this.stageElement.clientWidth);
    if (!this.mobilePositions) {
      const baseWidth = Math.max(300, columnWidth - 15);
      const minimumHeight = Math.ceil(this.particles.length / 6) * 30;
      this.mobilePositions = this.createRandomMobileLayout(baseWidth, minimumHeight);
    }

    const { width, height, points } = this.mobilePositions;
    this.svg.setAttribute("viewBox", `0 0 ${columnWidth} ${height}`);
    this.stageElement.style.height = `${height}px`;

    this.particles.forEach((particle, index) => {
      particle.element.setAttribute("cx", String(points[index].x * (columnWidth / width)));
      particle.element.setAttribute("cy", String(points[index].y));
    });
  }

  createRandomMobileLayout(width, minimumHeight) {
    const points = [];
    let height = minimumHeight;
    let seed = 2166136261;
    for (const particle of this.particles) {
      seed = Math.imul(seed ^ particle.id, 16777619) >>> 0;
    }

    // A fixed seed keeps the mobile scatter identical across page reloads.
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (const particle of this.particles) {
      const bounds = particle.element.getBBox();
      const radius = Math.max(bounds.width, bounds.height) / 2;
      const margin = Math.max(18, radius + 10);
      let point = null;

      while (!point) {
        for (let attempt = 0; attempt < 400; attempt += 1) {
          const candidate = {
            x: margin + random() * (width - margin * 2),
            y: margin + random() * (height - margin * 2),
            radius,
          };
          const hasSpace = points.every(
            (other) =>
              Math.hypot(candidate.x - other.x, candidate.y - other.y) >=
              candidate.radius + other.radius + 18
          );

          if (hasSpace) {
            point = candidate;
            break;
          }
        }

        if (!point) height += 44;
      }

      points.push(point);
    }

    return { width, height, points };
  }

  renderSpeciesFilters(container) {
    container.replaceChildren();
    for (const species of this.species.values()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "species-button";
      button.dataset.speciesId = String(species.id);
      const imagePath = SPECIES_IMAGES.get(species.id);
      if (!imagePath) throw new Error(`No hay una imagen configurada para la especie ${species.id}.`);
      const image = document.createElement("img");
      image.src = imagePath;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = species.name;
      button.append(image, label);
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        this.selectedSpeciesId =
          this.selectedSpeciesId === species.id ? null : species.id;
        this.renderSpeciesFilters(container);
        this.renderParticleStates();
      });
      container.append(button);
    }
  }

  bindParticleEvents(panel) {
    for (const particle of this.particles) {
      particle.element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (!this.isParticleAvailable(particle)) return;
          this.selectKeyword(particle.id, panel);
        }
      });
    }

    this.svg.closest("main").addEventListener("click", (event) => {
      const targetElement = event.target instanceof Element ? event.target : null;
      const target = targetElement?.closest(".particle-shape");
      const targetParticle = target
        ? this.particlesById.get(Number(target.getAttribute("data-keyword-id")))
        : null;

      if (targetParticle && !this.isParticleAvailable(targetParticle)) return;
      if (
        !targetParticle &&
        targetElement !== event.currentTarget &&
        targetElement !== this.svg &&
        targetElement !== this.svg.parentElement
      ) {
        return;
      }

      const particle = targetParticle ?? this.findParticleAtPoint(event.clientX, event.clientY);
      if (particle) this.selectKeyword(particle.id, panel);
    });
  }

  findParticleAtPoint(x, y) {
    let nearestParticle = null;
    let nearestDistance = Infinity;

    for (const particle of this.particles) {
      if (!this.isParticleAvailable(particle)) continue;

      const bounds = particle.element.getBoundingClientRect();
      const radiusX = bounds.width / 2 + PARTICLE_HITBOX_PADDING;
      const radiusY = bounds.height / 2 + PARTICLE_HITBOX_PADDING;
      const normalizedX = (x - (bounds.left + bounds.width / 2)) / radiusX;
      const normalizedY = (y - (bounds.top + bounds.height / 2)) / radiusY;
      const distance = normalizedX ** 2 + normalizedY ** 2;

      if (distance <= 1 && distance < nearestDistance) {
        nearestParticle = particle;
        nearestDistance = distance;
      }
    }

    return nearestParticle;
  }

  isParticleAvailable(particle) {
    return (
      this.selectedSpeciesId === null ||
      particle.keyword.speciesIds.has(this.selectedSpeciesId)
    );
  }

  selectKeyword(keywordId, panel) {
    if (this.selectedKeywordId === keywordId) {
      this.selectedKeywordId = null;
      panel.container.hidden = true;
      this.renderParticleStates();
      return;
    }

    this.selectedKeywordId = keywordId;
    const keyword = this.particlesById.get(keywordId).keyword;

    panel.title.textContent = keyword.name;
    panel.definition.textContent = keyword.definition;
    panel.container.hidden = false;
    this.renderParticleStates();
  }

  renderParticleStates() {
    for (const particle of this.particles) {
      const shape = particle.element;
      const isSelected = particle.id === this.selectedKeywordId;
      const isRelated = Boolean(this.relatedKeywords.get(this.selectedKeywordId)?.has(particle.id));
      const isSpeciesMatch =
        this.selectedSpeciesId !== null &&
        particle.keyword.speciesIds.has(this.selectedSpeciesId);
      const isSpeciesMuted = this.selectedSpeciesId !== null && !isSpeciesMatch;

      shape.classList.toggle("is-selected", isSelected);
      shape.classList.toggle("is-related", isRelated);
      shape.classList.toggle("is-species-match", isSpeciesMatch);
      shape.classList.toggle("is-species-muted", isSpeciesMuted);
      shape.setAttribute("tabindex", isSpeciesMuted ? "-1" : "0");
      shape.setAttribute("aria-disabled", String(isSpeciesMuted));
      shape.setAttribute("aria-pressed", String(isSelected));
    }

    document.querySelectorAll(".species-button").forEach((button) => {
      const isActive = Number(button.dataset.speciesId) === this.selectedSpeciesId;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }
}

class ParticleApp {
  constructor() {
    this.stage = document.querySelector("#particle-layer");
    this.filters = document.querySelector("#species-filters");
    this.panel = {
      container: document.querySelector("#definition-panel"),
      title: document.querySelector("#definition-title"),
      definition: document.querySelector("#definition-text"),
    };
    this.status = document.querySelector("#app-status");
  }

  async start() {
    const data = await DataRepository.load();
    const system = new ParticleSystem(data);
    system.mount(this.stage, this.filters, this.panel);
    this.status.textContent = `${data.particles.length} partículas · ${data.species.size} especies`;
  }
}

const app = new ParticleApp();
app.start().catch((error) => {
  console.error("No se pudo iniciar el sistema de partículas.", error);
  const status = document.querySelector("#app-status");
  status.classList.add("is-error");
  status.textContent = `No se pudo cargar la visualización: ${error.message}`;
});
