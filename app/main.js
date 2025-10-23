import { calculateSizing } from './calculators.js';

const STORAGE_KEY = 'fabric-sizer-inputs-v2';

const TOTAL_HOST_OPTIONS = [16, 32, 128, 256, 512, 1024, 32768, 131072];
const HOSTS_PER_POD_OPTIONS = [0, 8, 16, 32, 64, 128, 256];
const SWITCH_RADIX_OPTIONS = [32, 64, 128];

const METADATA_LABELS = {
  pods: 'Pods required',
  leavesPerPod: 'Leaves per pod',
  hostsPerLeaf: 'Hosts per leaf',
  spinesPerPod: 'Spines per pod',
  groups: 'Groups required',
  leavesPerGroup: 'Leaves per group',
  spinesPerGroup: 'Spines per group',
  planeCount: 'Planes',
  leavesPerPlane: 'Leaves per plane',
  spinesPerPlane: 'Spines per plane',
  totalLeaves: 'Total leaves',
  totalSpines: 'Total spines',
};

const defaultState = {
  totalHosts: 1024,
  hostsPerPod: 256,
  switchRadix: 32,
  topology: 'clos3',
};

let state = loadInitialState();
let latestResult = null;
let isSyncing = false;

const elements = {
  totalHosts: document.getElementById('totalHosts'),
  hostsPerPod: document.getElementById('hostsPerPod'),
  switchRadix: document.getElementById('switchRadix'),
  topologyRadios: Array.from(document.querySelectorAll('input[name="topology"]')),
  validationMessage: document.getElementById('validationMessage'),
  copyButton: document.getElementById('copyButton'),
  leavesCount: document.getElementById('leavesCount'),
  spinesCount: document.getElementById('spinesCount'),
  superSpinesCount: document.getElementById('superSpinesCount'),
  totalSwitches: document.getElementById('totalSwitches'),
  podDetails: document.getElementById('podDetails'),
  assumptionsList: document.getElementById('assumptionsList'),
  resultSuper: document.querySelector('[data-role="resultSuper"]'),
};

function populateSelect(select, options, formatter) {
  select.innerHTML = '';
  options.forEach((value) => {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = formatter ? formatter(value) : value.toLocaleString('en-US');
    select.appendChild(option);
  });
}

function loadInitialState() {
  const clone = { ...defaultState };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return clone;
    const parsed = JSON.parse(stored);
    return { ...clone, ...parsed };
  } catch (error) {
    console.warn('Failed to load stored inputs', error);
    return clone;
  }
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Unable to persist state', error);
  }
}

function updateState(key, value) {
  if (isSyncing) return;
  state = { ...state, [key]: value };
  persistState();
  recalculate();
}

function applyStateToInputs() {
  isSyncing = true;
  elements.totalHosts.value = String(state.totalHosts);
  elements.hostsPerPod.value = String(state.hostsPerPod);
  elements.switchRadix.value = String(state.switchRadix);
  elements.topologyRadios.forEach((radio) => {
    radio.checked = radio.value === state.topology;
  });
  isSyncing = false;
  toggleSuperVisibility();
}

function toggleSuperVisibility() {
  if (!elements.resultSuper) return;
  const show = state.topology === 'clos5';
  elements.resultSuper.style.display = show ? 'block' : 'none';
}

function buildPayload() {
  return {
    totalHosts: state.totalHosts,
    hostsPerPod: state.hostsPerPod,
    switchRadix: state.switchRadix,
    topology: state.topology,
  };
}

function validateState() {
  if (!TOTAL_HOST_OPTIONS.includes(state.totalHosts)) {
    throw new Error('Select a supported total host count.');
  }
  if (!HOSTS_PER_POD_OPTIONS.includes(state.hostsPerPod)) {
    throw new Error('Select a supported hosts per pod value.');
  }
  if (!SWITCH_RADIX_OPTIONS.includes(state.switchRadix)) {
    throw new Error('Select a supported switch radix.');
  }
}

function recalculate() {
  try {
    validateState();
  } catch (error) {
    showValidationMessage(error.message);
    clearResults();
    latestResult = null;
    elements.copyButton.disabled = true;
    return;
  }

  let result;
  try {
    result = calculateSizing(buildPayload());
  } catch (error) {
    showValidationMessage(error.message || 'Unable to compute sizing for the provided inputs.');
    clearResults();
    latestResult = null;
    elements.copyButton.disabled = true;
    return;
  }

  latestResult = result;
  elements.copyButton.disabled = false;
  elements.validationMessage.classList.add('hidden');
  updateResults(result);
  persistState();
}

function showValidationMessage(message) {
  elements.validationMessage.textContent = message;
  elements.validationMessage.classList.remove('hidden');
}

function clearResults() {
  const fields = [elements.leavesCount, elements.spinesCount, elements.superSpinesCount, elements.totalSwitches];
  fields.forEach((field) => {
    if (field) field.textContent = '-';
  });
  if (elements.resultSuper) {
    elements.resultSuper.style.display = state.topology === 'clos5' ? 'block' : 'none';
  }
  elements.podDetails.innerHTML = '';
  elements.assumptionsList.innerHTML = '';
}

function updateResults(result) {
  elements.leavesCount.textContent = formatNumber(result.switchCounts.leaves);
  elements.spinesCount.textContent = formatNumber(result.switchCounts.spines);
  if (result.switchCounts.superSpines !== undefined) {
    elements.superSpinesCount.textContent = formatNumber(result.switchCounts.superSpines);
    if (elements.resultSuper) {
      elements.resultSuper.style.display = 'block';
    }
  } else if (elements.resultSuper) {
    elements.resultSuper.style.display = 'none';
  }
  elements.totalSwitches.textContent = formatNumber(result.switchCounts.total);

  renderBreakdown(result.metadata || {});
  renderAssumptions(result.assumptions || []);
}

function renderBreakdown(metadata) {
  const lines = [];
  Object.entries(METADATA_LABELS).forEach(([key, label]) => {
    if (metadata[key] !== undefined) {
      lines.push(`<p>${label}: ${formatNumber(metadata[key])}</p>`);
    }
  });
  elements.podDetails.innerHTML = lines.join('');
}

function renderAssumptions(assumptions) {
  if (!Array.isArray(assumptions) || assumptions.length === 0) {
    elements.assumptionsList.innerHTML = '';
    return;
  }
  elements.assumptionsList.innerHTML = assumptions
    .map((entry) => `<li><strong>${entry.label}:</strong> ${entry.description}</li>`)
    .join('');
}

function formatNumber(value) {
  const formatter = Intl.NumberFormat('en-US');
  return formatter.format(value ?? 0);
}

function attachEventListeners() {
  elements.totalHosts.addEventListener('change', (event) => {
    updateState('totalHosts', Number(event.target.value));
  });
  elements.hostsPerPod.addEventListener('change', (event) => {
    updateState('hostsPerPod', Number(event.target.value));
  });
  elements.switchRadix.addEventListener('change', (event) => {
    updateState('switchRadix', Number(event.target.value));
  });
  elements.topologyRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      state = { ...state, topology: radio.value };
      toggleSuperVisibility();
      persistState();
      recalculate();
    });
  });
  elements.copyButton.addEventListener('click', async () => {
    if (!latestResult) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(latestResult, null, 2));
      const original = elements.copyButton.textContent;
      elements.copyButton.textContent = 'Copied!';
      setTimeout(() => {
        elements.copyButton.textContent = original;
      }, 1500);
    } catch (error) {
      elements.copyButton.textContent = 'Copy failed';
      console.warn('Clipboard copy failed', error);
      setTimeout(() => {
        elements.copyButton.textContent = 'Copy JSON result';
      }, 1500);
    }
  });
}

populateSelect(elements.totalHosts, TOTAL_HOST_OPTIONS);
populateSelect(
  elements.hostsPerPod,
  HOSTS_PER_POD_OPTIONS,
  (value) => (value === 0 ? 'Single pod (all hosts)' : value.toLocaleString('en-US')),
);
populateSelect(elements.switchRadix, SWITCH_RADIX_OPTIONS, (value) => `${value}-port`);

applyStateToInputs();
attachEventListeners();
recalculate();
