import test from "node:test";
import assert from "node:assert/strict";
import { CsvParser } from "../js/data-repository.js";
import { ParticleState } from "../js/particle-interaction.js";
import { createCloudData } from "../js/particle-cloud-data.js";

const keywords = new Map([
  [1, { id: 1, speciesIds: new Set([1, 2]) }],
  [7, { id: 7, speciesIds: new Set([2]) }],
  [42, { id: 42, speciesIds: new Set([1]) }],
]);
const relatedKeywords = new Map([[1, new Set([7])], [7, new Set([1])], [42, new Set()]]);

test("CSV conserva definiciones con comas, comillas escapadas y saltos de línea", () => {
  const rows = CsvParser.parse('\uFEFFid,definicion\r\n1,"Emisión, breve ""luz"".\nOtra línea"\r\n2,Simple\r\n');
  assert.deepEqual(rows, [
    { id: "1", definicion: 'Emisión, breve "luz".\nOtra línea' },
    { id: "2", definicion: "Simple" },
  ]);
  assert.throws(() => CsvParser.parse('id,definicion\n1,"Sin cierre'), /sin cerrar/);
});

test("selección, relación y filtro mantienen estados independientes", () => {
  const state = new ParticleState({ keywords, relatedKeywords });
  assert(state.selectKeyword(7));
  assert(state.forKeyword(1).isRelated);
  state.selectedSpeciesId = 1;
  assert.equal(state.selectedKeywordId, 7);
  assert.deepEqual(state.forKeyword(7), {
    isSelected: true, isRelated: false, isSpeciesMatch: false,
    isSpeciesMuted: true, isActive: false, appearance: 4,
  });
  assert(state.forKeyword(1).isRelated);
  assert(state.forKeyword(1).isSpeciesMatch);
  assert.equal(state.forKeyword(1).appearance, 2);
  assert.equal(state.selectKeyword(7), false);
  assert.equal(state.selectKeyword(999), false);
  state.selectedSpeciesId = null;
  assert(state.selectKeyword(7));
  assert.equal(state.selectedKeywordId, null);
  assert.equal(state.forKeyword(1).isRelated, false);
});

test("nube conserva IDs reales y propiedad de todas las partículas reactivas", () => {
  const points = [{ x: 0.1, y: -0.01, rx: 0.002, ry: 0.003 }];
  const options = { ambientCount: 200, satellitesPerKeyword: 18 };
  const cloud = createCloudData(keywords, points, options);
  assert.equal(cloud.count, 257);
  assert.equal(cloud.anchors.length, keywords.size);
  assert.equal(cloud.logo.length, cloud.count * 3);
  assert.equal(cloud.owner.filter(id => id === -1).length, 200);
  for (const id of keywords.keys()) {
    assert.equal(cloud.owner.filter(owner => owner === id).length, 19);
    const anchor = cloud.anchors.find(anchor => anchor.id === id);
    assert.equal(cloud.kind[anchor.index], 2);
    assert.equal(cloud.owner[anchor.index], id);
  }
  assert(cloud.logo.every(Number.isFinite));
  assert(cloud.spread.every(Number.isFinite));
  const rebuilt = createCloudData(keywords, points, { ...options, ambientCount: 500 });
  assert.deepEqual(rebuilt.anchors, cloud.anchors);
  assert.deepEqual(rebuilt.spread.slice(0, 171), cloud.spread.slice(0, 171));
  const denser = createCloudData(keywords, points, { ...options, satellitesPerKeyword: 30 });
  for (const anchor of cloud.anchors) {
    const next = denser.anchors.find(next => next.id === anchor.id);
    assert.deepEqual(
      cloud.spread.slice(anchor.index * 3, anchor.index * 3 + 3),
      denser.spread.slice(next.index * 3, next.index * 3 + 3),
    );
    assert.equal(cloud.phase[anchor.index], denser.phase[next.index]);
  }
});
