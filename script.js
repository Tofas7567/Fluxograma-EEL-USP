/**
 * Fluxograma Interativo – Escola de Engenharia de Lorena (EEL-USP)
 * As grades ficam em data/*.json (geradas por scraper/gerar_grades.py);
 * data/cursos.json é o índice que alimenta o seletor de curso.
 *
 * Formato de cada grade: { nome, periodo, semesters: [{ label, disciplines: [
 *   { id, name, credits, weak: [códigos], strong: [códigos] } ] }] }
 */

let cursos        = [];     // índice plano de cursos
let currentCourse = null;   // grade ativa { name, semesters }
let selectedId    = null;   // disciplina selecionada
let svgArrows     = [];     // setas desenhadas

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

document.addEventListener('DOMContentLoaded', async () => {
  const select = document.getElementById('course-select');
  document.getElementById('btn-clear').addEventListener('click', clearSelection);
  window.addEventListener('scroll', redrawArrows, { passive: true });
  window.addEventListener('resize', () => { if (currentCourse) renderCourse(); });

  try {
    const grupos = await (await fetch('data/cursos.json')).json();
    grupos.forEach(g => {
      const og = document.createElement('optgroup');
      og.label = g.unidade;
      g.cursos.forEach(c => {
        cursos.push(c);
        og.appendChild(new Option(`${c.nome} – ${c.periodo}`, c.id));
      });
      select.appendChild(og);
    });
  } catch (e) {
    return showMessage('Erro', 'Não foi possível carregar data/cursos.json.');
  }

  select.addEventListener('change', () => loadCourse(select.value));
  const pedido = new URLSearchParams(location.search).get('curso');
  const inicial = cursos.some(c => c.id === pedido) ? pedido : cursos[0].id;
  select.value = inicial;
  loadCourse(inicial);
});

// ─────────────────────────────────────────────
// CARREGAMENTO DE UM CURSO
// ─────────────────────────────────────────────
async function loadCourse(id) {
  const curso = cursos.find(c => c.id === id);
  const titulo = `${curso.nome} – ${cap(curso.periodo)}`;
  history.replaceState(null, '', `?curso=${id}`);
  selectedId = null;
  try {
    const resp = await fetch(`data/${curso.arquivo}`);
    if (!resp.ok) throw new Error(resp.status);
    const dados = await resp.json();
    currentCourse = { name: titulo, semesters: dados.semesters };
    renderCourse();
  } catch (e) {
    currentCourse = null;
    showMessage(titulo, 'A grade deste curso ainda não foi gerada. Rode o workflow ' +
      '"Atualizar grades" (aba Actions do GitHub) ou execute python scraper/gerar_grades.py.');
  }
}

function showMessage(titulo, texto) {
  clearArrows();
  document.getElementById('course-title').textContent = titulo;
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'course-hint';
  p.textContent = texto;
  grid.appendChild(p);
}

// ─────────────────────────────────────────────
// RENDERIZAÇÃO DO CURSO
// ─────────────────────────────────────────────
function renderCourse() {
  clearArrows();
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  // Título do curso
  const title = document.getElementById('course-title');
  title.textContent = currentCourse.name;

  currentCourse.semesters.forEach((sem, semIdx) => {
    const col = document.createElement('div');
    col.className = 'semester-col';

    const header = document.createElement('div');
    header.className = 'semester-header';
    header.textContent = sem.label;
    col.appendChild(header);

    sem.disciplines.forEach(disc => {
      const card = document.createElement('div');
      card.className = 'disc-card';
      card.dataset.id = disc.id;

      const codeEl = document.createElement('span');
      codeEl.className = 'disc-code';
      codeEl.textContent = disc.id;

      const nameEl = document.createElement('span');
      nameEl.className = 'disc-name';
      nameEl.textContent = disc.name;

      const credEl = document.createElement('span');
      credEl.className = 'disc-credits';
      credEl.textContent = disc.credits > 0 ? disc.credits + ' cr.' : '';

      card.appendChild(codeEl);
      card.appendChild(nameEl);
      card.appendChild(credEl);

      card.addEventListener('click', () => onCardClick(disc.id));
      col.appendChild(card);
    });

    grid.appendChild(col);
  });

  // Restaura seleção se havia uma
  if (selectedId) {
    const card = document.querySelector(`.disc-card[data-id="${selectedId}"]`);
    if (card) {
      highlightAndDraw(selectedId);
    } else {
      selectedId = null;
    }
  }
}

// ─────────────────────────────────────────────
// CLIQUE EM CARD
// ─────────────────────────────────────────────
function onCardClick(id) {
  if (selectedId === id) {
    clearSelection();
    return;
  }
  clearSelection(false);
  selectedId = id;
  highlightAndDraw(id);
}

// ─────────────────────────────────────────────
// DESTAQUE E DESENHO DE SETAS
// ─────────────────────────────────────────────
function highlightAndDraw(id) {
  const disc = findDisc(id);
  if (!disc) return;

  // Destaca a disciplina selecionada
  const selectedCard = document.querySelector(`.disc-card[data-id="${id}"]`);
  if (selectedCard) selectedCard.classList.add('selected');

  // ─── PRÉ-REQUISITOS (setas entrando) ───
  // Destaca pré-requisitos fracos e desenha setas amarelas
  disc.weak.forEach(reqId => {
    const reqCard = document.querySelector(`.disc-card[data-id="${reqId}"]`);
    if (reqCard) {
      reqCard.classList.add('prereq-weak');
      drawArrow(reqId, id, 'weak');
    }
  });

  // Destaca pré-requisitos fortes e desenha setas vermelhas
  disc.strong.forEach(reqId => {
    const reqCard = document.querySelector(`.disc-card[data-id="${reqId}"]`);
    if (reqCard) {
      reqCard.classList.add('prereq-strong');
      drawArrow(reqId, id, 'strong');
    }
  });

  // ─── DEPENDENTES (setas saindo) ───
  // Busca todas as disciplinas que dependem da selecionada
  const dependents = findDependents(id);
  dependents.forEach(depId => {
    const depCard = document.querySelector(`.disc-card[data-id="${depId}"]`);
    if (depCard) {
      depCard.classList.add('dependent');
      drawArrow(id, depId, 'dependent');
    }
  });
}

// ─────────────────────────────────────────────
// BUSCA DISCIPLINAS DEPENDENTES
// ─────────────────────────────────────────────
function findDependents(id) {
  const dependents = [];
  for (const sem of currentCourse.semesters) {
    for (const d of sem.disciplines) {
      if (d.weak.includes(id) || d.strong.includes(id)) {
        dependents.push(d.id);
      }
    }
  }
  return dependents;
}

// ─────────────────────────────────────────────
// LIMPAR SELEÇÃO
// ─────────────────────────────────────────────
function clearSelection(resetId = true) {
  document.querySelectorAll('.disc-card').forEach(c => {
    c.classList.remove('selected', 'prereq-weak', 'prereq-strong', 'dependent');
  });
  clearArrows();
  if (resetId) selectedId = null;
}

// ─────────────────────────────────────────────
// BUSCA DISCIPLINA NO CURSO ATUAL
// ─────────────────────────────────────────────
function findDisc(id) {
  for (const sem of currentCourse.semesters) {
    for (const d of sem.disciplines) {
      if (d.id === id) return d;
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// DESENHO DE SETAS SVG
// ─────────────────────────────────────────────
function drawArrow(fromId, toId, type) {
  const fromCard = document.querySelector(`.disc-card[data-id="${fromId}"]`);
  const toCard   = document.querySelector(`.disc-card[data-id="${toId}"]`);
  if (!fromCard || !toCard) return;

  const svg = document.getElementById('arrows-svg');

  const fromRect = fromCard.getBoundingClientRect();
  const toRect   = toCard.getBoundingClientRect();
  const svgRect  = svg.getBoundingClientRect();

  // Pontos de saída e chegada: centro direito → centro esquerdo
  // Se a disciplina de destino está à esquerda (semestre anterior), inverte
  let x1, y1, x2, y2;

  const fromCenterX = fromRect.left + fromRect.width / 2  - svgRect.left;
  const fromCenterY = fromRect.top  + fromRect.height / 2 - svgRect.top;
  const toCenterX   = toRect.left   + toRect.width / 2    - svgRect.left;
  const toCenterY   = toRect.top    + toRect.height / 2   - svgRect.top;

  if (fromCenterX <= toCenterX) {
    // from está à esquerda: sai pela direita, entra pela esquerda
    x1 = fromRect.right  - svgRect.left;
    y1 = fromCenterY;
    x2 = toRect.left     - svgRect.left;
    y2 = toCenterY;
  } else {
    // from está à direita: sai pela esquerda, entra pela direita
    x1 = fromRect.left   - svgRect.left;
    y1 = fromCenterY;
    x2 = toRect.right    - svgRect.left;
    y2 = toCenterY;
  }

  // Curva de Bezier para suavizar o traçado
  const dx = Math.abs(x2 - x1);
  const cx1 = x1 + dx * 0.5;
  const cx2 = x2 - dx * 0.5;

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`);
  
  // Define classe baseado no tipo
  if (type === 'weak') {
    path.setAttribute('class', 'arrow-weak');
    path.setAttribute('marker-end', 'url(#arrowhead-weak)');
  } else if (type === 'strong') {
    path.setAttribute('class', 'arrow-strong');
    path.setAttribute('marker-end', 'url(#arrowhead-strong)');
  } else if (type === 'dependent') {
    path.setAttribute('class', 'arrow-dependent');
    path.setAttribute('marker-end', 'url(#arrowhead-dependent)');
  }

  svg.appendChild(path);
  svgArrows.push(path);
}

// ─────────────────────────────────────────────
// REDRAW SETAS (scroll / resize)
// ─────────────────────────────────────────────
function redrawArrows() {
  if (!selectedId) return;
  clearArrows();
  highlightAndDraw(selectedId);
}

// ─────────────────────────────────────────────
// LIMPAR SETAS
// ─────────────────────────────────────────────
function clearArrows() {
  svgArrows.forEach(el => el.parentNode && el.parentNode.removeChild(el));
  svgArrows = [];
}
