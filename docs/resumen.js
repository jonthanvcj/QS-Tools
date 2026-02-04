/* =========================
   CONSTANTES API
========================= */
const API_FORM_URL = "http://localhost:3000/api/formulario/";
const API_VALIDAR_FORMULA = "http://localhost:3000/api/indicador/validar-formula";

/* =========================
   ESTADO GLOBAL
========================= */
let indicadorAuxActual = null;
let formulaValidada = false;

window.textosResumen = {};
window._formData = [];

/* =========================
   UTIL TEXTO
========================= */
function obtenerTextoIndicador(ind) {
  return window.textosResumen[ind.codigo] ?? ind.texto ?? "";
}

/* =========================
   CONSULTAR FORMULARIO
========================= */
async function consultarFormulario() {
  const codigo = document.getElementById("codigo").value.trim();
  const env = document.getElementById("entorno").value;

  if (!codigo) return alert("Introduce un código de formulario");

  const resp = await fetch(`${API_FORM_URL}${codigo}?env=${env}`);
  if (!resp.ok) return alert("Formulario no encontrado");

  const data = await resp.json();
  window._formData = data.indicadores || [];
  cargarTabla(window._formData);
}

/* =========================
   TABLA INDICADORES
========================= */
function cargarTabla(indicadores) {
  const tbody = document.querySelector("#tabla tbody");
  tbody.innerHTML = "";

  indicadores.forEach((ind, i) => {
    const valores = ind.valores?.map(v => v.descripcion).join(", ") || "";

    const acciones =
      ind.tipo === "ListaMultiseleccion"
        ? `<button onclick="abrirModalAux(${i})">➕ Crear indicador</button>`
        : "";

    tbody.innerHTML += `
      <tr>
        <td><input type="checkbox" class="row-select" data-index="${i}"></td>
        <td>${ind.codigo}</td>
        <td>${obtenerTextoIndicador(ind) || "<em>(sin texto)</em>"}</td>
        <td>${ind.tipo}</td>
        <td>${valores}</td>
        <td>${acciones}</td>
      </tr>
    `;
  });

  document.getElementById("selectAll").onclick = e =>
    document.querySelectorAll(".row-select")
      .forEach(cb => cb.checked = e.target.checked);
}

/* =========================
   GENERAR RESUMEN
========================= */
async function generarResumen() {
  const seleccionados = [...document.querySelectorAll(".row-select")]
    .filter(cb => cb.checked)
    .map(cb => window._formData[cb.dataset.index]);

  if (!seleccionados.length)
    return alert("Selecciona al menos un indicador");

  const bloques = [];

  for (const ind of seleccionados) {
    const bloque = buildBloqueQS(ind);
    if (bloque) bloques.push(bloque);
  }

  document.getElementById("resultado").value = anidarSuma(bloques);
  formulaValidada = false;
}

/* =========================
   BLOQUE QS
========================= */
function buildBloqueQS(ind) {
  const IND = `$$${ind.codigo}$$`;
  const texto = obtenerTextoIndicador(ind);
  if (!texto) return "";

  if (["FormulaTexto", "Componente"].includes(ind.tipo)) return "";

  let valorExpr = `str(${IND})`;

  if (ind.tipo === "Lista" && ind.valores?.length) {
    const pares = ind.valores
      .map(v => `${v.id},"${v.descripcion.replace(/"/g, '\\"')}"`)
      .join(",");
    valorExpr = `caso(eval(${IND}),${pares})`;
  }

  if (ind.tipo === "ListaMultiseleccion") {
    const aux = `AUX_${ind.codigo.slice(0, 15)}_TXT`;
    valorExpr = `str($$${aux}$$)`;
  }

  return `
si(distinto(${IND},""),suma("
${texto}: ",${valorExpr}),"")`;
}

/* =========================
   ANIDAR SUMAS
========================= */
function anidarSuma(bloques) {
  return bloques.reduce(
    (acc, b) => acc ? `suma(${acc},${b})` : b,
    ""
  );
}

/* =========================================================
   ===== MODAL AUXILIAR (LISTA MULTISELECCIÓN) =====
========================================================= */

/* === ABRIR MODAL === */
function abrirModalAux(idx) {
  indicadorAuxActual = window._formData[idx];

  document.getElementById("modalAux").classList.remove("hidden");
  document.getElementById("auxOrigen").textContent =
    indicadorAuxActual.codigo;

  const codigoPropuesto =
    `AUX_${indicadorAuxActual.codigo}_TXT`.slice(0, 30);

  document.getElementById("auxCodigo").value = codigoPropuesto;
  document.getElementById("auxDescripcion").value =
    `Texto generado desde ${indicadorAuxActual.codigo}`;

  // 🔥 AQUÍ ESTÁ LA CLAVE
  document.getElementById("auxFormula").value =
    generarFormulaAuxListaMultiseleccion(indicadorAuxActual);

  document.getElementById("auxEstado").textContent = "";
  actualizarContadorAux();
}

/* === CERRAR MODAL === */
function cerrarModalAux() {
  document.getElementById("modalAux").classList.add("hidden");
}

/* === CONTADOR CÓDIGO === */
function actualizarContadorAux() {
  const v = document.getElementById("auxCodigo").value;
  const el = document.getElementById("auxContador");
  if (el) el.textContent = `${v.length}/30`;
}

document.getElementById("auxCodigo")?.addEventListener("input", actualizarContadorAux);

/* === GENERAR FÓRMULA AUX === */
function generarFormulaAuxListaMultiseleccion(ind) {
  const IND = `$$${ind.codigo}$$`;

  let f = `si(distinto(${IND},""),\n`;
  f += `suma(\n`;

  if (!ind.valores || !ind.valores.length) {
    f += `""\n`;
  } else {
    ind.valores.forEach(v => {
      f +=
        `si(contieneA(${IND},"${v.id}"),"${v.descripcion}, ",""),\n`;
    });
    f += `""\n`;
  }

  f += `)\n,"")`;
  return f;
}

/* === VALIDAR FÓRMULA AUX === */
async function validarAux() {
  const formula = document.getElementById("auxFormula").value.trim();
  const estado = document.getElementById("auxEstado");

  estado.textContent = "";

  if (!formula) {
    estado.textContent = "❌ No hay fórmula";
    estado.style.color = "red";
    return;
  }

  try {
    const resp = await fetch(API_VALIDAR_FORMULA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formula })
    });

    const data = await resp.json();

    if (!resp.ok) {
      estado.innerHTML =
        "❌ Fórmula inválida<ul>" +
        data.errores.map(e => `<li>${e}</li>`).join("") +
        "</ul>";
      estado.style.color = "red";
      return;
    }

    estado.textContent = "✔ Fórmula válida";
    estado.style.color = "green";

  } catch (e) {
    estado.textContent = "❌ Error validando fórmula";
    estado.style.color = "red";
  }
}

/* === COPIAR FÓRMULA AUX === */
function copiarAux() {
  navigator.clipboard.writeText(
    document.getElementById("auxFormula").value
  );
}
