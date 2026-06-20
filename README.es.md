# Eact Maker — generador de eActivity para CASIO (web)

*[English version](README.md)*

Una herramienta en el navegador para crear archivos **eActivity** de CASIO (`.g2e` / `.g1e`) para
las calculadoras gráficas de la serie fx-9860G. Escribe tus fórmulas con un pequeño marcado tipo
LaTeX, previsualiza el resultado y descarga un archivo listo para pasar a la calculadora — todo
**del lado del cliente**, sin servidor; nada sale de tu equipo.

Es una recreación moderna de la herramienta en línea
[EactMaker](https://tools.planet-casio.com/EactMaker/) de Helder7 y Ziqumu. El codificador es un
port directo del generador [`casio-eactgen-py`](../casio-eactgen-py) obtenido por ingeniería
inversa, y su salida es **idéntica byte por byte** tanto a la referencia en Python como a la salida
real de EactMaker (verificado con `npm run test:parity`).

> **Extensiones.** La fx-9860G**III** abre **tanto `.g1e` como `.g2e`**: los dos contenedores son
> idénticos byte a byte; solo cambia la extensión (`.g2e` es el formato nativo de la GII/GIII,
> `.g1e` es el de la fx-9860G antigua). `.g2e` es el valor por defecto seguro. Si un archivo no
> abre, la causa es el *contenido*, no la extensión.

## Funcionalidades

- **Editor en vivo** — una línea de la eActivity por renglón, con una barra de herramientas
  matemáticas (√, fracción, sub/superíndice, Σ, matriz, log, |a|, derivadas, integral, nota) y
  paletas de caracteres (Maths, Griego, Subíndices, Latín, Cirílico, Misc).
- **Vista previa y validación** — decodifica tu entrada a texto legible, muestra el tamaño de
  salida y señala cualquier carácter que la tabla de fuentes de CASIO no pueda representar *antes*
  de convertir.
- **Convertir y descargar** — genera el archivo `.g2e`/`.g1e` en el navegador.
- **Guardar / Cargar proyecto** — almacena tu trabajo como un archivo `.eam.json`; el editor además
  autoguarda en `localStorage` y restaura al recargar.

## Primeros pasos

```bash
npm install
npm run gen:chars      # genera el JSON de la tabla de caracteres desde ../casio-eactgen-py/chars.toml
npm run dev            # http://localhost:3000
```

`npm run gen:chars` solo hay que ejecutarlo una vez (el JSON generado está versionado); vuelve a
ejecutarlo si cambia `../casio-eactgen-py/chars.toml`.

## Cómo se usa

1. Introduce un **Título** (≤8 caracteres — se convierte en el encabezado `======TÍTULO======` y en
   el nombre que aparece en la calculadora).
2. Escribe tus fórmulas en el editor, una línea de la eActivity por renglón. Usa los botones de la
   barra/paletas o escribe el marcado directamente.
3. Elige un **Formato** (`.g2e` por defecto, o `.g1e`).
4. Pulsa **Convert & download**, luego copia el archivo a la calculadora (almacenamiento USB / Link
   / FA-124) y ábrelo desde el menú eActivity.

El **modo de compatibilidad** cambia cómo se codifican `²` `³`: desactivado → el glifo literal de
superíndice; activado → la forma de potencia (`^`). Corresponde a la opción `literalSuper` del
codificador.

## Marcado

| Escribes | Resultado |
|----------|-----------|
| `\frac{a}{b}` | fracción apilada |
| `½ ⅓ ¼ …` | fracción apilada (glifos de fracción) |
| `\sqrt{x}` | raíz cuadrada |
| `\abs{x}` | valor absoluto / módulo |
| `\int{inf}{sup}{f}` | integral (cualquier argumento puede ir vacío: `\int{}{x=V}{f}`) |
| `\log{a}{b}` | logaritmo en base *a* de *b* |
| `\sum{n}{k}{0}{a}` | sumatoria (cantidad, variable, inicio, expresión) |
| `\mat{a&b}{c&d}` | matriz (filas en `{}`, celdas separadas por `&`) |
| `\diff{a}{b}` / `\diff2{a}{b}` | derivada 1ª / 2ª de *a* respecto de *b* |
| `\note{título}{cuerpo}` | nota / recuadro (en su propia línea) |
| `^2`, `^{n+1}` | superíndice / potencia |
| `_v`, `_{12}` | subíndice (letras y dígitos) |
| `²` `³` | glifos de superíndice |
| `∇ ∂ · ⇒ ε μ π σ ρ θ Ω …` | se escriben directamente como Unicode |
| `\nabla \partial \epsilon \pi \sigma …` | nombres LaTeX, si son más cómodos de teclear |

El ASCII normal pasa sin cambios. Las paletas solo ofrecen glifos que la fuente de CASIO puede
representar.

## Limitaciones

- Solo se admiten **G1E / G2E**. Los formatos G3E / FLS / XCP / CAT del sitio original *no* están
  implementados (tampoco lo están en la referencia en Python).
- No todos los caracteres Unicode tienen un mapeo en CASIO (p. ej. `∞`, `α`). La vista previa los
  reporta; la referencia en Python se comporta de forma idéntica.
- Una nota con cuerpo vacío (`\note{T}{}`) es degenerada en EactMaker: dale cuerpo a las notas.

## Arquitectura

| Ruta | Qué es |
|------|--------|
| `src/lib/casio/` | Codificador en TypeScript — `encode`, `note`, `container`, `decode`, `chars`, `index`. Un port fiel de `../casio-eactgen-py/casio_translate.py`. |
| `src/lib/casio/chars.generated.json` | Mapas Unicode↔CASIO, generados desde `chars.toml`. |
| `scripts/gen-chars.mjs` | Paso de build que produce el JSON (`npm run gen:chars`). |
| `scripts/parity.ts` | Prueba de igualdad byte a byte contra la referencia en Python (`npm run test:parity`). |
| `src/components/EactMaker.tsx` | La interfaz del editor (solo cliente). |

Todo se ejecuta en el navegador; no hay backend. Consulta [`AGENTS.md`](AGENTS.md) para los detalles
internos del formato y notas para contribuir, y [`../casio-eactgen-py`](../casio-eactgen-py) para la
implementación de referencia y la especificación completa del formato binario obtenida por
ingeniería inversa.

### Scripts

```bash
npm run dev          # servidor de desarrollo
npm run gen:chars    # regenera chars.generated.json desde chars.toml
npm run test:parity  # verifica que la salida TS es idéntica byte a byte a la referencia Python
npm run build        # build de producción
npm run lint         # eslint
```

## Créditos

- Tabla de caracteres: proyecto [Cahute](https://cahute.org) (Thomas Touhey), CeCILL 2.1.
- Formato inspirado en / verificado contra [EactMaker](https://tools.planet-casio.com/EactMaker/)
  de Helder7 y Ziqumu, y el trabajo de ingeniería inversa de SimonLothar.

## Aviso

CASIO y fx-9860G son marcas registradas de CASIO Computer Co., Ltd. Esta es una herramienta
independiente y no oficial. Haz copias de seguridad de los archivos de tu calculadora.
