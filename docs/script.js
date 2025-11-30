// Connexion GRIST
grist.ready({ requiredAccess: 'full' });

let allRecords = [];
let currentRecordId = null;

// Recevoir les données
grist.onRecords((records) => {
  allRecords = records;
  refreshSearch();
});

// --- OUTIL : extraire les instruments d’une partition ---
function extractInstruments(value) {
  if (!value) return "";

  // string simple
  if (typeof value === "string") return value;

  // lookup simple (objet)
  if (typeof value === "object" && !Array.isArray(value)) {
    if ("instruments" in value) return value.instruments;
    if ("id2" in value) return value.id2;
    if ("name" in value) return value.name;
    return "";
  }

  // liste
  if (Array.isArray(value)) {
    return value
      .map(v => extractInstruments(v))
      .filter(Boolean)
      .join(", ");
  }

  return "";
}

// --- RECHERCHE ---
document.getElementById("search").addEventListener("input", refreshSearch);

function refreshSearch() {
  const q = document.getElementById("search").value.toLowerCase();
  const container = document.getElementById("results");
  container.innerHTML = "";

  if (!q) return;

  const filtered = allRecords.filter(r => {
    const titre = (r.Titre || "").toLowerCase();
    const instr = extractInstruments(r.instruments).toLowerCase();
    return titre.includes(q) || instr.includes(q);
  });

  filtered.forEach(r => {
    const div = document.createElement("div");
    div.className = "result-item";
    div.innerText = `${r.id}. ${r.Titre || "(Sans titre)"} — ${extractInstruments(r.instruments)}`;
    div.onclick = () => showDetails(r);
    container.appendChild(div);
  });
}

// --- AFFICHAGE DES DETAILS ---
function showDetails(record) {
  currentRecordId = record.id;
  document.getElementById("details").classList.remove("hidden");

  document.getElementById("titre").value = record.Titre || "";
  document.getElementById("instrument").value = extractInstruments(record.instruments);
  document.getElementById("site_id").value = record.site_id || "";
  document.getElementById("compositeur_id").value = record.compositeur_id || "";
  document.getElementById("discipline_id").value = record.discipline_id || "";
}

// --- SAUVEGARDE ---
document.getElementById("saveBtn").onclick = () => {

  const update = {
    id: currentRecordId,
    Titre: document.getElementById("titre").value,
    site_id: parseInt(document.getElementById("site_id").value),
    compositeur_id: parseInt(document.getElementById("compositeur_id").value),
    discipline_id: parseInt(document.getElementById("discipline_id").value)
  };

  grist.updateRecord(update)
    .then(() => alert("Modifications enregistrées !"))
    .catch(err => alert("Erreur : " + err));
};
