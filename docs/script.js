grist.ready({
  requiredAccess: 'full',     // autorise lecture + écriture
  columns: [],                // toutes les colonnes
});

grist.onRecords(function (records) {
  partitions = records;
  renderResults();
});

// =======================================================
//  PARTOTHEQUE CMDT - JS pour widget personnalisé Grist
// =======================================================

// On reste en "var" pour éviter les doublons lors des rechargements.
var partitions = [];
var lookups = {};          // id -> libellé pour chaque table liée
var lookupLabelMaps = {};  // libellé (lowercase) -> id pour chaque table liée
var selectedPartition = null;
var partitionColumns = [];
var tableId = null;        // <- ID réel de la table Grist (donné par onRecords)

// Colonnes de "partitions" qui sont des références vers d'autres tables
// clé = nom de la colonne dans partitions
// valeur = nom de la table liée
var partitionLookupColumns = {
  instruments:   'instruments',
  compositeur_id:'compositeurs',
  discipline_id: 'disciplines',
  site_id:       'sites',
  fond_id:       'fonds',
  editeur_id:    'editeurs',
  status_id:     'statuts'
};

// Pour chaque table liée, on précise la colonne "libellé"
var lookupLabelConfig = {
  instruments:   { table: 'instruments',  labelCol: 'libelle' },
  sites:         { table: 'sites',        labelCol: 'libelle' },
  fonds:         { table: 'fonds',        labelCol: 'libelle' },
  editeurs:      { table: 'editeurs',     labelCol: 'nom' },
  statuts:       { table: 'statuts',      labelCol: 'libelle' },
  disciplines:   { table: 'disciplines',  labelCol: 'libelle' },
  compositeurs:  { table: 'compositeurs', labelCol: 'nom' }
};

// -------------------------------------------------------------------
// 1) RÉCEPTION DES ENREGISTREMENTS DE LA TABLE COURANTE
// -------------------------------------------------------------------
// Grist nous donne : records + meta (dont meta.tableId)
grist.onRecords(function(records, tableMeta) {
  partitions = records || [];

  // ID réel de la table (très important pour les écritures)
  if (tableMeta && tableMeta.tableId) {
    tableId = tableMeta.tableId;
  }

  // Colonnes disponibles
  if (!partitionColumns.length && partitions.length) {
    partitionColumns = Object.keys(partitions[0]);
  }

  renderResults();
});

// ------------------------
// Outils : format Grist → objets
// (utilisé pour les tables de lookup uniquement)
// ------------------------
function convertGrist(table) {
  if (!table) return [];
  var cols = Object.keys(table);
  if (!cols.length) return [];
  var rowCount = table[cols[0]].length;
  var records = [];
  for (var i = 0; i < rowCount; i++) {
    var obj = {};
    cols.forEach(function(col) {
      obj[col] = table[col][i];
    });
    records.push(obj);
  }
  return records;
}

// ------------------------
// Chargement des tables liées
// ------------------------
async function loadLookup(tableName, labelCol) {
  try {
    var t = await grist.docApi.fetchTable(tableName);
    var rows = convertGrist(t);

    var mapIdToLabel = new Map();
    var mapLabelToId = new Map();

    rows.forEach(function(r) {
      var id = r.id;
      var label = r[labelCol] || ('#' + id);
      mapIdToLabel.set(id, label);
      if (r[labelCol]) {
        mapLabelToId.set(String(r[labelCol]).toLowerCase(), id);
      }
    });

    lookups[tableName] = mapIdToLabel;
    lookupLabelMaps[tableName] = {
      table: tableName,
      labelCol: labelCol,
      byLabel: mapLabelToId
    };

    return mapIdToLabel;
  } catch (e) {
    console.error('Erreur lookup ' + tableName, e);
    lookups[tableName] = new Map();
    lookupLabelMaps[tableName] = {
      table: tableName,
      labelCol: labelCol,
      byLabel: new Map()
    };
    return new Map();
  }
}

function resolveLookup(tableName, id) {
  var map = lookups[tableName];
  if (!map || id == null) return '';
  return map.get(id) || '';
}

// ------------------------
// Initialisation Grist
// ------------------------
grist.ready().then(async function() {
  // On charge uniquement les tables liées.
  // Les partitions arriveront via grist.onRecords.
  await loadLookup('instruments',  'libelle');
  await loadLookup('sites',        'libelle');
  await loadLookup('fonds',        'libelle');
  await loadLookup('editeurs',     'nom');
  await loadLookup('statuts',      'libelle');
  await loadLookup('disciplines',  'libelle');
  await loadLookup('compositeurs', 'nom');

}).catch(function(e) {
  console.error('Erreur init Grist', e);
});

// ------------------------
// Recherche
// ------------------------
function handleSearch(ev) {
  renderResults();
}

function renderResults() {
  var input = document.getElementById('searchInput');
  var q = (input && input.value ? input.value : '')
    .toString()
    .toLowerCase()
    .trim();

  var container = document.getElementById('resultsContainer');
  if (!container) return;
  container.innerHTML = '';

  var list = partitions.filter(function(p) {
    if (!q) return true; // pas de filtre

    var champs = [
      p.Titre,
      p.Compositeur,
      resolveLookup('compositeurs', p.compositeur_id),
      resolveLookup('instruments',  p.instruments),
      p.Disciplines,
      resolveLookup('disciplines',  p.discipline_id),
      p.site,
      resolveLookup('sites',        p.site_id),
      p.notice,
      p.numero,
      p.cotation
    ];

    return champs.some(function(v) {
      if (v == null) return false;
      return v.toString().toLowerCase().includes(q);
    });
  });

  if (!list.length) {
    container.innerHTML =
      '<div style="color:#777;font-style:italic;">Aucun résultat pour « ' +
      q +
      ' »</div>';
    return;
  }

  list.forEach(function(p) {
    var card = document.createElement('div');
    card.className = 'result-card';
    card.onclick = function() { openModal(p); };

    var titre = p.Titre || '(Sans titre)';
    var comp  = p.Compositeur || resolveLookup('compositeurs', p.compositeur_id) || '-';
    var instr = resolveLookup('instruments', p.instruments) || p.instruments || '-';
    var disc  = p.Disciplines || resolveLookup('disciplines', p.discipline_id) || '-';
    var site  = p.site || resolveLookup('sites', p.site_id) || '-';
    var nbEx  = p.nb_exemplaire || 0;
    var nbDis = p.nb_disponible || 0;

    card.innerHTML =
      '<div class="card-title">' + escapeHtml(titre) + '</div>' +
      '<div class="card-line"><b>Compositeur :</b> ' + escapeHtml(comp) + '</div>' +
      '<div class="card-line"><b>Instrument :</b> ' + escapeHtml(instr) + '</div>' +
      '<div class="card-line"><b>Discipline :</b> ' + escapeHtml(disc) + '</div>' +
      '<div class="card-line"><b>Site :</b> ' + escapeHtml(site) + '</div>' +
      '<div class="card-line"><b>Exemplaires :</b> ' + nbEx +
      ' / disponibles ' + nbDis + '</div>';

    container.appendChild(card);
  });
}

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ------------------------
// Modal simple (lecture / édition)
// ------------------------
function openModal(p) {
  selectedPartition = p;
  var modal = document.getElementById('partitionModal');
  var box = document.getElementById('modalFields');
  if (!modal || !box) return;

  box.innerHTML = '';

  Object.keys(p).forEach(function(col) {
    // 1) On cache l'id et tous les champs *_id
    if (col === 'id' || col.endsWith('_id')) {
      return;
    }

    box.innerHTML +=
      '<div class="modal-field">' +
        '<label>' + col + '</label>' +
        '<input id="edit_' + col + '" value="' +
        (p[col] == null ? '' : String(p[col]).replace(/"/g,'&quot;')) +
        '">' +
      '</div>';
  });

  modal.style.display = 'block';
}

function closeModal() {
  var modal = document.getElementById('partitionModal');
  if (modal) modal.style.display = 'none';
  selectedPartition = null;
}

// ------------------------
// Sauvegarde / suppression (édition)
// ------------------------
async function savePartition() {
  if (!selectedPartition) return;
  if (!tableId) {
    console.error('TableId inconnu, impossible de sauvegarder.');
    alert("Erreur interne : tableId inconnu (voir console).");
    return;
  }

  var updateObj = {};

  Object.keys(selectedPartition).forEach(function(col) {
    // On ne touche pas aux colonnes id / *_id
    if (col === 'id' || col.endsWith('_id')) {
      return;
    }
    var input = document.getElementById('edit_' + col);
    if (input) {
      updateObj[col] = input.value;
    }
  });

  try {
    await grist.docApi.applyUserActions([
      ['UpdateRecord', tableId, selectedPartition.id, updateObj]
    ]);
    closeModal();

    // Rechargement de la table courante
    var refreshed = await grist.docApi.fetchTable(tableId);
    partitions = convertGrist(refreshed);
    renderResults();
  } catch (e) {
    console.error('Erreur savePartition', e);
    alert('Erreur lors de la sauvegarde (voir console).');
  }
}

async function deletePartition() {
  if (!selectedPartition) return;
  if (!tableId) {
    console.error('TableId inconnu, impossible de supprimer.');
    alert("Erreur interne : tableId inconnu (voir console).");
    return;
  }
  if (!confirm('Supprimer cette partition ?')) return;

  try {
    await grist.docApi.applyUserActions([
      ['RemoveRecord', tableId, selectedPartition.id]
    ]);
    closeModal();
    var refreshed = await grist.docApi.fetchTable(tableId);
    partitions = convertGrist(refreshed);
    renderResults();
  } catch (e) {
    console.error('Erreur deletePartition', e);
    alert('Erreur lors de la suppression (voir console).');
  }
}

// =======================================================
//            AJOUT D'UNE NOUVELLE PARTITION
// =======================================================

// Construire un <datalist> pour une table liée
function buildDatalistHtml(listId, tableName) {
  var map = lookups[tableName];
  if (!map) return '<datalist id="' + listId + '"></datalist>';

  var html = '<datalist id="' + listId + '">';
  map.forEach(function(label) {
    html += '<option value="' + escapeHtml(label) + '"></option>';
  });
  html += '</datalist>';
  return html;
}

// Ouvrir le modal d'ajout
function openAddModal() {
  var modal = document.getElementById('addPartitionModal');
  var box = document.getElementById('addModalFields');
  if (!modal || !box) return;

  box.innerHTML = '';

  if (!partitionColumns.length && partitions.length) {
    partitionColumns = Object.keys(partitions[0]);
  }

  var cols = partitionColumns.slice();

  // On enlève l'id (clé primaire)
  cols = cols.filter(function(c) { return c !== 'id'; });

  cols.forEach(function(col) {
    var isLookup = !!partitionLookupColumns[col];
    var html = '';

    if (isLookup) {
      var tableKey = partitionLookupColumns[col];
      var listId = 'list_' + col;
      html =
        '<div class="modal-field">' +
          '<label>' + col + ' (sélection ou nouvelle valeur)</label>' +
          '<input id="new_' + col + '_label" list="' + listId + '">' +
          buildDatalistHtml(listId, tableKey) +
        '</div>';
    } else {
      html =
        '<div class="modal-field">' +
          '<label>' + col + '</label>' +
          '<input id="new_' + col + '">' +
        '</div>';
    }

    box.innerHTML += html;
  });

  modal.style.display = 'block';
}

function closeAddModal() {
  var modal = document.getElementById('addPartitionModal');
  if (modal) modal.style.display = 'none';
}

// Assure qu'un libellé existe dans une table liée, sinon le crée
async function ensureLookupId(tableKey, label) {
  if (!label) return null;
  label = String(label).trim();
  if (!label) return null;

  var meta = lookupLabelMaps[tableKey];
  if (!meta) return null;

  var lower = label.toLowerCase();
  var existingId = meta.byLabel.get(lower);
  if (existingId) {
    return existingId;
  }

  var cfg = lookupLabelConfig[tableKey];
  if (!cfg) return null;

  var obj = {};
  obj[cfg.labelCol] = label;

  try {
    await grist.docApi.applyUserActions([
      ['AddRecord', cfg.table, null, obj]
    ]);

    // Recharger cette table de lookup pour mettre à jour les maps
    await loadLookup(cfg.table, cfg.labelCol);

    meta = lookupLabelMaps[tableKey];
    return meta.byLabel.get(lower) || null;
  } catch (e) {
    console.error('Erreur ensureLookupId pour ' + tableKey, e);
    return null;
  }
}

// Sauvegarde de la nouvelle partition
async function saveNewPartition() {
  if (!tableId) {
    console.error('TableId inconnu, impossible de créer.');
    alert("Erreur interne : tableId inconnu (voir console).");
    return;
  }

  if (!partitionColumns.length && partitions.length) {
    partitionColumns = Object.keys(partitions[0]);
  }

  var cols = partitionColumns.slice();
  cols = cols.filter(function(c) { return c !== 'id'; });

  var newRecord = {};

  // 1. champs simples
  cols.forEach(function(col) {
    if (partitionLookupColumns[col]) return; // géré plus bas

    var input = document.getElementById('new_' + col);
    if (input && input.value !== '') {
      newRecord[col] = input.value;
    }
  });

  // 2. champs de référence (lookups)
  for (var col in partitionLookupColumns) {
    if (cols.indexOf(col) === -1) continue;
    var tableKey = partitionLookupColumns[col];
    var inputLookup = document.getElementById('new_' + col + '_label');
    var label = inputLookup ? inputLookup.value : '';
    var id = await ensureLookupId(tableKey, label);
    if (id != null) {
      newRecord[col] = id;
    }
  }

  try {
    await grist.docApi.applyUserActions([
      ['AddRecord', tableId, null, newRecord]
    ]);

    closeAddModal();
    var refreshed = await grist.docApi.fetchTable(tableId);
    partitions = convertGrist(refreshed);
    renderResults();
  } catch (e) {
    console.error('Erreur saveNewPartition', e);
    alert('Erreur lors de la création (voir console).');
  }
}

// ------------------------
// Exposer au HTML
// ------------------------
window.handleSearch     = handleSearch;
window.openModal        = openModal;
window.closeModal       = closeModal;
window.savePartition    = savePartition;
window.deletePartition  = deletePartition;

window.openAddModal     = openAddModal;
window.closeAddModal    = closeAddModal;
window.saveNewPartition = saveNewPartition;

