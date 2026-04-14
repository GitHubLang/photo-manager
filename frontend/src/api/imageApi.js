export const API_BASE = window.location.protocol + '//' + window.location.hostname + ':8000/api';

// ============ 文件夹 API ============
export const fetchFolders = () =>
  fetch(API_BASE + '/folders').then(r => r.json());

export const scanAllFolders = () =>
  fetch(API_BASE + '/folders/scan-all', { method: 'POST' }).then(r => r.json());

// ============ 图片 API ============
export const fetchImages = (folderPath, { page = 1, pageSize = 50, sortBy = 'filename', sortOrder = 'asc' } = {}) => {
  const params = new URLSearchParams({ page, page_size: pageSize, sort_by: sortBy, sort_order: sortOrder });
  return fetch(API_BASE + '/folders/' + encodeURIComponent(folderPath) + '/images?' + params).then(r => r.json());
};

export const fetchImagesPrev = (folderPath, { page = 1, pageSize = 50, sortBy = 'filename', sortOrder = 'asc' } = {}) => {
  const params = new URLSearchParams({ page, page_size: pageSize, sort_by: sortBy, sort_order: sortOrder });
  return fetch(API_BASE + '/folders/' + encodeURIComponent(folderPath) + '/images?' + params).then(r => r.json());
};

export const fetchBatchImages = (ids) =>
  fetch(API_BASE + '/images/batch?ids=' + ids.join(',')).then(r => r.json());

// ============ 搜索 API ============
export const searchImages = (keyword, { page = 1, pageSize = 50 } = {}) => {
  const params = new URLSearchParams({ keyword, page, page_size: pageSize });
  return fetch(API_BASE + '/search?' + params).then(r => r.json());
};

// ============ 评分 API ============
export const fetchScoreTasks = ({ status, page = 1, pageSize = 20 } = {}) => {
  const params = new URLSearchParams({ page, page_size: pageSize });
  if (status && status !== 'all') params.set('status', status);
  return fetch(API_BASE + '/score-tasks?' + params).then(r => r.json());
};

export const retryScoreTasks = (imageIds) =>
  fetch(API_BASE + '/score-tasks/retry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(imageIds)
  }).then(r => r.json());

export const createScoreTask = (imageIds, model) =>
  fetch(API_BASE + '/images/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_ids: imageIds, model })
  }).then(r => r.json());

export const fetchScoreStatus = (imageId) =>
  fetch(API_BASE + '/images/score/status/' + imageId).then(r => r.json());

export const fetchScoreResults = (imageId) =>
  fetch(API_BASE + '/images/score/results/' + imageId).then(r => r.json());

// ============ 文案 API ============
export const fetchModels = () => fetch(API_BASE + '/models/').then(r => r.json());
export const createModel = (data) => fetch(API_BASE + '/models/', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) }).then(r => r.json());
export const updateModel = (id, data) => fetch(API_BASE + '/models/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) }).then(r => r.json());
export const deleteModel = (id) => fetch(API_BASE + '/models/' + id, { method: 'DELETE' }).then(r => r.json());

export const fetchCaptionHistory = ({ keyword, setType, page = 1, pageSize = 20 } = {}) => {
  const params = new URLSearchParams({ page, page_size: pageSize });
  if (keyword) params.set('keyword', keyword);
  if (setType) params.set('set_type', setType);
  return fetch(API_BASE + '/caption/history?' + params).then(r => r.json());
};

export const generateCaption = ({ date, imageIds, setType, userInstructions, model = 'local' }) =>
  fetch(API_BASE + '/caption/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: String(date || ''),
      image_ids: imageIds,
      set_type: String(setType || 'douyin'),
      user_instructions: userInstructions ? String(userInstructions) : null,
      llm_model: model
    })
  }).then(async r => {
    const data = await r.json();
    if (!r.ok) {
      const rawDetail = data.detail;
      const errMsg = Array.isArray(rawDetail)
        ? rawDetail.map(e => (e && typeof e === 'object' ? (e.msg ? String(e.msg) : JSON.stringify(e)) : String(e))).join('; ')
        : String(rawDetail || data.error || '请求失败 (' + r.status + ')');
      throw new Error(errMsg);
    }
    return data;
  });

export const fetchInstructionHistory = (setType) =>
  fetch(API_BASE + '/instruction-history?set_type=' + setType).then(r => r.json());

export const saveInstructionHistory = (instruction, setType) =>
  fetch(API_BASE + '/instruction-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instruction, set_type: setType })
  });

// ============ 主题 API ============
export const generateDailyTheme = (folderName) =>
  fetch(API_BASE + '/daily-theme/' + folderName + '/generate', { method: 'POST' }).then(r => r.json());

// ============ 模型 API ============
export const fetchModels = () =>
  fetch(API_BASE + '/models').then(r => r.json());

// ============ 应用状态 API ============
export const fetchAppState = () =>
  fetch(API_BASE + '/app-state').then(r => r.json());

export const saveAppState = (state) =>
  fetch(API_BASE + '/app-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state)
  });

// ============ 图片代理/缩略图 ============
export const getThumbnailUrl = (filePath, size = 400) =>
  API_BASE + '/image/thumbnail/' + encodeURIComponent(filePath) + '?size=' + size;

export const getProxyUrl = (filePath) =>
  API_BASE + '/image/proxy/' + encodeURIComponent(filePath);
