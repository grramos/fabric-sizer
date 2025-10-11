import { calculateSizing } from './calculators.js';
import { z } from './zod-lite.js';

const STORAGE_KEY = 'fabric-sizer-inputs-v1';

const defaultState = {
  preset: 'custom',
  totalHosts: 1024,
  hostsPerPod: 256,
  topology: 'clos3',
  nicsPerHost: 1,
  oversubscription: null,
  leaf: { totalPorts: 32, hostPorts: 24, fabricPorts: 8 },
  spine: { totalPorts: 32, downlinkPorts: 32, uplinkPorts: 16 },
  superSpine: { totalPorts: 64, downlinkPorts: 64 },
  dragonflyPlus: { leavesPerGroup: 4, spinesPerGroup: 4, intraGroupDegree: 4, interGroupDegree: 2 },
};

const PRESETS = {
  'leaf32-400': {
    leaf: { totalPorts: 32, hostPorts: 24, fabricPorts: 8 },
    spine: { totalPorts: 32, downlinkPorts: 24, uplinkPorts: 8 },
    superSpine: { totalPorts: 64, downlinkPorts: 64 },
  },
  'leaf64-400': {
    leaf: { totalPorts: 64, hostPorts: 48, fabricPorts: 16 },
    spine: { totalPorts: 64, downlinkPorts: 48, uplinkPorts: 16 },
    superSpine: { totalPorts: 128, downlinkPorts: 128 },
  },
  'leaf32-800': {
    leaf: { totalPorts: 32, hostPorts: 24, fabricPorts: 8 },
    spine: { totalPorts: 48, downlinkPorts: 24, uplinkPorts: 12 },
    superSpine: { totalPorts: 96, downlinkPorts: 96 },
  },
};

const inputSchema = z.object({
  totalHosts: z.number().int().positive().max(500000),
  hostsPerPod: z.number().int().positive().max(200000),
  topology: z.enum(['clos3', 'clos5', 'dragonflyPlus']),
  nicsPerHost: z.number().int().positive().max(2),
  oversubscription: z.optional(z.enum(['1:1', '2:1', '3:1'])),
  leaf: z.object({
    totalPorts: z.number().int().positive().max(1024),
    hostPorts: z.number().int().positive().max(1024),
    fabricPorts: z.number().int().nonnegative().max(1024),
  }),
  spine: z.object({
    totalPorts: z.number().int().positive().max(1024),
    downlinkPorts: z.number().int().positive().max(1024),
    uplinkPorts: z.optional(z.number().int().nonnegative().max(1024)),
  }),
  superSpine: z.optional(
    z.object({
      totalPorts: z.number().int().positive().max(2048),
      downlinkPorts: z.number().int().positive().max(2048),
    }),
  ),
  dragonflyPlus: z.optional(
    z.object({
      leavesPerGroup: z.number().int().positive().max(512),
      spinesPerGroup: z.number().int().positive().max(512),
      intraGroupDegree: z.number().int().nonnegative().max(512),
      interGroupDegree: z.number().int().nonnegative().max(512),
    }),
  ),
});

let state = loadInitialState();
let latestResult = null;
let isSyncing = false;

const elements = {
  presetSelect: document.getElementById('presetSelect'),
  totalHosts: document.getElementById('totalHosts'),
  hostsPerPod: document.getElementById('hostsPerPod'),
  topologyRadios: Array.from(document.querySelectorAll('input[name="topology"]')),
  nicsPerHost: document.getElementById('nicsPerHost'),
  leafTotalPorts: document.getElementById('leafTotalPorts'),
  leafHostPorts: document.getElementById('leafHostPorts'),
  leafFabricPorts: document.getElementById('leafFabricPorts'),
  spineTotalPorts: document.getElementById('spineTotalPorts'),
  spineDownlinks: document.getElementById('spineDownlinks'),
  spineUplinks: document.getElementById('spineUplinks'),
  superSpineTotal: document.getElementById('superSpineTotal'),
  superSpineDown: document.getElementById('superSpineDown'),
  dfLeavesPerGroup: document.getElementById('dfLeavesPerGroup'),
  dfSpinesPerGroup: document.getElementById('dfSpinesPerGroup'),
  dfIntraDegree: document.getElementById('dfIntraDegree'),
  dfInterDegree: document.getElementById('dfInterDegree'),
  oversubscription: document.getElementById('oversubscription'),
  validationMessage: document.getElementById('validationMessage'),
  copyButton: document.getElementById('copyButton'),
  resultsRoot: document.getElementById('resultsRoot'),
  leavesCount: document.getElementById('leavesCount'),
  spinesCount: document.getElementById('spinesCount'),
  superSpinesCount: document.getElementById('superSpinesCount'),
  totalSwitches: document.getElementById('totalSwitches'),
  hostLeafPerPod: document.getElementById('hostLeafPerPod'),
  hostLeafTotal: document.getElementById('hostLeafTotal'),
  leafSpinePerPod: document.getElementById('leafSpinePerPod'),
  leafSpineTotal: document.getElementById('leafSpineTotal'),
  spineSuperPerPod: document.getElementById('spineSuperPerPod'),
  spineSuperTotal: document.getElementById('spineSuperTotal'),
  interGroupPer: document.getElementById('interGroupPer'),
  interGroupTotal: document.getElementById('interGroupTotal'),
  podDetails: document.getElementById('podDetails'),
  assumptionsList: document.getElementById('assumptionsList'),
  superSection: document.querySelector('[data-role="superSpine"]'),
  dragonflySection: document.querySelector('[data-role="dragonfly"]'),
  spineUplinkGroup: document.querySelector('[data-role="spineUplinks"]'),
  resultSuper: document.querySelectorAll('[data-role="resultSuper"]'),
  fiberSuper: document.querySelectorAll('[data-role="fiberSuper"]'),
  fiberInter: document.querySelectorAll('[data-role="fiberInter"]'),
};

const bindings = [
  { element: elements.totalHosts, path: 'totalHosts', type: 'number' },
  { element: elements.hostsPerPod, path: 'hostsPerPod', type: 'number' },
  { element: elements.nicsPerHost, path: 'nicsPerHost', type: 'number' },
  { element: elements.leafTotalPorts, path: 'leaf.totalPorts', type: 'number' },
  { element: elements.leafHostPorts, path: 'leaf.hostPorts', type: 'number' },
  { element: elements.leafFabricPorts, path: 'leaf.fabricPorts', type: 'number' },
  { element: elements.spineTotalPorts, path: 'spine.totalPorts', type: 'number' },
  { element: elements.spineDownlinks, path: 'spine.downlinkPorts', type: 'number' },
  { element: elements.spineUplinks, path: 'spine.uplinkPorts', type: 'number' },
  { element: elements.superSpineTotal, path: 'superSpine.totalPorts', type: 'number' },
  { element: elements.superSpineDown, path: 'superSpine.downlinkPorts', type: 'number' },
  { element: elements.dfLeavesPerGroup, path: 'dragonflyPlus.leavesPerGroup', type: 'number' },
  { element: elements.dfSpinesPerGroup, path: 'dragonflyPlus.spinesPerGroup', type: 'number' },
  { element: elements.dfIntraDegree, path: 'dragonflyPlus.intraGroupDegree', type: 'number' },
  { element: elements.dfInterDegree, path: 'dragonflyPlus.interGroupDegree', type: 'number' },
];

function loadInitialState() {
  const clone = JSON.parse(JSON.stringify(defaultState));
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return clone;
    const parsed = JSON.parse(stored);
    return mergeState(clone, parsed);
  } catch (error) {
    console.warn('Failed to load stored inputs', error);
    return clone;
  }
}

function mergeState(base, patch) {
  const merged = { ...base };
  for (const key of Object.keys(patch)) {
    if (patch[key] && typeof patch[key] === 'object' && !Array.isArray(patch[key])) {
      merged[key] = mergeState(base[key] || {}, patch[key]);
    } else {
      merged[key] = patch[key];
    }
  }
  return merged;
}

function assignValue(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

function updateState(path, value) {
  if (isSyncing) return;
  if (state.preset !== 'custom') {
    state.preset = 'custom';
    elements.presetSelect.value = 'custom';
  }
  assignValue(state, path, value);
  persistState();
  applyOversubscriptionLock();
  recalculate();
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Unable to persist state', error);
  }
}

function applyOversubscriptionLock() {
  const setting = state.oversubscription;
  const fabricField = elements.leafFabricPorts;
  if (setting && setting !== 'none') {
    const ratio = Number(setting.split(':')[0]);
    if (Number.isFinite(ratio) && ratio > 0) {
      const computed = Math.ceil(state.leaf.hostPorts / ratio) || 0;
      state.leaf.fabricPorts = computed;
      fabricField.value = computed;
    }
    fabricField.setAttribute('readonly', 'readonly');
  } else {
    fabricField.removeAttribute('readonly');
  }
}

function applyStateToInputs() {
  isSyncing = true;
  elements.presetSelect.value = state.preset || 'custom';
  elements.totalHosts.value = state.totalHosts;
  elements.hostsPerPod.value = state.hostsPerPod;
  elements.nicsPerHost.value = state.nicsPerHost;
  elements.leafTotalPorts.value = state.leaf.totalPorts;
  elements.leafHostPorts.value = state.leaf.hostPorts;
  elements.leafFabricPorts.value = state.leaf.fabricPorts;
  elements.spineTotalPorts.value = state.spine.totalPorts;
  elements.spineDownlinks.value = state.spine.downlinkPorts;
  elements.spineUplinks.value = state.spine.uplinkPorts ?? 0;
  elements.superSpineTotal.value = state.superSpine.totalPorts ?? 0;
  elements.superSpineDown.value = state.superSpine.downlinkPorts ?? 0;
  elements.dfLeavesPerGroup.value = state.dragonflyPlus.leavesPerGroup;
  elements.dfSpinesPerGroup.value = state.dragonflyPlus.spinesPerGroup;
  elements.dfIntraDegree.value = state.dragonflyPlus.intraGroupDegree;
  elements.dfInterDegree.value = state.dragonflyPlus.interGroupDegree;
  elements.oversubscription.value = state.oversubscription || 'none';
  elements.topologyRadios.forEach((radio) => {
    radio.checked = radio.value === state.topology;
  });
  isSyncing = false;
  applyOversubscriptionLock();
  toggleSections();
}

function toggleSections() {
  const isClos5 = state.topology === 'clos5';
  const isDragonfly = state.topology === 'dragonflyPlus';
  elements.superSection.style.display = isClos5 ? 'block' : 'none';
  elements.dragonflySection.style.display = isDragonfly ? 'block' : 'none';
  elements.spineUplinkGroup.style.display = isClos5 ? 'flex' : 'none';
  elements.resultSuper.forEach((node) => {
    node.style.display = isClos5 ? 'block' : 'none';
  });
  elements.fiberSuper.forEach((node) => {
    node.style.display = isClos5 ? 'block' : 'none';
  });
  elements.fiberInter.forEach((node) => {
    node.style.display = isDragonfly ? 'block' : 'none';
  });
}

function buildPayload() {
  const payload = {
    totalHosts: state.totalHosts,
    hostsPerPod: state.hostsPerPod,
    topology: state.topology,
    nicsPerHost: state.nicsPerHost,
    oversubscription: state.oversubscription && state.oversubscription !== 'none' ? state.oversubscription : undefined,
    leaf: { ...state.leaf },
    spine: { ...state.spine },
  };
  if (state.topology === 'clos5') {
    payload.superSpine = { ...state.superSpine };
  }
  if (state.topology === 'dragonflyPlus') {
    payload.dragonflyPlus = { ...state.dragonflyPlus };
  }
  return payload;
}

function recalculate() {
  const payload = buildPayload();
  const validation = inputSchema.safeParse(payload);
  if (!validation.success) {
    showValidationMessage(validation.error);
    clearResults();
    latestResult = null;
    elements.copyButton.disabled = true;
    return;
  }

  let result;
  try {
    result = calculateSizing(validation.data);
  } catch (error) {
    showRuntimeError(error);
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

function showValidationMessage(error) {
  const issue = error.issues?.[0];
  const message = issue?.message || 'Invalid input configuration. Please review your values.';
  elements.validationMessage.textContent = message;
  elements.validationMessage.classList.remove('hidden');
}

function showRuntimeError(error) {
  elements.validationMessage.textContent = error.message || 'Unable to compute sizing for the provided inputs.';
  elements.validationMessage.classList.remove('hidden');
}

function clearResults() {
  const fields = [
    elements.leavesCount,
    elements.spinesCount,
    elements.superSpinesCount,
    elements.totalSwitches,
    elements.hostLeafPerPod,
    elements.hostLeafTotal,
    elements.leafSpinePerPod,
    elements.leafSpineTotal,
    elements.spineSuperPerPod,
    elements.spineSuperTotal,
    elements.interGroupPer,
    elements.interGroupTotal,
  ];
  fields.forEach((field) => {
    if (field) field.textContent = '-';
  });
  elements.podDetails.innerHTML = '';
  elements.assumptionsList.innerHTML = '';
}

function updateResults(result) {
  elements.leavesCount.textContent = formatNumber(result.switchCounts.leaves);
  elements.spinesCount.textContent = formatNumber(result.switchCounts.spines);
  elements.superSpinesCount.textContent = result.switchCounts.superSpines ? formatNumber(result.switchCounts.superSpines) : '-';
  elements.totalSwitches.textContent = formatNumber(result.switchCounts.total);

  elements.hostLeafPerPod.textContent = formatNumber(result.fiberCounts.hostToLeafPerPod);
  elements.hostLeafTotal.textContent = formatNumber(result.fiberCounts.hostToLeafTotal);
  elements.leafSpinePerPod.textContent = formatNumber(result.fiberCounts.leafToSpinePerPod);
  elements.leafSpineTotal.textContent = formatNumber(result.fiberCounts.leafToSpineTotal);
  elements.spineSuperPerPod.textContent = result.fiberCounts.spineToSuperPerPod !== undefined ? formatNumber(result.fiberCounts.spineToSuperPerPod) : '-';
  elements.spineSuperTotal.textContent = result.fiberCounts.spineToSuperTotal !== undefined ? formatNumber(result.fiberCounts.spineToSuperTotal) : '-';
  elements.interGroupPer.textContent = result.fiberCounts.interGroupPerGroup !== undefined ? formatNumber(result.fiberCounts.interGroupPerGroup) : '-';
  elements.interGroupTotal.textContent = result.fiberCounts.interGroupTotal !== undefined ? formatNumber(result.fiberCounts.interGroupTotal) : '-';

  renderPodDetails(result);
  renderAssumptions(result);
}

function renderPodDetails(result) {
  const items = [];
  const meta = result.metadata || {};
  if (meta.pods !== undefined) items.push(`Pods required: ${formatNumber(meta.pods)}`);
  if (meta.leavesPerPod !== undefined) items.push(`Leaves per pod: ${formatNumber(meta.leavesPerPod)}`);
  if (meta.hostsPerLeaf !== undefined) items.push(`Hosts per leaf: ${formatNumber(meta.hostsPerLeaf)}`);
  if (meta.spinesPerPod !== undefined) items.push(`Spines per pod: ${formatNumber(meta.spinesPerPod)}`);
  if (meta.groups !== undefined) items.push(`Groups required: ${formatNumber(meta.groups)}`);
  if (meta.leavesPerGroup !== undefined) items.push(`Leaves per group: ${formatNumber(meta.leavesPerGroup)}`);
  if (meta.spinesPerGroup !== undefined) items.push(`Spines per group: ${formatNumber(meta.spinesPerGroup)}`);
  elements.podDetails.innerHTML = items.map((line) => `<p>${line}</p>`).join('');
}

function renderAssumptions(result) {
  if (!Array.isArray(result.assumptions)) {
    elements.assumptionsList.innerHTML = '';
    return;
  }
  elements.assumptionsList.innerHTML = result.assumptions
    .map((entry) => `<li><strong>${entry.label}:</strong> ${entry.description}</li>`)
    .join('');
}

function formatNumber(value) {
  const formatter = Intl.NumberFormat('en-US');
  return formatter.format(value ?? 0);
}

function attachEventListeners() {
  bindings.forEach(({ element, path, type }) => {
    element.addEventListener('input', (event) => {
      if (isSyncing) return;
      const raw = event.target.value;
      if (raw === '') return;
      if (type === 'number') {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
          updateState(path, parsed);
        }
      }
    });
  });

  elements.topologyRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      state.topology = radio.value;
      state.preset = 'custom';
      elements.presetSelect.value = 'custom';
      toggleSections();
      persistState();
      recalculate();
    });
  });

  elements.presetSelect.addEventListener('change', (event) => {
    const value = event.target.value;
    state.preset = value;
    if (PRESETS[value]) {
      const preset = PRESETS[value];
      state.leaf = { ...state.leaf, ...preset.leaf };
      state.spine = { ...state.spine, ...preset.spine };
      state.superSpine = { ...state.superSpine, ...preset.superSpine };
      applyStateToInputs();
      persistState();
      recalculate();
    }
  });

  elements.nicsPerHost.addEventListener('change', (event) => {
    const value = Number(event.target.value);
    if (Number.isFinite(value)) {
      updateState('nicsPerHost', value);
    }
  });

  elements.oversubscription.addEventListener('change', (event) => {
    const value = event.target.value;
    state.oversubscription = value === 'none' ? null : value;
    applyOversubscriptionLock();
    persistState();
    recalculate();
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

applyStateToInputs();
attachEventListeners();
recalculate();
