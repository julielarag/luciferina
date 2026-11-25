const SPECIES_IMAGES = new Map([
  [1, "img/hongo.png"],
  [2, "img/luciernaga.png"],
  [3, "img/dinoflagelado.png"],
]);

// One source of truth for both the SVG and WebGL views. Filtering never removes
// a keyword or its relationships, including the current selection.
export class ParticleState {
  constructor({ keywords, relatedKeywords }) {
    this.keywords = keywords;
    this.relatedKeywords = relatedKeywords;
    this.selectedKeywordId = null;
    this.selectedSpeciesId = null;
  }

  forKeyword(id) {
    const keyword = this.keywords.get(id);
    const isSelected = id === this.selectedKeywordId;
    const isRelated = Boolean(this.relatedKeywords.get(this.selectedKeywordId)?.has(id));
    const isSpeciesMatch = this.selectedSpeciesId !== null && keyword.speciesIds.has(this.selectedSpeciesId);
    const isSpeciesMuted = this.selectedSpeciesId !== null && !isSpeciesMatch;
    return {
      isSelected, isRelated, isSpeciesMatch, isSpeciesMuted,
      isActive: !isSpeciesMuted,
      // Priority matches the original CSS: a muted selection stays muted.
      appearance: isSpeciesMuted ? 4 : isSelected ? 1 : isRelated ? 2 : isSpeciesMatch ? 3 : 0,
    };
  }

  selectKeyword(id) {
    if (!this.keywords.has(id) || !this.forKeyword(id).isActive) return false;
    this.selectedKeywordId = this.selectedKeywordId === id ? null : id;
    return true;
  }
}

export class ParticleInteraction {
  constructor(data, view) {
    this.species = data.species;
    this.state = new ParticleState(data);
    this.view = view;
  }

  mount(stage, filters, panel) {
    this.filters = filters;
    this.panel = panel;
    this.view.mount(stage, (id) => this.selectKeyword(id));
    this.renderSpeciesFilters();
    this.renderParticleStates();
  }

  selectKeyword(id) {
    if (!this.state.selectKeyword(id)) return;
    const keyword = this.state.keywords.get(this.state.selectedKeywordId);
    this.panel.container.hidden = !keyword;
    if (keyword) {
      this.panel.title.textContent = keyword.name;
      this.panel.definition.textContent = keyword.definition;
    }
    this.renderParticleStates();
  }

  renderSpeciesFilters() {
    this.filters.replaceChildren();
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
      button.addEventListener("click", () => {
        this.state.selectedSpeciesId = this.state.selectedSpeciesId === species.id ? null : species.id;
        this.renderParticleStates();
      });
      this.filters.append(button);
    }
  }

  renderParticleStates() {
    this.view.renderStates(this.state);
    this.filters.querySelectorAll(".species-button").forEach((button) => {
      const active = Number(button.dataset.speciesId) === this.state.selectedSpeciesId;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
}
