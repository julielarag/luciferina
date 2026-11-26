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

`index.html` es autocontenido (estilos y script en línea) y dibuja todo en un
canvas 2D:

- **Bienvenida:** las 757 formas elípticas de `img/logotipo_luciferina.svg`
  se reúnen para formar "Luciferina"; debajo hay un párrafo y el botón
  "Explora las redes". Al pulsarlo, las partículas se dispersan por la pantalla
  y aparecen los filtros por especie.
- **Keywords:** 151 de esas formas son keywords. Hover → brillo y escala 110%;
  clic → partícula blanca al 115%, líneas hacia sus keywords relacionadas
  (que se iluminan) y panel con la definición. Esc o un segundo clic la
  deseleccionan. También funcionan con Tab y Enter/Espacio.
- **Bioluminiscencia:** una capa extra de plancton casi invisible destella y es
  arrastrada al pasar el cursor (o el dedo), como dinoflagelados en el agua;
  el logotipo y las keywords también reaccionan y regresan a su sitio.
- **Controles:** abre `http://localhost:8000/?gui` para mostrar dat.gui y
  ajustar número de partículas, tamaños, movimiento, brillo, intensidad y
  duración del destello, o volver a formar el logotipo.

Los datos se leen de `data/especies.csv`, `data/keywords.csv` y
`data/keyword_especie.csv`.

## Espacio 3D

Abre `http://localhost:8000/3d.html`. La entrada utiliza las 757 formas de
`img/logotipo_luciferina.svg`; tras una pausa de 1.6 segundos, se dispersan
en una nube con profundidad, oscilación sinusoidal y paralaje del cursor.

Por defecto hay 12,000 partículas ambientales, 151 núcleos de keywords y
18 acompañantes por keyword: 14,869 partículas. En móvil se reduce el ambiente
a 6,000. Los núcleos tienen más brillo que el ambiente; las acompañantes
intensifican su brillo cuando su keyword está seleccionada, relacionada o
coincide con la especie filtrada. Las keywords excluidas por el filtro se
atenúan y no se pueden activar; conservan su selección y relaciones.

El panel dat.gui permite cambiar densidad, tamaño, brillo, velocidad,
oscilación, profundidad y paralaje, y repetir la entrada sin perder el estado.
Los cambios de densidad conservan las posiciones de los núcleos. La selección
funciona con clic, toque o Tab y Enter/Espacio. Se respeta la preferencia de
movimiento reducido y se pausa el renderizado cuando la pestaña está oculta.

La implementación sigue el patrón `BufferGeometry` + `Points` del
[demo de billboards de Three.js](https://github.com/mrdoob/three.js/blob/master/examples/webgl_points_billboards.html),
con shaders propios para animar y dar brillo en una sola llamada de dibujo.
Three.js 0.180.0 y dat.gui 0.7.9 se cargan desde jsDelivr: se requiere conexión
para cargar esas dependencias y un navegador con WebGL 2.

### Archivos

- `js/data-repository.js`: CSV, SVG de keywords y relaciones bidireccionales.
- `js/particle-interaction.js`: estado, menú y detalle compartidos por ambas vistas.
- `js/svg-particle-view.js`: renderizado SVG original.
- `js/particle-cloud-data.js`: muestreo del logotipo y distribución con IDs persistentes.
- `js/particle-space.js` y `js/particle-shaders.js`: renderizado, animación y selección 3D.
- `js/particle-controls.js`: controles dat.gui.
- `js/3d.js`: inicialización y ciclo de vida de la vista 3D.
- `css/3d.css`: ajustes del escenario sin cambiar los estilos del menú y detalle.

Pruebas de datos, filtros, selección y propiedad de partículas, con Node.js 22+:

```sh
node tests/particles.test.mjs
```
