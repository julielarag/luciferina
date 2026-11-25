import * as THREE from "three";
import { createCloudData } from "./particle-cloud-data.js";
import { vertexShader, fragmentShader } from "./particle-shaders.js";

export class ParticleSpace {
  constructor(data, logoPoints, options = {}) {
    this.keywords = data.keywords;
    this.logoPoints = logoPoints;
    this.options = {
      ambientCount: innerWidth < 761 ? 6000 : 12000,
      satellitesPerKeyword: 18,
      fieldAspect: innerWidth < 761 ? 0.7 : 2.2,
      size: 1,
      amplitude: 8,
      speed: 0.6,
      depth: 260,
      ambientGlow: 0.32,
      keywordGlow: 1.8,
      reactiveGlow: 3,
      parallax: true,
      ...options,
    };
    this.motion = matchMedia("(prefers-reduced-motion: reduce)");
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "high-performance" });
    this.renderer.setClearColor(0x07131a, 0);
    this.camera = new THREE.PerspectiveCamera(55, 1, 1, 2400);
    this.camera.position.z = 900;
    this.scene = new THREE.Scene();
    this.projected = new THREE.Vector3();
    this.pointer = { x: 0, y: 0 };
    this.elapsed = 0;
    this.time = 0;
    this.lastFrame = null;
    this.hoveredId = null;
    this.focusedId = null;
    this.uniforms = {
      uTime: { value: 0 },
      uDispersion: { value: 0 },
      uLogoWidth: { value: 1000 },
      uField: { value: new THREE.Vector3(700, 350, this.options.depth) },
      uAmplitude: { value: 8 },
      uSize: { value: 1 },
      uPixelRatio: { value: 1 },
      uHoveredIndex: { value: -1 },
      uAmbientGlow: { value: 0.32 },
      uKeywordGlow: { value: 1.8 },
      uReactiveGlow: { value: 3 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader, fragmentShader,
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.rebuild();
  }

  mount(container, onSelect) {
    this.container = container;
    this.onSelect = onSelect;
    const canvas = this.renderer.domElement;
    canvas.setAttribute("aria-hidden", "true");
    this.targets = document.createElement("div");
    this.targets.className = "keyword-targets";
    this.targets.setAttribute("role", "group");
    this.targets.setAttribute("aria-label", "Partículas interactivas de keywords");
    this.buttons = new Map();
    for (const keyword of this.keywords.values()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "keyword-target";
      button.dataset.keywordId = String(keyword.id);
      button.setAttribute("aria-label", `${keyword.name}: ${keyword.definition}`);
      button.title = keyword.name;
      button.addEventListener("click", () => this.onSelect(keyword.id));
      button.addEventListener("focus", () => { this.focusedId = keyword.id; });
      button.addEventListener("blur", () => { this.focusedId = null; });
      this.buttons.set(keyword.id, button);
      this.targets.append(button);
    }
    container.append(canvas, this.targets);
    this.events = new AbortController();
    const { signal } = this.events;
    canvas.addEventListener("pointermove", (event) => {
      const rect = canvas.getBoundingClientRect();
      this.pointer.x = (event.clientX - rect.left) / rect.width * 2 - 1;
      this.pointer.y = 1 - (event.clientY - rect.top) / rect.height * 2;
      this.hoveredId = this.pick(event);
      canvas.style.cursor = this.hoveredId === null ? "default" : "pointer";
      canvas.title = this.keywords.get(this.hoveredId)?.name ?? "";
    }, { signal });
    canvas.addEventListener("pointerleave", () => {
      this.pointer.x = this.pointer.y = 0;
      this.hoveredId = null;
      canvas.style.cursor = "default";
      canvas.title = "";
    }, { signal });
    canvas.addEventListener("click", (event) => {
      const id = this.pick(event);
      if (id !== null) this.onSelect(id);
    }, { signal });
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.renderer.setAnimationLoop(null);
      this.onError?.("Se perdió el contexto WebGL. Recarga la página para recuperar la visualización.");
    }, { signal });
    document.addEventListener("visibilitychange", () => {
      this.lastFrame = null;
      this.renderer.setAnimationLoop(document.hidden ? null : this.animate);
    }, { signal });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.animate = (timestamp) => this.frame(timestamp);
    this.renderer.setAnimationLoop(this.animate);
  }

  rebuild() {
    const cloud = createCloudData(this.keywords, this.logoPoints, this.options);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(cloud.logo, 3));
    geometry.setAttribute("aSpread", new THREE.BufferAttribute(cloud.spread, 3));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(cloud.phase, 1));
    geometry.setAttribute("aKind", new THREE.BufferAttribute(cloud.kind, 1));
    geometry.setAttribute("aState", new THREE.BufferAttribute(new Float32Array(cloud.count), 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("aIndex", new THREE.BufferAttribute(Float32Array.from({ length: cloud.count }, (_, index) => index), 1));
    if (this.points) {
      this.scene.remove(this.points);
      this.points.geometry.dispose();
    }
    this.cloud = cloud;
    this.points = new THREE.Points(geometry, this.material);
    // The shader moves points outside the initial logo bounds.
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    if (this.state) this.renderStates(this.state);
    this.onCountChange?.(cloud.count);
  }

  renderStates(state) {
    this.state = state;
    const appearances = new Map();
    for (const id of this.keywords.keys()) {
      const flags = state.forKeyword(id);
      appearances.set(id, flags.isSpeciesMuted && flags.isSelected ? 5 : flags.appearance);
      const button = this.buttons?.get(id);
      if (!button) continue;
      button.tabIndex = flags.isActive ? 0 : -1;
      button.setAttribute("aria-disabled", String(!flags.isActive));
      button.setAttribute("aria-pressed", String(flags.isSelected));
      button.dataset.active = String(flags.isActive);
      button.dataset.related = String(flags.isRelated);
      button.dataset.state = String(flags.appearance);
    }
    const attribute = this.points.geometry.getAttribute("aState");
    for (let index = 0; index < this.cloud.count; index += 1) {
      attribute.array[index] = appearances.get(this.cloud.owner[index]) ?? 0;
    }
    attribute.needsUpdate = true;
    if (this.hoveredId !== null && !state.forKeyword(this.hoveredId).isActive) {
      this.hoveredId = null;
      this.renderer.domElement.style.cursor = "default";
      this.renderer.domElement.title = "";
    }
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.width = width;
    this.height = height;
    const fieldAspect = width < 700 ? 0.7 : 2.2;
    if (this.options.fieldAspect !== fieldAspect) {
      this.options.fieldAspect = fieldAspect;
      this.rebuild();
    }
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(55 / 2)) * 900;
    const viewWidth = viewHeight * this.camera.aspect;
    this.uniforms.uField.value.set(viewWidth * 0.48, viewHeight * 0.47, this.options.depth);
    this.uniforms.uLogoWidth.value = Math.min(viewWidth * 0.92, viewHeight * 5);
    const ratio = Math.min(devicePixelRatio || 1, 1.75);
    this.uniforms.uPixelRatio.value = ratio;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
  }

  replayIntro() {
    this.elapsed = 0;
  }

  frame(timestamp) {
    const delta = this.lastFrame === null ? 0 : Math.min((timestamp - this.lastFrame) / 1000, 0.05);
    this.lastFrame = timestamp;
    this.elapsed += delta;
    const reduced = this.motion.matches;
    this.time += reduced ? 0 : delta * this.options.speed;
    const dispersion = THREE.MathUtils.smoothstep(this.elapsed, reduced ? 0 : 1.6, reduced ? 0.3 : 6.4);
    const uniforms = this.uniforms;
    uniforms.uTime.value = this.time;
    uniforms.uDispersion.value = dispersion;
    uniforms.uAmplitude.value = reduced ? 0 : this.options.amplitude;
    uniforms.uSize.value = this.options.size * (this.width < 700 ? 0.75 : 1);
    uniforms.uField.value.z = this.options.depth;
    uniforms.uAmbientGlow.value = this.options.ambientGlow;
    uniforms.uKeywordGlow.value = this.options.keywordGlow;
    uniforms.uReactiveGlow.value = this.options.reactiveGlow;
    const hoverId = this.focusedId ?? this.hoveredId;
    uniforms.uHoveredIndex.value = this.cloud.anchors.find((anchor) => anchor.id === hoverId)?.index ?? -1;
    const parallax = this.options.parallax && !reduced ? dispersion * 0.045 : 0;
    const easing = 1 - Math.exp(-delta * 4);
    this.camera.position.x += (this.pointer.x * uniforms.uField.value.x * parallax - this.camera.position.x) * easing;
    this.camera.position.y += (this.pointer.y * uniforms.uField.value.y * parallax - this.camera.position.y) * easing;
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    this.renderer.render(this.scene, this.camera);
    this.projectTargets();
  }

  projectTargets() {
    const { logo, spread, phase } = this.cloud;
    const uniforms = this.uniforms;
    const mix = uniforms.uDispersion.value;
    const logoWidth = uniforms.uLogoWidth.value;
    const field = uniforms.uField.value;
    const amplitude = uniforms.uAmplitude.value * mix;
    for (const anchor of this.cloud.anchors) {
      const offset = anchor.index * 3;
      const p = phase[anchor.index];
      // Keep this formula identical to the vertex shader for exact picking.
      this.projected.set(
        logo[offset] * logoWidth * (1 - mix) + spread[offset] * field.x * mix + Math.sin(this.time * 0.6 + p) * amplitude,
        logo[offset + 1] * logoWidth * (1 - mix) + spread[offset + 1] * field.y * mix + Math.cos(this.time * 0.47 + p * 1.3) * amplitude,
        spread[offset + 2] * field.z * mix + Math.sin(this.time * 0.37 + p * 0.7) * amplitude,
      ).project(this.camera);
      anchor.x = (this.projected.x + 1) * this.width / 2;
      anchor.y = (1 - this.projected.y) * this.height / 2;
      anchor.visible = Math.abs(this.projected.x) < 1 && Math.abs(this.projected.y) < 1 && Math.abs(this.projected.z) < 1;
      const button = this.buttons.get(anchor.id);
      button.hidden = !anchor.visible;
      button.style.transform = `translate(${anchor.x}px, ${anchor.y}px)`;
    }
  }

  pick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let bestDistance = event.pointerType === "touch" ? 24 : 16;
    let id = null;
    for (const anchor of this.cloud.anchors) {
      if (!anchor.visible || !this.state?.forKeyword(anchor.id).isActive) continue;
      const distance = Math.hypot(anchor.x - x, anchor.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        id = anchor.id;
      }
    }
    return id;
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.events?.abort();
    this.resizeObserver?.disconnect();
    this.points.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.targets?.remove();
  }
}
