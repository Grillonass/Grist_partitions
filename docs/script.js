// =====================================================
// Partothèque CMDT - Widget externe Grist
// Sidebar filtres + Grid de cartes résultats
// =====================================================

// Connexion à Grist avec accès lecture (on passera en full si on ajoute l'édition)
grist.ready({ requiredAccess: 'read table' });

let allRecords = [];

const dom = {
  search: document.getElementById('search'),
  filterInstrument: document.getElementById('filter-instrument'),
  filterCompo: document.getElementById('filter-compo'),
  filterSite: document.getElementById('filter-site'),
  results: document.getElementById('results'),
};

// ------------------------------
// Helpers
// ------------------------------

// Convertit n'importe quelle valeur Grist en texte affichable
function toText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';

  // Listes (RecordList, etc.)
  if (Array.isArray(value)) {
    return value.map(v => toText(v)).filter(Boolean).join(', ');
  }

  // Objets (lookups)
  if (typeof value === 'object') {
    if ('label' in value) return toText(value.label);
    if ('name' in value) return toText(value.name);
    if ('Titre' in value) return toText(value.Titre);
    // sinon on prend la première valeur "lisible"
    const vals = Object.values(value).map(v => toText(v)).filter(Boolean);
    return vals[0] || '';
  }

  return '';
}

// Construit un ensemble de valeurs uniques pour un champ donné
function buildUniqueValues(records, fieldName) {
  const set = new Set();
  records.forEach(r => {
    const txt = toText(r[fieldName]);
    if (txt) set.add(txt);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
}

// Remplit un <select> avec des options
function fillSelect(selectEl, values) {
  // on garde la première option "Tous"
  selectEl.innerHTML = '<option value="">Tous</option>';
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

// ------------------------------
// Récupération depuis Grist
// ------------------------------
grist.onRecords(records => {
  allRecords = records || [];
  buildFilters();
  renderResults();
});

// ------------------------------
// Filtres
// ------------------------------
function buildFilters() {
  const instruments = buildUniqueValues(allRecords, 'instruments');
  const compositeurs = buildUniqueValues(allRecords, 'Compositeur');
  const sites = buildUniqueValues(allRecords, 'site');

  fillSelect(dom.filterInstrument, instruments);
  fillSelect(dom.filterCompo, compositeurs);
  fillSelect(dom.filterSite, sites);
}

// Ecouteurs sur les filtres + recherche
dom.search.addEventListener('input', renderResults);
dom.filterInstrument.addEventListener('change', renderResults);
dom.filterCompo.addEventListener('change', renderResults);
dom.filterSite.addEventListener('change', renderResults);

// ------------------------------
// Rendu des cartes
// ------------------------------
function renderResults() {
  const q = dom.search.value.trim().toLowerCase();
  const fInstr = dom.filterInstrument.value;
  const fCompo = dom.filterCompo.value;
  const fSite = dom.filterSite.value;

  dom.results.innerHTML = '';

  const filtered = allRecords.filter(r => {
    const titre = toText(r['Titre']);
    const compo = toText(r['Compositeur']);
    const instr = toText(r['instruments']);
    const site = toText(r['site']);
    const disc = toText(r['Disciplines']);
    const notice = toText(r['notice']);
    const cota = toText(r['cotation']);

    // Filtre texte global
    const haystack = (
      titre + ' ' +
      compo + ' ' +
      instr + ' ' +
      disc + ' ' +
      site + ' ' +
      notice + ' ' +
      cota
    ).toLowerCase();

    if (q && !haystack.includes(q)) return false;

    // Filtre instrument
    if (fInstr && instr !== fInstr) return false;

    // Filtre compositeur
    if (fCompo && compo !== fCompo) return false;

    // Filtre site
    if (fSite && site !== fSite) return false;

    return true;
  });

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = 'Aucun résultat pour ces critères.';
    empty.style.color = '#6b7280';
    dom.results.appendChild(empty);
    return;
  }

  filtered.forEach(r => {
    const titre = toText(r['Titre']) || '(Sans titre)';
    const compo = toText(r['Compositeur']);
    const instr = toText(r['instruments']);
    const disc = toText(r['Disciplines']);
    const site = toText(r['site']);
    const nbEx = r['nb_exemplaire'] ?? '';
    const nbDisp = r['nb_disponible'] ?? '';

    const card = document.createElement('div');
    card.className = 'result-card';

    card.innerHTML = `
      <div class="card-icon">🎼</div>
      <div class="card-title">${titre}</div>
      <div class="card-line"><strong>Compositeur :</strong> ${compo || '-'}</div>
      <div class="card-line"><strong>Instruments :</strong> ${instr || '-'}</div>
      <div class="card-line"><strong>Discipline :</strong> ${disc || '-'}</div>
      <div class="card-line"><strong>Exemplaires :</strong> ${nbEx} &nbsp;•&nbsp; <strong>Disponibles :</strong> ${nbDisp}</div>
      <div class="card-line"><strong>Site :</strong> ${site || '-'}</div>
      <div class="card-badge">ID ${r.id}</div>
    `;

    // Plus tard : on pourra ouvrir un panneau détail ou un modal ici
    card.addEventListener('click', () => {
      console.log('Partition cliquée :', r.id, titre);
      // TODO: afficher fiche détaillée / édition
    });

    dom.results.appendChild(card);
  });
}
