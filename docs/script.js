//
// Connexion GRIST
//
grist.ready({ requiredAccess: 'full' });

let allRecords = [];
let currentRecordId = null;

//
// Réception de tous les enregistrements
//
grist.onRecords((records) => {
  allRecords = records;
  refreshSearch();
});

//
// Recherche
//
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
    div.innerText = `${r.id}. ${r.Titre || "(Sans titre)"}`;
    div.onclick = () => showDetails(r);
    container.appendChild(div);
  });
}

//
// Affichage détails + édition
//
function showDetails(record) {
  currentRecordId = record.id;
  document.getElementById("details").classList.remove("hidden");

  document.getElementById("titre").value = record.Titre || "";
  document.getElementById("instrument").value = record.instruments || "";
  document.getElementById("site_id").value = record.site_id || "";
  document.getElementById("compositeur_id").value = record.compositeur_id || "";
  document.getElementById("discipline_id").value = record.discipline_id || "";
}

// Ajout safe value pour la colonne formule instrument"
function extractInstruments(value) {
  if (!value) return "";

  // Cas simple : déjà une string
  if (typeof value === "string") return value;

  // Cas 2 : un seul objet (lookup simple)
  if (typeof value === "object" && !Array.isArray(value)) {
    if (value.instruments) return value.instruments;
    if (value.id2) return value.id2;
    if (value.name) return value.name;
    return "";
  }

  // Cas 3 : liste (RecordList)
  if (Array.isArray(value)) {
    return value
      .map(v => extractInstruments(v))
      .filter(v => v)
      .join(", ");
  }

  return "";
}


function safeValue(v) {
  if (!v) return "";
  
  // Si c'est déjà une string
  if (typeof v === "string") return v;
  
  // Si c'est un nombre
  if (typeof v === "number") return String(v);

  // Si c'est un objet Grist (lookup)
  if (typeof v === "object") {
    // Exemple : {id:5, id2:"Piano"}
    // On récupère les champs textuels
    if (v.id2) return safeValue(v.id2);
    if (v.name) return safeValue(v.name);
    if (v.label) return safeValue(v.label);
  }

  return "";
}

//
// Sauvegarde dans GRIST
//
document.getElementById("saveBtn").onclick = () => {

  const update = {
    id: currentRecordId,
    Titre: document.getElementById("titre").value,
    instruments: document.getElementById("instrument").value,
    site_id: parseInt(document.getElementById("site_id").value),
    compositeur_id: parseInt(document.getElementById("compositeur_id").value),
    discipline_id: parseInt(document.getElementById("discipline_id").value)
  };

  grist.updateRecord(update)
    .then(() => alert("Modifications enregistrées !"))
    .catch(err => alert("Erreur : " + err));
};
div.innerText = `${r.id}. ${safeValue(r.Titre)}  —  ${extractInstruments(r.instruments)}`;

