export class CsvParser {
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

export class DataRepository {
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

    return { species, keywords, relatedKeywords, shapes, svg };
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

