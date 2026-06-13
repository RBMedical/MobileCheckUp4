const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxDhzLEukBf1USExcEsQezXtWcjV8mM37blajiulWslNK722u1uXHVJ2oyBmkLI2fAyOA/exec';
const fields = [
  'HN',
  'ชื่อ นามสกุล',
  'รหัสประจำตัว',
  'เลขบัตรประชาชน',
  'แผนก',
  'ตำแหน่ง',
  'ชั้นปี',
  'สาขา',
  'ห้อง',
  'โปรแกรม',
  'Customer',
  'ลำดับลงทะเบียน',
  'วันที่ลงทะเบียน',
  'เวลาลงทะเบียน',
  'หมายเหตุ'
];

let currentRow = null;
let currentStickers = [];

const $ = (selector) => document.querySelector(selector);

document.addEventListener('DOMContentLoaded', () => {
  loadQueue();
  setInterval(loadQueue,30000);
  lucide.createIcons();
  bindEvents();
});

function bindEvents() {
  $('#searchBtn').addEventListener('click', searchEmployee);
  $('#searchInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') searchEmployee();
  });
  $('#editBtn').addEventListener('click', updateEmployee);
  $('#deleteBtn').addEventListener('click', deleteEmployee);
  $('#addNewBtn').addEventListener('click', openAddNewModal);
  $('#registerBtn').addEventListener('click', registerEmployee);
  $('#printBtn').addEventListener('click', () => window.print());
  $('#followRefreshBtn').addEventListener('click', loadFollowData);

  document.querySelectorAll('.menu-item').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.page === 'specimen') {
        openSpecimenModal();
        return;
      }
      switchPage(button.dataset.page);
    });
  });
}

function switchPage(page) {
  document.querySelectorAll('.menu-item').forEach((item) => item.classList.toggle('active', item.dataset.page === page));
  document.querySelectorAll('.page').forEach((item) => item.classList.remove('active'));
  $(`#${page}Page`).classList.add('active');

  if (page === 'report') loadFollowData();
}

async function searchEmployee() {
  const query = $('#searchInput').value.trim();
  if (!query) return setStatus('กรุณาระบุคำค้นหา', false);

  let result;
  try {
    setStatus('กำลังค้นหา...');
    result = await appScriptRequest({ action: 'search', q: query });
  } catch (error) {
    return setStatus(error.message || 'เชื่อมต่อไม่สำเร็จ', false);
  }

  if (!result.ok) return setStatus(result.message || 'ค้นหาไม่สำเร็จ', false);

  const rows = result.rows || [];

  if (rows.length === 0) {
    clearForm();
    renderResults([]);
    setStatus('ไม่พบข้อมูลที่ค้นหา', false);

    const confirmResult = await Swal.fire({
      title: 'ไม่มีรายชื่อนี้อยู่ในระบบ',
      text: 'คุณต้องการเพิ่มชื่อไหม',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ใช่',
      cancelButtonText: 'ไม่',
      confirmButtonColor: '#087d86',
      cancelButtonColor: '#6c757d',
      reverseButtons: true
    });

    if (confirmResult.isConfirmed) openAddNewModal(query);
    return;
  }

  fillForm(rows[0]);
  renderResults(rows);

  if (rows.length === 1) {
    $('#resultList').classList.remove('visible');
    return setStatus('พบข้อมูลและแสดงบนฟอร์มแล้ว');
  }

  setStatus(`พบข้อมูล ${rows.length} รายการ แสดงรายการแรกบนฟอร์มแล้ว`);
}

function renderResults(rows) {
  const list = $('#resultList');
  list.innerHTML = '';
  list.classList.toggle('visible', rows.length > 0);

  rows.forEach((row) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'result-item';
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(row['ชื่อ นามสกุล'] || '-')}</strong>
        <span>HN ${escapeHtml(row.HN || '-')} | รหัส ${escapeHtml(row['รหัสประจำตัว'] || '-')} | โปรแกรม ${escapeHtml(row['โปรแกรม'] || '-')}</span>
      </div>
      <i data-lucide="chevron-right"></i>
    `;
    item.addEventListener('click', () => {
      fillForm(row);
      list.classList.remove('visible');
      lucide.createIcons();
    });
    list.appendChild(item);
  });

  lucide.createIcons();
}

function formatDateAndTime(value) {

  if (!value) {
    return {
      date: '',
      time: ''
    };
  }

  const text = String(value).trim();

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    return {
      date: text,
      time: ''
    };
  }

  if (/^\d{2}:\d{2}$/.test(text)) {
    return {
      date: '',
      time: text
    };
  }

  try {

    const date = new Date(text);

    if (isNaN(date.getTime())) {
      return {
        date: text,
        time: text
      };
    }

    return {
      date:
        String(date.getDate()).padStart(2, '0') +
        '/' +
        String(date.getMonth() + 1).padStart(2, '0') +
        '/' +
        date.getFullYear(),

      time:
        String(date.getHours()).padStart(2, '0') +
        ':' +
        String(date.getMinutes()).padStart(2, '0')
    };

  } catch {

    return {
      date: text,
      time: text
    };
  }
}

function fillForm(row) {

  currentRow = row;
  $('#rowId').value = row.rowId || '';

  fields.forEach((field) => {
    const input = document.getElementById(field);
    if (!input) return;
    input.value = row[field] || '';
  });

  if (row.stickers && row.stickers.length) {
    currentStickers = row.stickers;
    renderStickers(currentStickers);
  }

  setStatus('เลือกข้อมูลแล้ว');
}
function getFormPayload(action) {
  const payload = { action, rowId: $('#rowId').value };
  fields.forEach((field) => {
    payload[field] = document.getElementById(field).value.trim();
  });
  return payload;
}

// ── Edit Modal ──────────────────────────────────────────────
const editModalFields = [
  'ชื่อ นามสกุล','รหัสประจำตัว','เลขบัตรประชาชน',
  'แผนก','ตำแหน่ง','ชั้นปี','สาขา','ห้อง','โปรแกรม','Customer','หมายเหตุ'
];

function updateEmployee() {
  if (!currentRow) return setStatus('กรุณาค้นหาและเลือกข้อมูลก่อนแก้ไข', false);

  // ดึงค่าจากฟอร์มหลักมาใส่ใน editModal
  document.getElementById('editModal-HN').textContent               = currentRow['HN'] || '—';
  document.getElementById('editModal-ลำดับลงทะเบียน').textContent  = currentRow['ลำดับลงทะเบียน'] || '—';
  document.getElementById('editModal-วันที่ลงทะเบียน').textContent = currentRow['วันที่ลงทะเบียน'] || '—';
  document.getElementById('editModal-เวลาลงทะเบียน').textContent   = currentRow['เวลาลงทะเบียน'] || '—';

  editModalFields.forEach(f => {
    const el = document.getElementById('editModal-' + f);
    if (el) el.value = currentRow[f] || '';
  });

  document.getElementById('editModalStatus').textContent = '';
  document.getElementById('editModal').classList.add('open');
  lucide.createIcons();

  // bind buttons (re-bind ทุกครั้งเพื่อป้องกัน duplicate listener)
  document.getElementById('editModalConfirmBtn').onclick = submitEditEmployee;
  document.getElementById('editModalCancelBtn').onclick  = closeEditModal;
  document.getElementById('editModalCloseBtn').onclick   = closeEditModal;
  document.getElementById('editModal').onclick = (e) => {
    if (e.target === document.getElementById('editModal')) closeEditModal();
  };
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
}

async function submitEditEmployee() {
  const name = document.getElementById('editModal-ชื่อ นามสกุล').value.trim();
  if (!name) {
    setEditModalStatus('กรุณากรอกชื่อ นามสกุล', false);
    return;
  }

  const hn = document.getElementById('editModal-HN').textContent.trim();
  if (!hn || hn === '—') {
    setEditModalStatus('ไม่พบ HN', false);
    return;
  }

  setEditModalStatus('กำลังบันทึก...', true);
  document.getElementById('editModalConfirmBtn').disabled = true;

  const payload = { action: 'update', 'HN': hn };
  editModalFields.forEach(f => {
    payload[f] = (document.getElementById('editModal-' + f) || {value: ''}).value.trim();
  });

  let result;
  try {
    result = await appScriptRequest(payload);
  } catch (err) {
    setEditModalStatus(err.message || 'เชื่อมต่อไม่สำเร็จ', false);
    document.getElementById('editModalConfirmBtn').disabled = false;
    return;
  }

  document.getElementById('editModalConfirmBtn').disabled = false;

  if (!result.ok) {
    setEditModalStatus(result.message || 'แก้ไขไม่สำเร็จ', false);
    return;
  }

  closeEditModal();
  fillForm(result.row);
  setStatus('แก้ไขข้อมูลเรียบร้อย');

  Swal.fire({
    title: 'ข้อมูลถูกอัพเดทแล้ว',
    icon: 'success',
    timer: 1500,
    showConfirmButton: false
  });
}

function setEditModalStatus(msg, ok = true) {
  const el = document.getElementById('editModalStatus');
  el.textContent = msg;
  el.style.color = ok ? '#087d86' : '#c63742';
}

async function deleteEmployee() {
  if (!$('#rowId').value) return setStatus('กรุณาเลือกข้อมูลก่อนลบ', false);

  const confirmResult = await Swal.fire({
    title: 'ยืนยันการลบรายชื่อนี้หรือไม่',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ใช่',
    cancelButtonText: 'ไม่',
    confirmButtonColor: '#c63742',
    cancelButtonColor: '#6c757d',
    reverseButtons: true
  });

  if (!confirmResult.isConfirmed) return;

  let result;
  try {
    setStatus('กำลังลบข้อมูล...');
    result = await appScriptRequest({ action: 'delete', hn: document.getElementById('HN').value.trim() });
  } catch (error) {
    return setStatus(error.message || 'เชื่อมต่อไม่สำเร็จ', false);
  }

  if (!result.ok) return setStatus(result.message || 'ลบไม่สำเร็จ', false);

  clearForm();
  setStatus('ลบข้อมูลเรียบร้อย');

  Swal.fire({
    title: 'ลบข้อมูลเรียบร้อย',
    icon: 'success',
    timer: 1500,
    showConfirmButton: false
  });
}

async function registerEmployee() {
  if (!$('#rowId').value) return setStatus('กรุณาเลือกข้อมูลก่อนลงทะเบียน', false);

  let result;
  try {
    setStatus('กำลังลงทะเบียน...');
    result = await appScriptRequest({ action: 'register', rowId: $('#rowId').value });
  } catch (error) {
    return setStatus(error.message || 'เชื่อมต่อไม่สำเร็จ', false);
  }

  if (!result.ok) return setStatus(result.message || 'ลงทะเบียนไม่สำเร็จ', false);

  fillForm(result.row);
  currentStickers = result.stickers || [];
  renderStickers(currentStickers);
  loadQueue();

  setStatus('ลงทะเบียนและสร้างสติกเกอร์เรียบร้อย');
}
 

function renderStickers(stickers) {
  const preview = $('#stickerPreview');

  if (!stickers.length) {
    preview.innerHTML = `
      <div class="empty-state">
        <i data-lucide="barcode"></i>
        <p>ไม่พบรายการสิ่งตรวจของโปรแกรมนี้</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  preview.innerHTML = stickers.map((item) => `
    <div class="sticker-scale">
      <article class="sticker-card">
        <div class="sticker-sequence">${escapeHtml(formatSequence(item['ลำดับลงทะเบียน']))}</div>
        <div class="sticker-barcode">
          <svg class="barcode-svg" data-barcode="${escapeHtml(item.barcode)}"></svg>
        </div>
        <div class="sticker-left">
          <div class="sticker-hn">HN ${escapeHtml(formatHn(item.HN))}</div>
          <div class="sticker-subcode">${escapeHtml(formatSpecimenLine(item))}</div>
          <div class="sticker-specimen">${escapeHtml(item.specimen || '-')}</div>
        </div>
        <div class="sticker-name">${escapeHtml(item.fullName || item.displayName || '-')}</div>
        <div class="sticker-customer">${escapeHtml(item.Customer || '-')}</div>
        <div class="sticker-date">${escapeHtml(formatStickerDate(item['วันที่ลงทะเบียน']))}</div>
      </article>
    </div>
  `).join('');

  drawBarcodes();
}

function drawBarcodes() {
  const barcodeEls = document.querySelectorAll('.barcode-svg');
  barcodeEls.forEach((el) => {
    const value = el.dataset.barcode || '';
    if (!value) return;

    if (window.JsBarcode) {
      try {
       window.JsBarcode(el, value, {
  format: 'CODE128',
  displayValue: false,
  margin: 0,
  width: 1.25,
  height: 30
});
      } catch (error) {
        drawFallbackBarcode(el, value);
      }
      return;
    }

    drawFallbackBarcode(el, value);
  });
}

function drawFallbackBarcode(svg, value) {
  const namespace = 'http://www.w3.org/2000/svg';
  const width = 316;
  const height = 72;
  let cursor = 0;
  const bars = [];
  const encoded = `110100${String(value || '').split('').map((char) => char.charCodeAt(0).toString(2).padStart(8, '0')).join('')}10011`;
  const unit = width / encoded.length;

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = '';

  for (const bit of encoded) {
    if (bit === '1') bars.push({ x: cursor, width: Math.max(unit * 0.85, 1) });
    cursor += unit;
  }

  bars.forEach((bar) => {
    const rect = document.createElementNS(namespace, 'rect');
    rect.setAttribute('x', String(bar.x));
    rect.setAttribute('y', '0');
    rect.setAttribute('width', String(bar.width));
    rect.setAttribute('height', String(height));
    rect.setAttribute('fill', '#000');
    svg.appendChild(rect);
  });
}

function formatSequence(value) {
  const text = String(value || '').trim();
  if (!text) return '0000';
  const number = Number(text);
  return Number.isFinite(number) ? String(number).padStart(4, '0') : text;
}

function formatHn(value) {
  const text = String(value || '').trim();
  if (!text) return '00000000';
  return /^\d+$/.test(text) ? text.padStart(8, '0') : text;
}

function formatSpecimenLine(item) {
  const sequence = formatSequence(item['ลำดับลงทะเบียน']);
  const specimenCode = item.specimenCode || getSpecimenCodeFromBarcode(item.barcode, item.HN);
  return `${sequence} / ${specimenCode || item.program || '-'}`;
}

function getSpecimenCodeFromBarcode(barcode, hn) {
  const barcodeText = String(barcode || '');
  const hnText = String(hn || '').trim().padStart(6, '0');
  if (!barcodeText || !hnText || !barcodeText.startsWith(hnText)) return '';
  return barcodeText.slice(hnText.length);
}

function formatStickerDate(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return text;
  return `${Number(match[1])}/${Number(match[2])}/${match[3]}`;
}

function clearForm() {
  currentRow = null;
  currentStickers = [];
  $('#rowId').value = '';
  fields.forEach((field) => {
    document.getElementById(field).value = '';
  });
  renderStickers([]);
}

// ─── Specimen Modal ──────────────────────────────────────────

let specimenTestData = [];  // cache from sheet Test

function openSpecimenModal() {
  $('#specimenModal').classList.add('open');
  lucide.createIcons();

  $('#specimenModalCloseBtn').onclick  = closeSpecimenModal;
  $('#specimenModalCancelBtn').onclick = closeSpecimenModal;
  $('#specimenModal').onclick = (e) => { if (e.target === $('#specimenModal')) closeSpecimenModal(); };
  $('#specimenRefreshBtn').onclick = loadSpecimenTable;

  $('#specimenDropA').onchange = onSpecimenDropAChange;
  $('#specimenDropB').onchange = onSpecimenDropBChange;

  $('#specimenBarcode').oninput = () => {
    $('#specimenBarcodeStatus').textContent = '';
    $('#specimenBarcodeStatus').className = 'specimen-barcode-status';

    const val = $('#specimenBarcode').value.trim();
    if (/^\d{8}$/.test(val)) {
      processBarcode();
    }
  };
  $('#specimenBarcode').onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processBarcode();
    }
  };

  loadSpecimenDropdowns();
  loadSpecimenTable();

  setTimeout(() => $('#specimenBarcode').focus(), 100);
}

function closeSpecimenModal() {
  $('#specimenModal').classList.remove('open');
}

async function loadSpecimenDropdowns() {
  setSpecimenStatus('กำลังโหลดข้อมูล...');
  let result;
  try {
    result = await appScriptRequest({ action: 'getTestData' });
  } catch (e) {
    return setSpecimenStatus('โหลดข้อมูลไม่สำเร็จ', false);
  }
  if (!result.ok) return setSpecimenStatus(result.message || 'โหลดไม่สำเร็จ', false);

  specimenTestData = result.rows || [];

  // A dropdown: unique values from col F
  const groupsA = [...new Set(specimenTestData.map(r => r.colF).filter(Boolean))];
  const dropA = $('#specimenDropA');
  dropA.innerHTML = '<option value="">— เลือกกลุ่ม —</option>';
  groupsA.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g; opt.textContent = g;
    dropA.appendChild(opt);
  });

  setSpecimenStatus('พร้อมใช้งาน');
}

function onSpecimenDropAChange() {
  const valA = $('#specimenDropA').value;
  const dropB = $('#specimenDropB');
  dropB.innerHTML = '<option value="">— เลือกประเภท —</option>';
  $('#specimenF').value = '';

  if (!valA) return;

  const groupsB = [...new Set(
    specimenTestData.filter(r => r.colF === valA).map(r => r.colE).filter(Boolean)
  )];
  groupsB.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g; opt.textContent = g;
    dropB.appendChild(opt);
  });
}

function onSpecimenDropBChange() {
  const valA = $('#specimenDropA').value;
  const valB = $('#specimenDropB').value;
  if (!valB) { $('#specimenF').value = ''; return; }

  const match = specimenTestData.find(r => r.colF === valA && r.colE === valB);
  $('#specimenF').value = match ? (match.colB || '') : '';
}

let isProcessingBarcode = false;

async function processBarcode() {
  if (isProcessingBarcode) return;

  const barcode = $('#specimenBarcode').value.trim();
  const statusEl = $('#specimenBarcodeStatus');
  const valB = $('#specimenDropB').value;
  const valA = $('#specimenDropA').value;

  // validate 8 digits
  if (!/^\d{8}$/.test(barcode)) {
    statusEl.textContent = 'Barcode ไม่ถูกต้อง';
    statusEl.className = 'specimen-barcode-status err';
    resetBarcodeInput_(statusEl);
    return;
  }

  // check last 2 digits match specimenF
  const specimenCode = $('#specimenF').value.trim();
  const last2 = barcode.slice(-2);
  if (specimenCode && last2 !== specimenCode.slice(-2)) {
    statusEl.textContent = 'Specimen ไม่ตรงกัน';
    statusEl.className = 'specimen-barcode-status err';
    resetBarcodeInput_(statusEl);
    return;
  }

  isProcessingBarcode = true;

  // barcode = HN(6 หลัก) + specimenCode(2 หลัก) = 8 หลัก
  const hn = barcode.slice(0, 6);

  statusEl.textContent = '✓ กำลังบันทึก...';
  statusEl.className = 'specimen-barcode-status ok';
  setSpecimenStatus('กำลังบันทึกข้อมูล...');

  let result;
  try {
    result = await appScriptRequest({
      action: 'saveSpecimen',
      hn6: hn,
      specimenType: valB,
      specimenGroup: valA
    });
  } catch (e) {
    statusEl.textContent = 'เชื่อมต่อไม่สำเร็จ';
    statusEl.className = 'specimen-barcode-status err';
    setSpecimenStatus('เชื่อมต่อไม่สำเร็จ', false);
    isProcessingBarcode = false;
    resetBarcodeInput_(statusEl);
    return;
  }

  if (!result.ok) {
    statusEl.textContent = result.message || 'บันทึกไม่สำเร็จ';
    statusEl.className = 'specimen-barcode-status err';
    setSpecimenStatus(result.message || 'บันทึกไม่สำเร็จ', false);
    isProcessingBarcode = false;
    resetBarcodeInput_(statusEl);
    return;
  }

  statusEl.textContent = '✓ บันทึกแล้ว';
  statusEl.className = 'specimen-barcode-status ok';
  setSpecimenStatus(`บันทึก HN ${hn} — ชื่อ: ${result.patientName || '(ไม่พบในระบบ)'} [${result.debug || ''}]`);

  isProcessingBarcode = false;
  resetBarcodeInput_(statusEl);

  loadSpecimenTable();
}

// เคลียร์ช่อง barcode และคืน focus ให้พร้อมสแกนครั้งต่อไป
function resetBarcodeInput_(statusEl) {
  $('#specimenBarcode').value = '';
  $('#specimenBarcode').focus();

  setTimeout(() => {
    statusEl.textContent = '';
    statusEl.className = 'specimen-barcode-status';
    $('#specimenBarcode').focus();
  }, 1500);
}

async function loadSpecimenTable() {
  const tbody      = $('#specimenTableBody');
  const summaryWrap = $('#specimenSummary');
  tbody.innerHTML  = '<tr><td colspan="4" class="specimen-table-empty">กำลังโหลด...</td></tr>';
  summaryWrap.innerHTML = '<div class="specimen-empty"><i data-lucide="loader"></i><p>กำลังโหลด...</p></div>';
  lucide.createIcons();

  let result;
  try {
    result = await appScriptRequest({ action: 'getSpecimenData' });
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="4" class="specimen-table-empty">โหลดไม่สำเร็จ</td></tr>';
    summaryWrap.innerHTML = '<div class="specimen-empty"><p>โหลดไม่สำเร็จ</p></div>';
    return;
  }

  if (!result.ok || !result.rows || result.rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="specimen-table-empty">ยังไม่มีข้อมูล</td></tr>';
    summaryWrap.innerHTML = '<div class="specimen-empty"><i data-lucide="inbox"></i><p>ยังไม่มีข้อมูล</p></div>';
    lucide.createIcons();
    return;
  }

  // E: specimen table
  tbody.innerHTML = result.rows.map(r => `
    <tr>
      <td>${escapeHtml(r.hn)}</td>
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.specimenType)}</td>
      <td>${escapeHtml(r.specimenGroup)}</td>
    </tr>
  `).join('');

  // D: summary from server
  const summary = result.summary || [];
  if (summary.length === 0) {
    summaryWrap.innerHTML = '<div class="specimen-empty"><p>ยังไม่มีข้อมูล</p></div>';
  } else {
    summaryWrap.innerHTML = summary.map(s => `
      <div class="specimen-summary-item">
        <span class="s-type">${escapeHtml(s.type)}</span>
        <span class="s-count">${s.count}</span>
      </div>
    `).join('');
  }

  // อัปเดต form-count (id count) บนหน้าหลัก
  const counts = result.counts || {};
  ['doctor','xray','ekg','Audiogram','spirometry','eyes','urine','stool','muscle','blood'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = counts[id] != null ? counts[id] : '';
  });

  lucide.createIcons();
}

function setSpecimenStatus(msg, ok = true) {
  const el = $('#specimenStatus');
  el.textContent = msg;
  el.style.color = ok ? '#087d86' : '#c63742';
}

// ─────────────────────────────────────────────────────────────

// ─── Add New Modal ───────────────────────────────────────────

const modalInputFields = [
  'ชื่อ นามสกุล',
  'รหัสประจำตัว',
  'เลขบัตรประชาชน',
  'แผนก',
  'ตำแหน่ง',
  'ชั้นปี',
  'สาขา',
  'ห้อง',
  'โปรแกรม',
  'Customer'
];

function openAddNewModal(prefillName = '') {
  // clear inputs
  modalInputFields.forEach((f) => {
    const el = document.getElementById(`modal-${f}`);
    if (el) el.value = '';
  });

  // pre-fill name if came from search
  if (prefillName) {
    const nameEl = document.getElementById('modal-ชื่อ นามสกุล');
    if (nameEl) nameEl.value = prefillName;
  }

  // show auto-generated previews
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const HH = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');

  $('#modal-HN').textContent = 'xxxxxxx (สร้างอัตโนมัติ)';
  $('#modal-ลำดับลงทะเบียน').textContent = '— รันจากระบบ —';
  $('#modal-วันที่ลงทะเบียน').textContent = `${dd}/${mm}/${yyyy}`;
  $('#modal-เวลาลงทะเบียน').textContent = `${HH}:${min}`;
  $('#modal-หมายเหตุ').value = 'เพิ่มชื่อ';

  $('#modalStatus').textContent = '';
  $('#addNewModal').classList.add('open');
  lucide.createIcons();

  // bind buttons (re-bind to avoid duplicates)
  const confirmBtn = $('#modalConfirmBtn');
  const cancelBtn = $('#modalCancelBtn');
  const closeBtn = $('#modalCloseBtn');
  const backdrop = $('#addNewModal');

  confirmBtn.onclick = submitAddNew;
  cancelBtn.onclick = closeAddNewModal;
  closeBtn.onclick = closeAddNewModal;
  backdrop.onclick = (e) => { if (e.target === backdrop) closeAddNewModal(); };
}

function closeAddNewModal() {
  $('#addNewModal').classList.remove('open');
}

async function submitAddNew() {
  const name = document.getElementById('modal-ชื่อ นามสกุล').value.trim();
  if (!name) {
    setModalStatus('กรุณากรอกชื่อ นามสกุล', false);
    return;
  }

  setModalStatus('กำลังบันทึก...', true);
  $('#modalConfirmBtn').disabled = true;

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const HH = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');

  const getVal = (id) => (document.getElementById(id) || {value: ''}).value.trim();

  const payload = {
    action: 'addNew',
    'ชื่อ นามสกุล':    name,
    'รหัสประจำตัว':    getVal('modal-รหัสประจำตัว'),
    'เลขบัตรประชาชน':  getVal('modal-เลขบัตรประชาชน'),
    'แผนก':            getVal('modal-แผนก'),
    'ตำแหน่ง':         getVal('modal-ตำแหน่ง'),
    'ชั้นปี':          getVal('modal-ชั้นปี'),
    'สาขา':            getVal('modal-สาขา'),
    'ห้อง':            getVal('modal-ห้อง'),
    'โปรแกรม':         getVal('modal-โปรแกรม'),
    'Customer':        getVal('modal-Customer'),
    'หมายเหตุ':       getVal('modal-หมายเหตุ'),
    'วันที่ลงทะเบียน': `${dd}/${mm}/${yyyy}`,
    'เวลาลงทะเบียน':  `${HH}:${min}`
  };

  let result;
  try {
    result = await appScriptRequest(payload);
  } catch (err) {
    setModalStatus(err.message || 'เชื่อมต่อไม่สำเร็จ', false);
    $('#modalConfirmBtn').disabled = false;
    return;
  }

  if (!result.ok) {
    setModalStatus(result.message || 'บันทึกไม่สำเร็จ', false);
    $('#modalConfirmBtn').disabled = false;
    return;
  }

  $('#modalConfirmBtn').disabled = false;
  closeAddNewModal();
  setStatus('เพิ่มรายชื่อเรียบร้อย');
  loadQueue();
}

function setModalStatus(msg, ok = true) {
  const el = $('#modalStatus');
  el.textContent = msg;
  el.style.color = ok ? '#087d86' : '#c63742';
}

// ─────────────────────────────────────────────────────────────

function appScriptRequest(params) {
  if (!APP_SCRIPT_URL || APP_SCRIPT_URL.includes('PASTE_')) {
    return Promise.resolve({ ok: false, message: 'กรุณาตั้งค่า APP_SCRIPT_URL ใน app.js' });
  }

  return new Promise((resolve, reject) => {
    const callbackName = `appScriptCallback_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const url = new URL(APP_SCRIPT_URL);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value || ''));
    url.searchParams.set('callback', callbackName);

    const script = document.createElement('script');
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('Apps Script ไม่ตอบสนอง'));
    }, 20000);

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('เชื่อมต่อ Apps Script ไม่สำเร็จ'));
    };

    function cleanup() {
      window.clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

function setStatus(message, ok = true) {
  const el = $('#connectionStatus');
  el.textContent = message;
  el.style.color = ok ? '#087d86' : '#c63742';
  el.style.borderColor = ok ? '#bee1e8' : '#ffc3c7';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function loadQueue() {

  try {

    const result = await appScriptRequest({
      action:'queue'
    });

    if(!result.ok) return;

    const tbody =
      document.getElementById('queueTableBody');

    const registerEl = document.getElementById('register');
    if (registerEl) registerEl.value = result.count || 0;

    const addnewEl = document.getElementById('addnew');
    if (addnewEl) addnewEl.value = result.addNewCount || 0;

    tbody.innerHTML = result.rows.map(row => `
      <tr>
        <td class="text-center">${row.sequence}</td>
        <td class="text-center">${row.hn}</td>
        <td class="text-start">${row.name}</td>
        <td class="text-center">${row.date}</td>
        <td class="text-center">${row.time}</td>
      </tr>
    `).join('');

  } catch(err) {
    console.error(err);
  }
}

function hideReportModal() {
    document.getElementById("reportModal").style.display = "none";
}

function openReportModal() {
    document.getElementById("reportModal").style.display = "flex";
}
// ── Follow / Report Page ──────────────────────────────────────
let followHeaders = [];
let followRows = [];

async function loadFollowData() {
  const tbody = document.getElementById('followTableBody');
  tbody.innerHTML = '<tr><td colspan="13" class="follow-empty">กำลังโหลดข้อมูล...</td></tr>';

  let result;
  try {
    result = await appScriptRequest({ action: 'getFollowData' });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="13" class="follow-empty">เชื่อมต่อไม่สำเร็จ</td></tr>';
    return;
  }

  if (!result.ok) {
    tbody.innerHTML = `<tr><td colspan="13" class="follow-empty">${escapeHtml(result.message || 'โหลดข้อมูลไม่สำเร็จ')}</td></tr>`;
    return;
  }

  followHeaders = result.headers || [];
  followRows = result.rows || [];

  renderFollowHeader();
  renderFollowTable(followRows);
}

function renderFollowHeader() {
  const headerRow = document.getElementById('followHeaderRow');
  const filterRow = document.getElementById('followFilterRow');

  headerRow.innerHTML = followHeaders.map(h => `<th>${escapeHtml(h)}</th>`).join('');

  filterRow.innerHTML = followHeaders.map((h, idx) => `
    <th>
      <label class="follow-filter-empty">
        <input type="checkbox" class="follow-filter-checkbox" data-col="${idx}" />
        ว่าง
      </label>
    </th>
  `).join('');

  filterRow.querySelectorAll('.follow-filter-checkbox').forEach(input => {
    input.addEventListener('change', applyFollowFilters);
  });
}

function applyFollowFilters() {
  const emptyCols = [];
  document.querySelectorAll('#followFilterRow .follow-filter-checkbox').forEach(input => {
    if (input.checked) emptyCols.push(input.dataset.col);
  });

  const filtered = emptyCols.length === 0
    ? followRows
    : followRows.filter(row =>
        emptyCols.every(colIdx => String(row[colIdx] || '').trim() === '')
      );

  renderFollowTable(filtered);
}

function renderFollowTable(rows) {
  const tbody = document.getElementById('followTableBody');

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${followHeaders.length}" class="follow-empty">ไม่พบข้อมูล</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(row => `
    <tr>
      ${row.map((cell, idx) => {
        const isMark = idx >= 3 && cell.trim().toLowerCase() === 'x';
        const cls = isMark ? ' class="mark-x"' : '';
        return `<td${cls}>${escapeHtml(cell)}</td>`;
      }).join('')}
    </tr>
  `).join('');
}
