const API_FORM_URL = "http://localhost:3000/api/formulario/";
const API_SAVE_URL = "http://localhost:3000/api/indicador/";
const API_BUSCAR_FORMULA = "http://localhost:3000/api/indicadores/formulatexto";
const API_VALIDAR_FORMULA = "http://localhost:3000/api/indicador/validar-formula";

let indicadorSeleccionado = null;
let formulaValidada = false;


window.textosResumen = {};
function obtenerTextoIndicador(ind) {
  if (window.textosResumen[ind.codigo]) {
    return window.textosResumen[ind.codigo];
  }

  return ind.texto || "";
}

const entorno = document.getElementById("entorno").value;

fetch(`${API_FORM_URL}${codigo}?env=${entorno}`)

/* =========================
   CONSULTAR FORMULARIO
========================= */
async function consultarFormulario() {
  const codigo = document.getElementById("codigo").value.trim();
  const entorno = document.getElementById("entorno").value;

  if (!codigo) {
    alert("Introduce un código de formulario");
    return;
  }

  const resp = await fetch(
    `${API_FORM_URL}${codigo}?env=${entorno}`
  );

  if (resp.status === 404) {
    alert("❌ El formulario no existe");
    return;
  }

  if (!resp.ok) {
    alert("❌ Error consultando el formulario");
    return;
  }

  const data = await resp.json();
  window._formData = data.indicadores;
  cargarTabla(data.indicadores);
}

/* =========================
   MOSTRAR TABLA
========================= */
function cargarTabla(indicadores) {
  const tbody = document.querySelector("#tabla tbody");
  tbody.innerHTML = "";

  indicadores.forEach((ind, index) => {
    const valores = ind.valores?.map(v => v.descripcion).join(", ") || "";
    const texto = obtenerTextoIndicador(ind);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <input type="checkbox" class="row-select" data-index="${index}">
      </td>
      <td>${ind.codigo}</td>
      <td>${texto || "<em>(sin texto)</em>"}</td>
      <td>${ind.tipo}</td>
      <td>${valores}</td>
      <td>
        <button onclick="editarTexto('${ind.codigo}')" title="Editar texto">
          ✏️
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  document.getElementById("selectAll").onclick = e => {
    document.querySelectorAll(".row-select").forEach(cb => {
      cb.checked = e.target.checked;
    });
  };
}


/* =========================
   GENERAR RESUMEN
========================= */
function generarResumen() {
  if (!window._formData) {
    alert("Primero consulta un formulario");
    return;
  }

  const seleccionados = [...document.querySelectorAll(".row-select")]
    .filter(cb => cb.checked)
    .map(cb => window._formData[cb.dataset.index]);

  if (!seleccionados.length) {
    alert("Selecciona al menos un indicador");
    return;
  }

  const bloques = seleccionados.map(buildBloqueQS).filter(Boolean);

  if (!bloques.length) {
    alert("No hay contenido válido");
    return;
  }

  document.getElementById("resultado").value = anidarSuma(bloques);
  formulaValidada = false;

}

/* =========================
   BLOQUE QS
========================= */
function buildBloqueQS(ind) {
  const IND = `$$${ind.codigo}$$`;
 const textoBase = obtenerTextoIndicador(ind);

if (!textoBase) return ""; // no mostramos nada si no hay texto

const texto = textoBase.replace(/"/g, '\\"');


  if (ind.tipo === "FormulaTexto" || ind.tipo === "Componente") return "";

  let valorExpr = "";

  switch (ind.tipo) {
    case "Texto":
    case "Entero":
    case "Decimal":
    case "Fecha":
    case "Resultado":
      valorExpr = `str(${IND})`;
      break;

    case "Hora":
      valorExpr = `str(hazhora(hora(${IND}), minuto(${IND})))`;
      break;

    case "Check":
      valorExpr = `caso(${IND},1,"Si",0,"No")`;
      break;
      
case "Lista":
  if (ind.valores?.length) {
    const mapa = {};
    ind.valores.forEach(v => {
      const id = String(v.id);
      if (!mapa[id]) {
        mapa[id] = v.descripcion;
      }
    });

    const pares = Object.entries(mapa)
      .map(([id, desc]) =>
        `${id},"${desc.replace(/"/g, '\\"')}"`
      )
      .join(",");

    valorExpr = pares
      ? `caso(eval(${IND}),${pares})`
      : `str(${IND})`;

  } else {
    valorExpr = `str(${IND})`;
  }
  break;


case "ListaMultiseleccion":
  if (ind.valores?.length) {

    const mapa = {};
    ind.valores.forEach(v => {
      const id = String(v.id);
      if (!mapa[id]) {
        mapa[id] = v.descripcion;
      }
    });

    const pares = Object.entries(mapa)
      .map(([id, desc]) =>
        `${id},"${desc.replace(/"/g, '\\"')}"`
      )
      .join(",");

    valorExpr = pares
      ? `caso(eval(${IND}),${pares})`
      : `str(${IND})`;

  } else {
    valorExpr = `str(${IND})`;
  }
  break;


    default:
      valorExpr = `str(${IND})`;
  }

  return `
si(distinto(${IND},""),suma("
${texto}: ", ${valorExpr}),"")`;
}

/* =========================
   ANIDAR SUMA
========================= */
function anidarSuma(bloques) {
  return bloques.reduce((acc, b) => acc ? `suma(${acc}, ${b})` : b, "");
}
//TEXT0//
function editarTexto(codigo) {
  const actual = window.textosResumen[codigo] || "";
  const nuevo = prompt("Editar texto que aparecerá en el resumen:", actual);

  if (nuevo === null) return;

  if (nuevo.trim() === "") {
    delete window.textosResumen[codigo];
  } else {
    window.textosResumen[codigo] = nuevo.trim();
  }

  generarResumen(); // reconstruye la fórmula automáticamente
}

/* =========================
   BUSCADOR GLOBAL FORMULATEXTO
========================= */
function inicializarBuscadorIndicadores() {
  const input = document.getElementById("buscarIndicador");
  const lista = document.getElementById("listaIndicadores");
  const btn = document.getElementById("btnGuardarFormula");

  input.value = "";
  lista.innerHTML = "";
  btn.disabled = true;
  indicadorSeleccionado = null;

  let controller;

  input.oninput = async () => {
    const q = input.value.trim();
    lista.innerHTML = "";
    indicadorSeleccionado = null;
    btn.disabled = true;

    if (q.length < 2) return;

    if (controller) controller.abort();
    controller = new AbortController();

    try {
      const resp = await fetch(
        `${API_BUSCAR_FORMULA}?q=${encodeURIComponent(q)}`,
        { signal: controller.signal }
      );

      if (!resp.ok) return;

      const resultados = await resp.json();

      resultados.forEach(i => {
        const div = document.createElement("div");
        div.className = "item-indicador";
        div.textContent = `${i.Codigo} — ${i.Descripcion}`;

        div.onclick = () => {
          indicadorSeleccionado = i.Codigo;
          input.value = i.Codigo;
          lista.innerHTML = "";
          btn.disabled = false;
        };

        lista.appendChild(div);
      });

    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("❌ Buscador FormulaTexto:", err);
      }
    }
  };
}

/* =========================
   GUARDAR FÓRMULA
========================= */
document.getElementById("btnGuardarFormula").onclick = async () => {
  const formula = document.getElementById("resultado").value.trim();
  const estado = document.getElementById("estadoGuardado");

  estado.textContent = "";

  if (!indicadorSeleccionado) {
    estado.textContent = "❌ Selecciona un indicador FormulaTexto";
    estado.style.color = "red";
    return;
  }

  if (!formula) {
    estado.textContent = "❌ No hay fórmula para guardar";
    estado.style.color = "red";
    return;
  }
  if (!formulaValidada) {
    estado.textContent = "❌ Debes validar la fórmula antes de guardarla";
    estado.style.color = "red";
    return;
  }

  try {
    const resp = await fetch(
      `${API_SAVE_URL}${indicadorSeleccionado}/formula`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formula })
      }
    );

    const data = await resp.json();

    if (!resp.ok) {
      estado.textContent = `❌ ${data.error || "Error guardando la fórmula"}`;
      estado.style.color = "red";
      return;
    }

    estado.textContent = "✔ Fórmula guardada correctamente";
    estado.style.color = "green";

  } catch (err) {
    console.error(err);
    estado.textContent = "❌ Error de conexión con la API";
    estado.style.color = "red";
  }
};

document.getElementById("resultado").addEventListener("input", () => {
  formulaValidada = false;
});
document.getElementById("btnValidarFormula").onclick = async () => {
  const formula = document.getElementById("resultado").value.trim();
  const estado = document.getElementById("estadoGuardado");

  estado.textContent = "";
  estado.style.color = "black";

  if (!formula) {
    estado.textContent = "❌ No hay fórmula para validar";
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
      formulaValidada = false;
      return;
    }

    estado.textContent = "✔ Fórmula válida. Puedes guardarla.";
    estado.style.color = "green";
    formulaValidada = true;

  } catch (err) {
    console.error(err);
    estado.textContent = "❌ Error validando fórmula";
    estado.style.color = "red";
    formulaValidada = false;
  }
};


/* =========================
   UTILIDADES
========================= */
document.getElementById("btnCopiarResumen").onclick = () => {
  navigator.clipboard.writeText(
    document.getElementById("resultado").value
  );
};

document.getElementById("btnLimpiarResumen").onclick = () => {
  document.getElementById("resultado").value = "";
};

document.addEventListener("DOMContentLoaded", () => {
  inicializarBuscadorIndicadores();
});
