// Credenciales válidas (normalizadas)
const USUARIO_VALIDO = "OBJETOSCLINICOS";
const PASSWORD_VALIDA = "Quiron.salud.2026";

// Normaliza texto
function normalizar(v) {
  return (v || "").trim().toUpperCase();
}

function login(usuario, password) {
  const u = normalizar(usuario);
  const p = password || "";

  if (u !== USUARIO_VALIDO || p !== PASSWORD_VALIDA) {
    return false;
  }

  localStorage.setItem("qs_auth", u);
  return true;
}

function logout() {
  localStorage.removeItem("qs_auth");
  window.location.href = "login.html";
}

function checkAuth() {
  return !!localStorage.getItem("qs_auth");
}

function getUsuario() {
  return localStorage.getItem("qs_auth");
}
