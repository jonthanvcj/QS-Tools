let API_URL = "http://localhost:3000/api/formulario/";

// --- helpers
const $ = id => document.getElementById(id);
const escapeQuote = s => (s||'').replace(/"/g,'\\"');


// suma solo 2 parametros 
function anidarSuma(bloques) {
  if (!bloques || bloques.length === 0) return "0";
  if (bloques.length === 1) return bloques[0];
  // suma(suma(a,b),c)
  let s = `suma(${bloques[0]},${bloques[1]})`;
  for (let i=2;i<bloques.length;i++){
    s = `suma(${s},${bloques[i]})`;
  }
  return s;
}
function applyTransforms(formula, transforms){
  let f = formula;
  transforms.forEach(t => {
    const v = t.value;
    if (t.op === 'multiplica') f = `multiplica(${f},${v})`;
    else if (t.op === 'divide') f = `divide(${f},${v})`;
    else if (t.op === 'suma') f = `suma(${f},${v})`;
    else if (t.op === 'resta') f = `resta(${f},${v})`;
  });
  return f;
}
function buildConditionsOnFormula(formulaExpr, conditions){
  if (!conditions || conditions.length===0) return formulaExpr;
  //  menor(a,b) etc.
  // SI(cmp1(formula,value1), "textYes1", SI(cmp2(...), "textYes2", ... finalElse))
  let nested = '';
  const n = conditions.length;
  for (let i=0;i<n;i++){
    const c = conditions[i];
    const cmpCall = `${c.cmp}(${formulaExpr},${c.value})`;
    const yes = c.textYes ? `"${escapeQuote(c.textYes)}"` : '""';
    const no = (i===n-1 && c.textNo && c.textNo.trim()!=="") ? `"${escapeQuote(c.textNo)}"` : null;
    if (no !== null){
      nested += `SI(${cmpCall},${yes},${no})`;
    } else {
      nested += `SI(${cmpCall},${yes},`;
    }
  }
  const opens = n - (conditions[n-1].textNo && conditions[n-1].textNo.trim()!=="");
  if (!(conditions[n-1].textNo && conditions[n-1].textNo.trim()!=="")){
    nested += '""' + ')'.repeat(opens);
  }
  return nested;
}

document.addEventListener('DOMContentLoaded', () => {
  // elementos
  const btnConsultar = $('btnConsultar');
  const codigoInp = $('codigo');
  const status = $('status');
  const indicadoresList = $('indicadoresList');
  const generarBtn = $('generar');
  const preview = $('preview');

  const transformsDiv = $('transforms');
  const addTransformSelect = $('addTransformSelect');
  const addTransformValue = $('addTransformValue');
  const addTransformBtn = $('addTransform');

  const condsDiv = $('conds');
  const cmpSelect = $('cmpSelect');
  const cmpValue = $('cmpValue');
  const cmpTextYes = $('cmpTextYes');
  const cmpTextNo = $('cmpTextNo');
  const addCondBtn = $('addCond');

  const btnCopiar = $('btnCopiar');
  const btnExport = $('btnExport');
  const btnLimpiar = $('btnLimpiar');

  let indicadores = []; // API buscando indicadores
  let transforms = [];  // [{op,value}]
  let conditions = [];  // [{cmp,value,textYes,textNo}]
  let selectedCodes = new Set();
  
  // CONSULTAR formulario
  btnConsultar.addEventListener('click', async () => {
    const codigo = codigoInp.value.trim();
    if (!codigo){ alert('Introduce un código.'); return; }
    try {
      status.textContent = 'Cargando...';
      const resp = await fetch(API_URL + codigo);
      if (!resp.ok) {
        alert('Error en el servidor');
        status.textContent = 'Error en servidor';
        return;
      }
      const data = await resp.json();
      // se espera { indicadores: [...] } como el API devolvía
      indicadores = data.indicadores || data || [];
      renderIndicadores();
      status.textContent = `Estado: ${indicadores.length} indicadores cargados`;
    } catch (err){
      console.error(err);
      alert('Error consultando API.');
      status.textContent = 'Error consulta';
    }
  });

function renderIndicadores(){
    selectedCodes = new Set();
    indicadoresList.innerHTML = '';

    indicadores.forEach((ind, idx) => {
        const div = document.createElement('div');
        div.className = 'indicador-item';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.code = ind.codigo;

        cb.addEventListener('change', () => {
            if (cb.checked) selectedCodes.add(ind.codigo);
            else selectedCodes.delete(ind.codigo);
        });

        const label = document.createElement('label');
        label.textContent = ` ${ind.codigo} — ${ind.nombre}`;

        div.appendChild(cb);
        div.appendChild(label);

        indicadoresList.appendChild(div);
    });
}
  function escapeHtml(s){ return String(s || '').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  addTransformBtn.addEventListener('click', () => {
    const op = addTransformSelect.value;
    const v = addTransformValue.value.trim();
    if (!v){ alert('Introduce un valor numérico para la transformacion.'); return; }
    if (isNaN(Number(v))) { alert('Valor debe ser numérico.'); return; }
    transforms.push({op, value: v});
    renderTransforms();
    addTransformValue.value = '';
  });

  function renderTransforms(){
    transformsDiv.innerHTML = '';
    transforms.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = 'titem';
      el.innerHTML = `<div><strong>${t.op}</strong> ${t.value}</div><div><button data-i="${i}">Eliminar</button></div>`;
      transformsDiv.appendChild(el);
      el.querySelector('button').addEventListener('click', () => {
        transforms.splice(i,1);
        renderTransforms();
      });
    });
    if (transforms.length===0) transformsDiv.innerHTML = '<div class="hint">Sin transformaciones</div>';
  }

  // Conditions management
  addCondBtn.addEventListener('click', () => {
    const cmp = cmpSelect.value;
    let val = cmpValue.value.trim();
    const textYes = cmpTextYes.value.trim();
    const textNo = cmpTextNo.value.trim();

    if (val === '') { alert('Introduce un umbral/valor para comparar.'); return; }
    // if numeric-ish keep as number, else quote? we will treat numeric values as numbers, others as quoted strings in builder
    const isNum = !isNaN(Number(val));
    if (!isNum) {
      // add quotes around string values - but builder expects raw token, so we set value to quoted string
      val = `"${escapeQuote(val)}"`;
    } else {
      val = String(Number(val));
    }
    conditions.push({cmp, value: val, textYes, textNo});
    renderConds();
    cmpValue.value = cmpTextYes.value = cmpTextNo.value = '';
  });

  function renderConds(){
    condsDiv.innerHTML = '';
    conditions.forEach((c,i) => {
      const el = document.createElement('div'); el.className = 'citem';
      el.innerHTML = `<div><strong>${c.cmp}</strong> ${c.value} → "${escapeHtml(c.textYes||'')}" ${c.textNo?` / else "${escapeHtml(c.textNo)}"`:''}</div><div><button data-i="${i}">Eliminar</button></div>`;
      condsDiv.appendChild(el);
      el.querySelector('button').addEventListener('click', () => {
        conditions.splice(i,1); renderConds();
      });
    });
    if (conditions.length===0) condsDiv.innerHTML = '<div class="hint">Sin condiciones definidas</div>';
  }

  // build per-indicator expression for sum (numeric)
  function buildValueForSum(ind){
    const IND = `$$${ind.codigo}$$`;
    const tipo = ind.tipo;
    // Entero/Decimal → si(distinto(IND,""), IND, 0)
    if (tipo === 'Entero' || tipo === 'Decimal'){
      return `si(distinto(${IND},""),${IND},0)`;
    }
    // Lista / ListaMultiseleccion: map to numeric via id (we assume id is numeric mapping)
    if (tipo === 'Lista' || tipo === 'ListaMultiseleccion'){
      if (!ind.valores || ind.valores.length===0) return `0`;
      const casos = ind.valores.map(v => {
        const id = v.id;
        // if id not numeric, try to use index+1 fallback
        const idNum = (!isNaN(Number(id)) ? id : (ind.valores.indexOf(v)+1));
        return `${idNum},${idNum}`;
      }).join(',');
      // caso(IND, id1, val1, id2,val2, ...)
      return `caso(${IND},${casos})`;
    }
    // Check: usually "Si"/"No" or 1/0 — try to return numeric if possible; fallback: 0/1 mapping
    if (tipo === 'Check'){
      // return si(distinto(IND,""), str -> but for sum we want numeric; assume values stored as "1"/"0" or similar
      // so: si(distinto(IND,""), ${IND}, 0)
      return `si(distinto(${IND},""),${IND},0)`;
    }

    // Hora/Fecha/Text/Componente -> not numeric: return 0 for sums
    return `0`;
  }

  // Build textual block used when you want textual resumen (not used for numeric SUM)
  function buildTextBlock(ind){
    const IND = `$$${ind.codigo}$$`;
    const texto = (ind.nombre||'').trim();
    const tipo = ind.tipo;
    if (tipo === 'FormulaTexto') return '';
    if (tipo === 'Hora'){
      return `si(distinto(${IND},""), suma("\\n${texto}: ", str(hazhora(hora(${IND}),minuto(${IND})))), "")`;
    }
    if (tipo === 'Fecha' || tipo === 'Texto' || tipo === 'Entero' || tipo === 'Decimal' || tipo === 'Check'){
      return `si(distinto(${IND},""), suma("\\n${texto}: ", str(${IND})), "")`;
    }
    if (tipo === 'Lista' || tipo === 'ListaMultiseleccion'){
      if (!ind.valores || ind.valores.length===0) return '';
      const casos = ind.valores.map(v => `${v.id},"${escapeQuote(v.descripcion)}"`).join(',');
      return `si(distinto(${IND},""), suma("\\n${texto}: ", caso(${IND},${casos})), "")`;
    }
    return '';
  }

  // MAIN: generar fórmula
  generarBtn.addEventListener('click', () => {
    // collect selected indicators (order maintained as in indicadores array)
    const selected = indicadores.filter(ind => selectedCodes.has(ind.codigo));
    if (!selected || selected.length===0){ alert('Selecciona al menos un indicador.'); return; }

    // Build base sum expression (only numeric parts) using buildValueForSum
    const valueExprs = selected.map(s => buildValueForSum(s)).filter(x => x && x.trim()!=='0');
    // If none numeric, fallback: try to include first indicator as numeric str→0? but we'll allow sum of zeros
    const base = (valueExprs.length===0) ? '0' : anidarSuma(valueExprs);

    // Apply transforms
    const fullTransformed = applyTransforms(base, transforms);

    // If user wants to attach textual resumen + condicionals - we focus on conditions over numeric result
    const finalWithConds = buildConditionsOnFormula(fullTransformed, conditions);

    // Put preview
    preview.value = finalWithConds;
  });

  // Copy / Export / Clear
  btnCopiar.addEventListener('click', () => {
    const txt = preview.value || '';
    if (!txt) { alert('Nada que copiar'); return; }
    navigator.clipboard?.writeText(txt).then(()=>alert('Copiado al portapapeles'), ()=>alert('No se pudo copiar'));
  });

  btnExport.addEventListener('click', () => {
    const txt = preview.value || '';
    if (!txt) { alert('Nada para exportar'); return; }
    const blob = new Blob([txt], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'formula.txt'; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 500);
  });

  btnLimpiar.addEventListener('click', () => {
    preview.value = '';
  });

  // initialize UI
  renderTransforms();
  renderConds();
});
// --- SELECT ALL para SUMAS ---
const selectAll = document.getElementById("selectAllSumas");

if (selectAll) {
    selectAll.addEventListener("change", () => {
        const checkboxes = document.querySelectorAll(".indicador-item input[type='checkbox']");
        checkboxes.forEach(cb => cb.checked = selectAll.checked);

        // Actualizar selección interna
        if (selectAll.checked) {
            indicadores.forEach(ind => selectedCodes.add(ind.codigo));
        } else {
            selectedCodes.clear();
        }
    });
}
