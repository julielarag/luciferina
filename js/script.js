const DATA_PATH = "data/";
const ACTIVE_PARTICLES_PATH = "img/particulas_activas.svg";
const BASE_IMAGE_PATH = "img/particulas_inactivas.png";
const PARTICLES_PER_LETTER = 10;
const PARTICLE_SIZE_MIN = 2;
const PARTICLE_SIZE_MAX = 8;
const HOVER_HITBOX_RADIUS = 50;
const LETTER_RANGES = [
    [0, 85],
    [85, 225],
    [225, 375],
    [375, 465],
    [465, 600],
    [600, 720],
    [720, 865],
    [865, 940],
    [940, 1100],
    [1100, 1235]
];

class CsvParser {
    static parse(text) {
        const rows = [];
        let row = [];
        let field = "";
        let quoted = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            if (quoted) {
                if (char === '"' && text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else if (char === '"') {
                    quoted = false;
                } else {
                    field += char;
                }
            } else if (char === '"') {
                quoted = true;
            } else if (char === ",") {
                row.push(field);
                field = "";
            } else if (char === "\n" || char === "\r") {
                row.push(field);
                if (row.some((value) => value.trim() !== "")) {
                    rows.push(row);
                }
                row = [];
                field = "";
                if (char === "\r" && text[i + 1] === "\n") i++;
            } else {
                field += char;
            }
        }

        if (field !== "" || row.length > 0) {
            row.push(field);
            rows.push(row);
        }

        const headers = rows.shift()?.map((header) => header.trim()) ?? [];
        return rows.map((values) =>
            Object.fromEntries(headers.map((header, index) => [header, (values[index] ?? "").trim()]))
        );
    }
}

class DataRepository {
    async load() {
        const [speciesCsv, keywordsCsv, relationsCsv, svgText] = await Promise.all([
            this.fetchText(`${DATA_PATH}especies.csv`),
            this.fetchText(`${DATA_PATH}keywords.csv`),
            this.fetchText(`${DATA_PATH}keyword_especie.csv`),
            this.fetchText(ACTIVE_PARTICLES_PATH)
        ]);

        const species = CsvParser.parse(speciesCsv);
        const keywords = CsvParser.parse(keywordsCsv);
        const keywordById = new Map(keywords.map((keyword) => [keyword.id, keyword]));
        const speciesByKeyword = this.createSpeciesMap(
            relationsCsv,
            keywordById,
            new Set(species.map(({ id }) => id))
        );
        const relatedKeywords = this.createKeywordRelations(keywords, keywordById);
        const svgDocument = new DOMParser().parseFromString(svgText, "image/svg+xml");

        if (svgDocument.querySelector("parsererror")) {
            throw new Error("No se pudo interpretar img/particulas_activas.svg.");
        }

        if (new Set(keywords.map((keyword) => keyword.id)).size !== keywords.length) {
            throw new Error("Hay IDs de keyword duplicados en data/keywords.csv.");
        }

        return {
            species,
            keywords: keywords.sort((a, b) => Number(a.id) - Number(b.id)),
            speciesByKeyword,
            relatedKeywords,
            svgDocument
        };
    }

    async fetchText(path) {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`No se pudo cargar ${path} (${response.status}).`);
        }
        return response.text();
    }

    createSpeciesMap(csvText, keywordById, speciesIds) {
        const speciesByKeyword = new Map();
        const seenPairs = new Set();

        for (const row of CsvParser.parse(csvText)) {
            const keywordId = row.Keyword;
            const speciesId = row.Especie;

            if (!keywordById.has(keywordId)) {
                console.warn(`keyword_especie.csv referencia el keyword inexistente ${keywordId}.`);
                continue;
            }

            if (!speciesIds.has(speciesId)) {
                console.warn(`keyword_especie.csv referencia la especie inexistente ${speciesId}.`);
                continue;
            }

            const pair = `${keywordId}:${speciesId}`;
            if (seenPairs.has(pair)) {
                console.warn(`Relación duplicada en keyword_especie.csv: keyword ${keywordId}, especie ${speciesId}.`);
                continue;
            }
            seenPairs.add(pair);

            if (!speciesByKeyword.has(keywordId)) {
                speciesByKeyword.set(keywordId, new Set());
            }
            speciesByKeyword.get(keywordId).add(speciesId);
        }

        for (const keywordId of keywordById.keys()) {
            if (!speciesByKeyword.has(keywordId)) {
                console.warn(`El keyword ${keywordId} no tiene especie asignada en keyword_especie.csv.`);
            }
        }

        return speciesByKeyword;
    }

    createKeywordRelations(keywords, keywordById) {
        const relatedKeywords = new Map(keywords.map(({ id }) => [id, new Set()]));

        for (const keyword of keywords) {
            for (const relatedId of keyword.keyword_ids.split(",")) {
                const id = relatedId.trim();
                if (!id) continue;

                if (!/^\d+$/.test(id) || !keywordById.has(id)) {
                    console.warn(`Relación inválida en keyword_ids del keyword ${keyword.id}: "${id}".`);
                    continue;
                }

                if (id !== keyword.id) {
                    relatedKeywords.get(keyword.id).add(id);
                    relatedKeywords.get(id).add(keyword.id);
                }
            }
        }

        return relatedKeywords;
    }
}

class Particle {
    constructor(element, keyword, speciesIds, relatedIds, onSelect) {
        this.element = element;
        this.keyword = keyword;
        this.speciesIds = speciesIds;
        this.relatedIds = relatedIds;

        this.randomizeSize();
        this.element.classList.add("keyword-particle");
        this.element.dataset.keywordId = keyword.id;
        this.element.setAttribute("role", "button");
        this.element.setAttribute("tabindex", "0");
        this.element.setAttribute("aria-label", keyword.keyword);
        this.element.setAttribute("aria-pressed", "false");
        this.element.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(this);
            }
        });
    }

    randomizeSize() {
        const size = randomBetween(PARTICLE_SIZE_MIN, PARTICLE_SIZE_MAX) * 1.7;

        if (this.element.tagName.toLowerCase() === "circle") {
            this.element.setAttribute("r", String(size / 2));
            return;
        }

        const originalRx = Number(this.element.getAttribute("rx"));
        const originalRy = Number(this.element.getAttribute("ry"));
        const scale = size / (2 * Math.max(originalRx, originalRy));
        this.element.setAttribute("rx", String(originalRx * scale));
        this.element.setAttribute("ry", String(originalRy * scale));
    }

    setState({ selectedId, speciesId }) {
        const isSelected = this.keyword.id === selectedId;
        const isSpeciesMatch = this.speciesIds.has(speciesId);
        const isRelated = speciesId
            ? isSpeciesMatch
            : this.relatedIds.has(selectedId);

        this.element.classList.toggle("is-selected", isSelected);
        this.element.classList.toggle("is-related", isRelated);
        this.element.classList.toggle("is-dimmed", Boolean(speciesId) && !isSpeciesMatch);
        this.element.setAttribute("aria-pressed", String(isSelected));
    }

    setHovered(isHovered) {
        this.element.classList.toggle("is-hovered", isHovered);
    }

    setFloatDelay(delay) {
        this.element.style.animationDelay = `${delay}s`;
    }
}

class ParticleSystem {
    constructor(stage, data, onSelect) {
        this.stage = stage;
        this.data = data;
        this.particles = [];
        this.onSelect = onSelect;
    }

    mount() {
        const svg = document.importNode(this.data.svgDocument.documentElement, true);
        const allElements = Array.from(svg.querySelectorAll("circle, ellipse"));
        const letterGroups = LETTER_RANGES.map(([minX, maxX]) =>
            allElements
                .filter((element) => {
                    const x = Number(element.getAttribute("cx"));
                    return x >= minX && x < maxX;
                })
                .sort((a, b) => Number(a.getAttribute("cx")) - Number(b.getAttribute("cx")))
        );

        if (letterGroups.some((group) => group.length < PARTICLES_PER_LETTER)) {
            throw new Error("No hay suficientes partículas en una o más letras de particulas_activas.svg.");
        }

        const elements = letterGroups.flatMap((group) => {
            const selected = Array.from({ length: PARTICLES_PER_LETTER }, (_, index) =>
                group[Math.floor(((index + 0.5) * group.length) / PARTICLES_PER_LETTER)]
            );
            const selectedSet = new Set(selected);
            for (const element of group) {
                if (!selectedSet.has(element)) element.remove();
            }
            return selected;
        });

        const keywordStep = this.data.keywords.length / elements.length;
        const keywords = elements.map((_, index) =>
            this.data.keywords[Math.floor((index + 0.5) * keywordStep)]
        );

        svg.setAttribute("preserveAspectRatio", "none");
        svg.setAttribute("aria-label", "Partículas interactivas de keywords");

        this.particles = elements.map((element, index) => {
            const keyword = keywords[index];
            const speciesIds = this.data.speciesByKeyword.get(keyword.id) ?? new Set();
            const relatedIds = this.data.relatedKeywords.get(keyword.id) ?? new Set();

            const particle = new Particle(element, keyword, speciesIds, relatedIds, this.onSelect);
            particle.setFloatDelay(-randomBetween(0, 4));
            return particle;
        });

        const viewBox = svg.viewBox.baseVal;
        const stageBounds = this.stage.getBoundingClientRect();
        const scaleX = stageBounds.width / viewBox.width;
        const scaleY = stageBounds.height / viewBox.height;
        const centers = elements.map((element) => ({
            x: Number(element.getAttribute("cx")),
            y: Number(element.getAttribute("cy"))
        }));
        const hitTargets = document.createElementNS("http://www.w3.org/2000/svg", "g");
        hitTargets.classList.add("particle-hit-targets");

        centers.forEach((center, index) => {
            const nearestDistance = Math.min(
                ...centers
                    .filter((_, otherIndex) => otherIndex !== index)
                    .map((other) =>
                        Math.hypot((center.x - other.x) * scaleX, (center.y - other.y) * scaleY)
                    )
            );
            const hitRadius = Math.max(0, Math.min(HOVER_HITBOX_RADIUS, nearestDistance / 2 - 4));
            const target = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
            target.classList.add("particle-hit-target");
            target.dataset.keywordId = this.particles[index].keyword.id;
            target.style.animationDelay = this.particles[index].element.style.animationDelay;
            target.setAttribute("cx", String(center.x));
            target.setAttribute("cy", String(center.y));
            target.setAttribute("rx", String(hitRadius / scaleX));
            target.setAttribute("ry", String(hitRadius / scaleY));
            target.setAttribute("aria-hidden", "true");
            const particle = this.particles[index];
            target.addEventListener("pointerover", () => particle.setHovered(true));
            target.addEventListener("pointerout", (event) => {
                if (!target.contains(event.relatedTarget)) particle.setHovered(false);
            });
            target.addEventListener("click", () => this.onSelect(particle));
            hitTargets.append(target);
        });

        svg.append(hitTargets);
        this.stage.querySelector("svg")?.remove();
        this.stage.append(svg);
    }

    update(selectedId, speciesId) {
        for (const particle of this.particles) {
            particle.setState({ selectedId, speciesId });
        }
    }

}

class ParticleApp {
    constructor() {
        this.stage = document.querySelector("#particle-stage");
        this.descriptionTitle = document.querySelector("#keyword-title");
        this.descriptionText = document.querySelector("#keyword-description");
        this.errorMessage = document.querySelector("#error-message");
        this.speciesControls = document.querySelector("#species-controls");
        this.selectedKeywordId = null;
        this.selectedSpeciesId = null;
    }

    async start() {
        try {
            const data = await new DataRepository().load();
            this.species = new Map(data.species.map((species) => [species.id, species]));
            document.querySelector("#base-image").src = BASE_IMAGE_PATH;
            this.renderSpeciesControls(data.species);
            this.particleSystem = new ParticleSystem(this.stage, data, (particle) => this.selectParticle(particle));
            this.particleSystem.mount();
        } catch (error) {
            console.error("No se pudo iniciar el sistema de partículas.", error);
            this.errorMessage.textContent = `${error.message} Abre la página con un servidor local para cargar los archivos CSV.`;
            this.errorMessage.hidden = false;
        }
    }

    renderSpeciesControls(species) {
        this.speciesControls.replaceChildren();

        for (const item of species) {
            const button = document.createElement("button");
            button.className = "species-button";
            button.type = "button";
            button.textContent = item.nombre;
            button.dataset.speciesId = item.id;
            button.setAttribute("aria-pressed", "false");
            button.addEventListener("click", () => this.selectSpecies(item.id));
            this.speciesControls.append(button);
        }
    }

    selectParticle(particle) {
        this.selectedKeywordId =
            this.selectedKeywordId === particle.keyword.id ? null : particle.keyword.id;

        if (this.selectedKeywordId) {
            document.querySelector(".keyword-card").hidden = false;
            this.descriptionTitle.textContent = particle.keyword.keyword;
            this.descriptionText.textContent = particle.keyword.definicion;
            const speciesIds = particle.speciesIds;
            const speciesNames = Array.from(speciesIds, (id) => this.species.get(id)?.nombre).filter(Boolean);
            const speciesNote = document.querySelector("#keyword-species");
            speciesNote.textContent = speciesNames.length
                ? `Especies: ${speciesNames.join(" · ")}`
                : "Sin especie asignada en keyword_especie.csv.";
            speciesNote.hidden = false;
        } else {
            this.resetDescription();
        }

        this.particleSystem.update(this.selectedKeywordId, this.selectedSpeciesId);
    }

    selectSpecies(speciesId) {
        this.selectedSpeciesId = this.selectedSpeciesId === speciesId ? null : speciesId;

        for (const button of this.speciesControls.querySelectorAll(".species-button")) {
            const isSelected = button.dataset.speciesId === this.selectedSpeciesId;
            button.classList.toggle("is-active", isSelected);
            button.setAttribute("aria-pressed", String(isSelected));
        }

        this.particleSystem.update(this.selectedKeywordId, this.selectedSpeciesId);
    }

    resetDescription() {
        document.querySelector(".keyword-card").hidden = true;
        this.descriptionTitle.textContent = "Explora las partículas";
        this.descriptionText.textContent = "Selecciona un punto para consultar su keyword y las especies relacionadas.";
        document.querySelector("#keyword-species").hidden = true;
    }
}

function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}

document.addEventListener("DOMContentLoaded", () => {
    const app = new ParticleApp();
    app.start();
});
