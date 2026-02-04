const API = "http://localhost:3000/api";

const btn = document.getElementById("btnBuscar");
const input = document.getElementById("codigoInput");
const error = document.getElementById("error");

const cardFormulario = document.getElementById("cardFormulario");
const cardAviso = document.getElementById("cardAviso");
const cardImpacto = document.getElementById("cardImpacto");
const cardPlanes = document.getElementById("cardPlanes");

const formCodigo = document.getElementById("formCodigo");
const formTipo = document.getElementById("formTipo");
const impactoLista = document.getElementById("impactoLista");
const planesLista = document.getElementById("planesLista");

btn.onclick = buscar;

async function buscar() {
  reset();

  const codigo = input.value.trim();
  if (!codigo) {
    mostrarError("Introduce un código");
    return;
  }

  try {
    const resp = await fetch(`${API}/formulario/${codigo}/impacto`);
    if (!resp.ok) {
      mostrarError("Formulario no encontrado");
      return;
    }

    const data = await resp.json();

    formCodigo.textContent = data.codigo;
    formTipo.textContent = data.esDecisionClinica
      ? "Decisión clínica"
      : "Formulario asistencial";

    cardFormulario.classList.remove("hidden");

    impactoLista.innerHTML = data.esDecisionClinica
      ? `
        <li>✔ Decide diagnósticos (DX)</li>
        <li>✔ Decide variables clínicas (VC)</li>
        <li>✔ Condiciona la implantación</li>
      `
      : `
        <li>✖ No decide diagnósticos</li>
        <li>✖ No decide variables clínicas</li>
        <li>✔ Aporta información asistencial</li>
      `;

    cardImpacto.classList.remove("hidden");

    if (!data.esDecisionClinica) {
      cardAviso.innerHTML = `
        <strong>ℹ Información</strong><br>
        Este formulario no lanza DX/VC directamente.
        Su impacto depende de la vía clínica donde se utilice.
      `;
      cardAviso.classList.remove("hidden");
    }

    if (data.planes.length) {
      planesLista.innerHTML = data.planes
        .map(p => `<li>${p}</li>`)
        .join("");
      cardPlanes.classList.remove("hidden");
    }

  } catch (e) {
    console.error(e);
    mostrarError("Error de conexión");
  }
}

function reset() {
  error.classList.add("hidden");
  cardFormulario.classList.add("hidden");
  cardAviso.classList.add("hidden");
  cardImpacto.classList.add("hidden");
  cardPlanes.classList.add("hidden");
}

function mostrarError(msg) {
  error.textContent = msg;
  error.classList.remove("hidden");
}
