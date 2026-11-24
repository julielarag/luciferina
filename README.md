# Luciferina — Red de partículas

Visualización interactiva de keywords y especies. Cada forma de
`img/particulas_activas.svg` se enlaza, en orden, con una fila de
`data/keywords.csv`; el PNG inactivo queda como capa base.

## Ejecutar

Desde la carpeta del proyecto, inicia un servidor local:

```sh
python3 -m http.server 8000
```

Abre `http://localhost:8000/`. Se necesita un servidor porque la página carga
los CSV y el SVG con `fetch`.

## Interacción y ajustes

- Pasa el cursor por una partícula para ver su glow; haz clic para ampliar la
  partícula un 15%, iluminar sus keywords relacionadas y leer su definición.
- Usa los botones superiores para resaltar por especie; vuelve a pulsar el
  botón activo para quitar el filtro.
- Ajusta el rango de escala aleatoria en `PARTICLE_SIZE_MIN` y
  `PARTICLE_SIZE_MAX`; `PARTICLE_MIN_RADIUS` establece el radio mínimo visible.

Los datos se leen de `data/especies.csv`, `data/keywords.csv` y
`data/keyword_especie.csv`.