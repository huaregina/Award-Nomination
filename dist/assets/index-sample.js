const csvUrl = '/Award-Nomination/assets/nomination_with_reason-LtrSLgiq.csv';
const storageKey = 'award-assessment-responses-v1';

const questions = [
  'Did the nomination describe how this candidate meets or exceeds the expectations for excellence outlined in the category for which they are nominated?',
  'Did the nomination provide specific examples of how this candidate has contributed to, or led, the achievement of specific outcomes or improvements?',
  'Did the nomination show meaningful impact on patients, families, staff, the organization, or the broader community?',
  'Did the nomination clearly demonstrate leadership, initiative, collaboration, or innovation relevant to the category?',
  'Overall, how strongly does this nomination support recognition of this candidate in this category?'
];

let categories = [];
let responses = loadResponses();
let selectedCategoryId = '';
let selectedNomineeId = '';
let selectedReasonPage = 0;

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows.map((cells) =>
    headers.reduce((record, header, index) => {
      record[header] = cells[index] || '';
      return record;
    }, {})
  );
}

function buildCategories(rows) {
  const grouped = {};

  rows.forEach((row) => {
    const category = String(row.Category || '').trim();
    const name = String(row['Hide Name'] || row.Name || '').trim();
    const department = String(row.Department || '').trim();
    const reason = String(row['Nomination Reason'] || '').trim();
    if (!category || !name) return;

    grouped[category] ||= {};
    const nomineeId = slugify(`${category}-${name}`);
    grouped[category][nomineeId] ||= {
      id: nomineeId,
      name,
      department: department || 'Sample Department',
      reasons: []
    };
    if (reason) grouped[category][nomineeId].reasons.push(...splitReasons(reason));
  });

  return Object.entries(grouped).map(([name, nominees]) => ({
    id: slugify(name),
    name,
    nominees: Object.values(nominees)
  }));
}

function splitReasons(text) {
  const parts = text
    .replace(/\r\n/g, '\n')
    .split(/(?:^|\n)\s*(?=\d+\.\s)/)
    .map((part) => part.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean);
  return parts.length ? parts : [text];
}

function loadResponses() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || '{}');
  } catch {
    return {};
  }
}

function saveResponses() {
  localStorage.setItem(storageKey, JSON.stringify(responses));
}

function isComplete(categoryId, nomineeId) {
  const scores = responses[categoryId]?.[nomineeId] || {};
  return questions.every((_, index) => typeof scores[index] === 'number');
}

function completedCount() {
  return categories.reduce(
    (count, category) => count + category.nominees.filter((nominee) => isComplete(category.id, nominee.id)).length,
    0
  );
}

function render() {
  const root = document.getElementById('root');
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
  const selectedNominee = selectedCategory?.nominees.find((nominee) => nominee.id === selectedNomineeId);
  const scores = responses[selectedCategoryId]?.[selectedNomineeId] || {};

  root.innerHTML = `
    <main class="min-h-screen bg-slate-950 text-white p-6 md:p-10">
      <section class="mx-auto max-w-6xl space-y-6">
        <div class="rounded-2xl border border-slate-700 bg-slate-900 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="text-sm text-slate-300">Completed results ready to submit: <span class="font-semibold text-amber-300">${completedCount()}</span></div>
          <button id="submit-results" class="rounded-xl border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-100">Submit Results</button>
        </div>
        ${
          selectedCategory
            ? renderCategory(selectedCategory, selectedNominee, scores)
            : renderCategoryGrid()
        }
      </section>
      ${renderNotice()}
    </main>
  `;

  bindEvents();
}

function renderNotice() {
  return `
    <div id="notice" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div class="w-full max-w-lg rounded-2xl border border-amber-400/50 bg-slate-950 p-6 text-slate-100 shadow-2xl">
        <div class="inline-flex rounded-full border border-amber-400/50 bg-amber-400/10 px-3 py-1 text-sm font-semibold text-amber-200">Award nomination update</div>
        <h1 class="mt-4 text-2xl font-bold">The 2026 award nomination is ended</h1>
        <p class="mt-3 leading-7 text-slate-300">This data has been changed to sample data for future reference.</p>
        <p class="mt-3 leading-7 text-slate-300">The website remains available so past nomination review workflows can be referenced without exposing the original 2026 nomination data.</p>
        <div class="mt-5 flex justify-end">
          <button id="close-notice" class="rounded-xl border border-amber-400 px-5 py-2 text-sm font-semibold text-amber-100">Close</button>
        </div>
      </div>
    </div>
  `;
}

function renderCategoryGrid() {
  return `
    <div class="space-y-8">
      <div class="text-center">
        <h1 class="text-3xl md:text-4xl font-bold text-amber-300">Award Assessment</h1>
        <p class="mt-2 text-slate-300 text-lg">Select a category to evaluate nominees</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        ${categories
          .map((category) => {
            const rated = category.nominees.filter((nominee) => isComplete(category.id, nominee.id)).length;
            return `
              <button class="category-card rounded-2xl border border-slate-700 bg-slate-900 p-6 min-h-40 text-center hover:border-amber-400" data-category="${category.id}">
                <div class="text-xl font-semibold">${category.name}</div>
                <div class="mt-3 text-sm text-slate-400">${rated} of ${category.nominees.length} nominees rated</div>
              </button>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}

function renderCategory(category, nominee, scores) {
  return `
    <div class="space-y-6">
      <button id="back" class="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200">Back</button>
      <div>
        <h1 class="text-3xl font-bold text-amber-300">${category.name}</h1>
        <p class="mt-1 text-slate-400">${category.nominees.filter((item) => isComplete(category.id, item.id)).length} of ${category.nominees.length} nominees rated</p>
      </div>
      <div class="flex flex-wrap gap-3">
        ${category.nominees
          .map(
            (item) => `
              <button class="nominee-button rounded-xl border px-4 py-3 text-sm font-semibold ${
                item.id === selectedNomineeId ? 'border-amber-400 text-amber-100' : 'border-slate-600 text-slate-300'
              }" data-nominee="${item.id}">
                ${item.name}${isComplete(category.id, item.id) ? ' - Complete' : ''}
              </button>
            `
          )
          .join('')}
      </div>
      ${nominee ? renderNominee(category, nominee, scores) : ''}
    </div>
  `;
}

function renderNominee(category, nominee, scores) {
  const reasons = nominee.reasons.length ? nominee.reasons : ['No nomination reason available for this nominee.'];
  selectedReasonPage = Math.min(selectedReasonPage, reasons.length - 1);

  return `
    <article class="space-y-5">
      <div class="rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <h2 class="text-2xl font-bold">${nominee.name}</h2>
        <p class="text-slate-400">${nominee.department}</p>
      </div>
      <div class="rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-xl font-bold text-amber-300">Read Nomination</h3>
          <div class="flex gap-2">
            <button class="page-button rounded-lg border border-slate-600 px-3 py-1 text-sm" data-page="-1">Previous</button>
            <button class="page-button rounded-lg border border-slate-600 px-3 py-1 text-sm" data-page="1">Next</button>
          </div>
        </div>
        <p class="mt-2 text-sm text-slate-400">Page ${selectedReasonPage + 1} of ${reasons.length}</p>
        <p class="mt-4 whitespace-pre-wrap rounded-xl bg-slate-950 p-4 leading-8">${reasons[selectedReasonPage]}</p>
      </div>
      <div class="space-y-4">
        ${questions
          .map(
            (question, index) => `
              <div class="rounded-2xl border border-slate-700 bg-slate-900 p-5">
                <p class="text-lg font-semibold">${index + 1}. ${question}</p>
                <div class="mt-4 grid grid-cols-4 gap-2">
                  ${[1, 2, 3, 4]
                    .map(
                      (score) => `
                        <button class="score-button rounded-xl border px-3 py-4 font-bold ${
                          scores[index] === score ? 'border-amber-400 bg-amber-400/10 text-white' : 'border-slate-600 text-slate-300'
                        }" data-question="${index}" data-score="${score}">${score}</button>
                      `
                    )
                    .join('')}
                </div>
              </div>
            `
          )
          .join('')}
      </div>
    </article>
  `;
}

function bindEvents() {
  document.getElementById('close-notice')?.addEventListener('click', () => {
    document.getElementById('notice')?.remove();
  });

  document.querySelectorAll('.category-card').forEach((button) => {
    button.addEventListener('click', () => {
      selectedCategoryId = button.dataset.category;
      const category = categories.find((item) => item.id === selectedCategoryId);
      selectedNomineeId = category?.nominees[0]?.id || '';
      selectedReasonPage = 0;
      render();
    });
  });

  document.getElementById('back')?.addEventListener('click', () => {
    selectedCategoryId = '';
    selectedNomineeId = '';
    render();
  });

  document.querySelectorAll('.nominee-button').forEach((button) => {
    button.addEventListener('click', () => {
      selectedNomineeId = button.dataset.nominee;
      selectedReasonPage = 0;
      render();
    });
  });

  document.querySelectorAll('.page-button').forEach((button) => {
    button.addEventListener('click', () => {
      const category = categories.find((item) => item.id === selectedCategoryId);
      const nominee = category?.nominees.find((item) => item.id === selectedNomineeId);
      const pageCount = Math.max(1, nominee?.reasons.length || 1);
      selectedReasonPage = Math.max(0, Math.min(pageCount - 1, selectedReasonPage + Number(button.dataset.page)));
      render();
    });
  });

  document.querySelectorAll('.score-button').forEach((button) => {
    button.addEventListener('click', () => {
      responses[selectedCategoryId] ||= {};
      responses[selectedCategoryId][selectedNomineeId] ||= {};
      responses[selectedCategoryId][selectedNomineeId][button.dataset.question] = Number(button.dataset.score);
      saveResponses();
      render();
    });
  });

  document.getElementById('submit-results')?.addEventListener('click', () => {
    alert('The 2026 award nomination is ended. This sample-data site is available for future reference only.');
  });
}

fetch(csvUrl)
  .then((response) => response.text())
  .then((text) => {
    categories = buildCategories(parseCsv(text));
    render();
  })
  .catch(() => {
    categories = [];
    document.getElementById('root').innerHTML = '<main class="min-h-screen bg-slate-950 p-6 text-white">Sample nomination data could not be loaded.</main>';
  });
