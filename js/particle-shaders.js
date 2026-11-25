// Billboards follow the Three.js webgl_points_billboards example. Analytic
// radial sprites allow per-particle glow without a texture or bloom passes.
export const vertexShader = /* glsl */ `
  attribute vec3 aSpread;
  attribute float aPhase;
  attribute float aKind;
  attribute float aState;
  uniform float uTime;
  uniform float uDispersion;
  uniform float uLogoWidth;
  uniform vec3 uField;
  uniform float uAmplitude;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uHoveredIndex;
  attribute float aIndex;
  varying float vKind;
  varying float vState;
  varying float vPulse;
  varying float vHover;

  void main() {
    vec3 drift = vec3(
      sin(uTime * 0.6 + aPhase),
      cos(uTime * 0.47 + aPhase * 1.3),
      sin(uTime * 0.37 + aPhase * 0.7)
    ) * uAmplitude * uDispersion;
    vec3 point = mix(position * uLogoWidth, aSpread * uField, uDispersion) + drift;
    vec4 mvPosition = modelViewMatrix * vec4(point, 1.0);
    bool reactive = aState > 0.5 && aState < 3.5;
    vHover = abs(aIndex - uHoveredIndex) < 0.5 ? 1.0 : 0.0;
    float size = aKind > 1.5 ? 19.0 : aKind > 0.5 ? (reactive ? 10.0 : 5.0) : 3.5;
    size *= 1.0 + (reactive ? 0.35 : 0.0) + vHover * 0.35;
    gl_PointSize = clamp(size * uSize * uPixelRatio * (900.0 / -mvPosition.z), 1.0, 100.0 * uPixelRatio);
    gl_Position = projectionMatrix * mvPosition;
    vKind = aKind;
    vState = aState;
    vPulse = 0.88 + 0.12 * sin(uTime * (reactive ? 2.4 : 0.8) + aPhase);
  }
`;

export const fragmentShader = /* glsl */ `
  uniform float uAmbientGlow;
  uniform float uKeywordGlow;
  uniform float uReactiveGlow;
  varying float vKind;
  varying float vState;
  varying float vPulse;
  varying float vHover;

  void main() {
    float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
    if (radius > 1.0) discard;
    float glow = exp(-radius * radius * 5.0) * 0.48;
    float core = exp(-radius * radius * 65.0);
    bool reactive = vState > 0.5 && vState < 3.5;
    bool muted = vState > 3.5;
    float intensity = vKind > 1.5 ? uKeywordGlow : vKind > 0.5 ? uAmbientGlow * 1.2 : uAmbientGlow;
    if (reactive && vKind > 0.5) intensity *= uReactiveGlow;
    if (muted) intensity *= vState < 4.5 ? 0.10 : 0.22;
    intensity *= vPulse * (1.0 + vHover * 0.8);
    vec3 color = vState > 0.5 && vState < 1.5 ? vec3(0.9, 1.0, 1.0)
      : reactive ? vec3(0.40, 0.94, 1.0) : vec3(0.0, 0.72, 1.0);
    vec3 light = color * glow + mix(color, vec3(1.0), 0.7) * core;
    // Alpha follows emitted light; a constant alpha would darken the page
    // around dim sprites when the transparent canvas is composited.
    float alpha = clamp((glow + core) * intensity, 0.0, 1.0);
    gl_FragColor = vec4(light * intensity, alpha * (1.0 - smoothstep(0.7, 1.0, radius)));
  }
`;
