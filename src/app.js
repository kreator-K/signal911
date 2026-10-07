/* Signal911: a fully local, synthetic dispatcher decision-support walkthrough. */
(function () {
  'use strict';
  const engine = window.SignalEngine;
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const calls = [
    {
      id: 'CALL-201', time: '10:02:14', minute: 602, location: '245 Main Street', incidentType: 'fire',
      title: 'Smoke pouring from a building', summary: 'Caller sees heavy smoke at 245 Main Street.',
      transcript: 'There is smoke pouring out of the apartments at 245 Main Street. I think the building is on fire.',
      step: '01 / DUPLICATE DETECTION', story: 'Same address, same incident type, same time window. Suggest a link instead of creating a second fire incident.',
      ideal: 'link'
    },
    {
      id: 'CALL-202', time: '10:03:08', minute: 603, location: '245 Main St.', incidentType: 'fire',
      title: 'Child trapped on the third floor', summary: 'Caller reports a child trapped inside the fire.',
      transcript: "My daughter is trapped on the third floor at 245 Main Street. There's smoke everywhere. She can't get out!",
      step: '02 / CRITICAL UPDATE', story: 'This matches the same fire, but the trapped-person detail requires immediate attention. A duplicate can still be urgent.',
      ideal: 'link'
    },
    {
      id: 'CALL-203', time: '10:04:20', minute: 604, location: '3rd & Pine', incidentType: 'medical',
      title: 'Unresponsive person nearby', summary: 'An unrelated medical emergency is reported.',
      transcript: "I'm at Third and Pine. A man collapsed on the sidewalk and he isn't breathing. Please send help!",
      step: '03 / SEPARATE EMERGENCY', story: 'Different location and incident type. Do not force this call into the existing fire incident; surface the urgent condition.',
      ideal: 'new'
    },
    {
      id: 'CALL-204', time: '10:05:47', minute: 605, location: '247 Main Street', incidentType: 'fire',
      title: 'Explosion at nearby building', summary: 'Possible explosion reported at a neighboring address.',
      transcript: 'Something exploded by the building at 247 Main Street. I see flames and people running!',
      step: '04 / AMBIGUOUS MATCH', story: 'Same street and incident category, but a different address. The system flags uncertainty; the operator decides.',
      ideal: 'new'
    },
    {
      id: 'CALL-205', time: '10:06:30', minute: 606, location: '245 Main St', incidentType: 'fire',
      title: 'Additional report of original fire', summary: 'A fifth caller reports the already-known building fire.',
      transcript: 'I am across the road from 245 Main Street. There is a fire at that building, lots of smoke.',
      step: '05 / REPEAT AT SCALE', story: 'A repeat report adds corroboration without hiding any new urgent information. Close out the surge walkthrough.',
      ideal: 'link'
    }
  ];
  const freshIncident = () => ({ id: 'INC-102', title: 'Structure fire', incidentType: 'fire', location: '245 Main St', minute: 600, reports: ['INITIAL-100'], urgent: false, needsAck: false, status: 'Dispatch notified', notes: [] });
  let state;
  let autoplay = false;
  let timers = [];
  let toastTimer;

  function stopAutoplay() {
    timers.forEach(clearTimeout); timers = [];
    autoplay = false;
    $('autoButton').innerHTML = '▶ <span>Auto-play scenario</span>';
  }
  function reset(silent = false) {
    stopAutoplay();
    state = { index: 0, reports: [], incidents: [freshIncident()], selectedId: null, filter: 'all', view: 'dashboard', nextIncident: 103,
      log: [{ time: '10:00:00', label: 'Initial context', text: 'INC-102 · Structure fire at 245 Main St already active. Dispatcher remains in control.' }] };
    render();
    if (!silent) toast('Scenario reset to the initial incident.');
  }
  function log(label, text, time) {
    state.log.unshift({ time: time || (state.reports[0]?.time || '10:00:00'), label, text });
  }
  function addNextCall() {
    if (state.index >= calls.length) return;
    const input = calls[state.index];
    const classification = engine.classifyReport(input, state.incidents);
    const item = { ...input, classification, status: 'pending', decision: null, incidentId: null };
    state.reports.unshift(item);
    state.index++;
    state.selectedId = item.id;
    const kindText = classification.kind === 'related' ? `Suggested link to ${classification.match.incidentId}` : classification.kind === 'uncertain' ? `Ambiguous match to ${classification.match.incidentId}` : 'Possible new incident';
    log('System suggestion', `${item.id}: ${kindText}. ${classification.priority.urgent ? 'URGENT life-safety signal surfaced.' : 'No defined red-flag phrase detected.'}`, item.time);
    if (classification.priority.urgent) toast(`Urgent signal detected: ${item.id} — review now`, true);
    else toast(`Incoming report ${item.id} classified for review.`);
    showView('dashboard', false);
    render();
  }
  function resolveReport(reportId, decision, fromAuto = false) {
    const report = state.reports.find(r => r.id === reportId);
    if (!report || report.status !== 'pending') return;
    const match = report.classification.match;
    if (decision === 'link' && (!match || !state.incidents.some(i => i.id === match.incidentId))) return;
    let incident;
    if (decision === 'link') {
      incident = state.incidents.find(i => i.id === match.incidentId);
      incident.reports.push(report.id);
      if (report.classification.priority.urgent) incident.notes.push(`${report.id}: ${report.classification.priority.signals.join('; ')}`);
      report.decision = 'Linked to existing incident';
      log('Dispatcher decision', `${report.id} linked to ${incident.id}.${report.classification.priority.urgent ? ' Critical update preserved and escalated.' : ' Related report retained.'}`, report.time);
    } else {
      incident = { id: `INC-${state.nextIncident++}`, title: report.incidentType === 'medical' ? 'Medical emergency' : 'Reported fire / explosion',
        incidentType: report.incidentType, location: report.location, minute: report.minute, reports: [report.id], urgent: false, needsAck: false,
        status: 'Requires dispatcher action', notes: [] };
      if (report.classification.priority.urgent) incident.notes.push(`${report.id}: ${report.classification.priority.signals.join('; ')}`);
      state.incidents.push(incident);
      report.decision = 'Created separate incident';
      log('Dispatcher decision', `${report.id} opened as ${incident.id}; not merged with ${match?.incidentId || 'another case'}.`, report.time);
    }
    if (report.classification.priority.urgent) { incident.urgent = true; incident.needsAck = true; incident.status = 'URGENT · attention needed'; }
    report.incidentId = incident.id;
    report.status = 'reviewed';
    if (!fromAuto) toast(report.classification.priority.urgent ? `Urgent detail retained in ${incident.id}.` : `${report.id} reviewed: ${incident.id}.`, report.classification.priority.urgent);
    render();
  }
  function acknowledgeIncident(id) {
    const incident = state.incidents.find(i => i.id === id);
    if (!incident || !incident.needsAck) return;
    incident.needsAck = false;
    incident.status = 'Urgency acknowledged · follow protocol';
    log('Operator acknowledgement', `${id} urgent flag acknowledged in the demo. This is NOT an emergency dispatch action.`);
    render(); toast(`${id}: alert acknowledged in demo. No real dispatch action taken.`);
  }
  function showView(name, rerender = true) {
    if (!['dashboard', 'incidents', 'audit'].includes(name)) return;
    state.view = name;
    if (rerender) render();
  }
  function selectedReport() { return state.reports.find(r => r.id === state.selectedId) || null; }
  function kindBadge(report) {
    const kind = report.classification.kind;
    const name = kind === 'related' ? 'Potential duplicate' : kind === 'uncertain' ? 'Uncertain match' : 'New incident';
    return `<span class="tag ${kind === 'related' ? 'duplicate' : kind === 'uncertain' ? 'review' : ''}">${name}</span>`;
  }
  function renderMetrics() {
    const reports = state.reports;
    $('metricReports').textContent = reports.length;
    $('metricDuplicates').textContent = reports.filter(r => r.classification.kind === 'related').length;
    $('metricUrgent').textContent = reports.filter(r => r.classification.priority.urgent).length;
    $('metricPending').textContent = reports.filter(r => r.status === 'pending').length;
    $('feedCount').textContent = reports.length;
    $('navIncidentCount').textContent = state.incidents.length;
  }
  function renderScenario() {
    const current = selectedReport();
    const completed = state.index === calls.length && state.reports.every(r => r.status === 'reviewed');
    if (completed) {
      $('scenarioTitle').textContent = 'Walkthrough complete — every report reviewed';
      $('scenarioDescription').textContent = 'Duplicates linked, urgent updates surfaced, unrelated and ambiguous emergencies kept distinct.';
    } else if (current) {
      $('scenarioTitle').textContent = current.step;
      $('scenarioDescription').textContent = current.story;
    } else {
      $('scenarioTitle').textContent = 'Ready to simulate a call surge';
      $('scenarioDescription').textContent = 'One active structure fire. Five incoming reports. Follow each classification and dispatcher decision.';
    }
    $('scenarioProgress').textContent = `${state.index} OF ${calls.length} REPORTS`;
    $('progressFill').style.width = `${(state.index / calls.length) * 100}%`;
    const button = $('nextCallButton');
    button.disabled = autoplay || state.index >= calls.length;
    button.innerHTML = state.index === 0 ? 'Start first call <span>→</span>' : state.index === calls.length ? 'All calls received ✓' : 'Receive next call <span>→</span>';
  }
  function renderFeed() {
    const items = state.reports.filter(r => state.filter === 'all' || (state.filter === 'pending' && r.status === 'pending') || (state.filter === 'urgent' && r.classification.priority.urgent));
    document.querySelectorAll('[data-filter]').forEach(btn => {btn.classList.toggle('active', btn.dataset.filter === state.filter); btn.setAttribute('aria-pressed', String(btn.dataset.filter === state.filter));});
    $('reportList').innerHTML = items.length ? items.map(r => {
      const selected = r.id === state.selectedId;
      return `<button type="button" class="report-item ${selected ? 'selected' : ''}" data-report="${escapeHtml(r.id)}" aria-pressed="${selected}">
        <span class="report-glyph ${r.classification.priority.urgent ? 'urgent' : ''}" aria-hidden="true">${r.classification.priority.urgent ? '!' : '⌁'}</span><span class="report-main"><span class="report-top"><strong>${escapeHtml(r.id)}</strong><span class="report-time">${escapeHtml(r.time)}</span></span>
        <span class="report-summary">${escapeHtml(r.title)}</span><span class="tag-line">${r.classification.priority.urgent ? '<span class="tag urgent">! URGENT</span>' : ''}${kindBadge(r)}${r.status === 'reviewed' ? '<span class="tag done">✓ Reviewed</span>' : ''}</span></span></button>`;
    }).join('') : `<div class="empty-state"><div class="empty-icon">◎</div><strong>${state.reports.length ? 'No reports in this filter' : 'Waiting for the first call'}</strong><p>${state.reports.length ? 'Select another filter to see the remaining reports.' : 'Start the scenario to see how incoming reports are classified.'}</p></div>`;
  }
  function renderReview() {
    const report = selectedReport();
    if (!report) {
      $('reviewIndicator').textContent = 'NO SELECTION';
      $('reviewContent').innerHTML = '<div class="empty-state review-empty"><div class="empty-icon">◇</div><strong>Select an incoming report</strong><p>Matching evidence, urgency signals, and review actions appear here.</p></div>';
      return;
    }
    const { classification: c } = report;
    const kindText = c.kind === 'related' ? `Related to ${c.match.incidentId}` : c.kind === 'uncertain' ? `Possible match to ${c.match.incidentId}` : 'New incident suggested';
    $('reviewIndicator').textContent = report.status === 'reviewed' ? 'REVIEW COMPLETE' : 'REVIEW REQUIRED';
    const evidence = c.match ? c.match.evidence : [
      c.nearest ? `Nearest incident score: ${c.nearest.score}/100 — below the review threshold` : 'No active incident available',
      'No strong evidence of an existing matching incident',
      'Separate case recommended; operator retains final decision'
    ];
    const urgencyReasons = c.priority.signals.map(x => `<div class="evidence-item"><span class="warn">!</span>${escapeHtml(x)}</div>`).join('');
    const actions = report.status === 'reviewed'
      ? `<div class="resolution"><strong>✓ Operator decision recorded</strong>${escapeHtml(report.decision)} · ${escapeHtml(report.incidentId)}. Original report and urgency flag remain available for review.</div>${state.incidents.find(i=>i.id===report.incidentId)?.needsAck ? `<div class="review-actions"><button class="btn btn-danger" data-ack="${escapeHtml(report.incidentId)}">Acknowledge urgent flag</button></div>` : ''}`
      : `<div class="review-actions">${c.match ? `<button class="btn btn-primary" data-decision="link" data-id="${escapeHtml(report.id)}">Confirm link to ${escapeHtml(c.match.incidentId)}</button>` : ''}<button class="btn ${c.match ? 'btn-outline' : 'btn-primary'}" data-decision="new" data-id="${escapeHtml(report.id)}">${c.match ? 'Keep as separate incident' : 'Create new incident'}</button></div><p class="review-note">${c.kind === 'uncertain' ? 'Address differs: do not merge without operator verification. ' : ''}No automated dispatch, call termination, or call suppression occurs.</p>`;
    $('reviewContent').innerHTML = `<div class="review-header"><div><span class="review-overline">${escapeHtml(report.id)} · INBOUND REPORT</span><h2>${escapeHtml(report.title)}</h2></div>${c.priority.urgent ? '<span class="tag urgent">! URGENT</span>' : '<span class="tag">STANDARD REVIEW</span>'}</div>
      <div class="review-meta"><span>⌖ ${escapeHtml(report.location)}</span><span>◷ ${escapeHtml(report.time)}</span><span>◈ ${escapeHtml(report.incidentType.toUpperCase())}</span></div>
      ${c.priority.urgent ? `<div class="review-alert"><strong>! Immediate attention suggested</strong><p>Life-safety phrase detected. Preserve and escalate this information whether the report is linked or separate.</p></div>` : ''}
      <div class="section-label">CALLER TRANSCRIPT · SYNTHETIC</div><div class="transcript">${escapeHtml(report.transcript)}</div>
      <div class="section-label">INDEPENDENT CLASSIFICATION</div><div class="classification"><div class="class-cell"><small>INCIDENT RELATION</small><strong>${escapeHtml(kindText)}</strong><div class="match-score">${c.match ? `Heuristic score ${c.match.score}/100` : 'No strong match'}</div></div><div class="class-cell"><small>URGENCY SCREEN</small><strong style="color:${c.priority.urgent ? 'var(--coral)' : 'var(--text)'}">${escapeHtml(c.priority.label)}</strong><div class="match-score">${c.priority.urgent ? `${c.priority.signals.length} defined red flag(s)` : 'No defined red flag detected'}</div></div></div>
      <div class="section-label">WHY THE SYSTEM SUGGESTED THIS</div><div class="evidence">${evidence.map(item => `<div class="evidence-item"><span class="check">✓</span>${escapeHtml(item)}</div>`).join('')}${urgencyReasons}</div>${actions}`;
  }
  function renderIncidents() {
    $('compactIncidents').innerHTML = state.incidents.slice().reverse().slice(0,3).map(i => `<div class="compact-incident"><span class="incident-dot ${i.urgent ? 'urgent' : ''}"></span><div class="incident-desc"><strong>${escapeHtml(i.id)} · ${escapeHtml(i.title)}</strong><p>${escapeHtml(i.location)} · ${i.reports.length} source report(s)</p></div><span class="small-pill">${i.needsAck ? 'Urgent' : 'Active'}</span></div>`).join('');
    $('incidentBoard').innerHTML = state.incidents.map(i => `<article class="incident-card"><div class="incident-card-top"><span class="review-overline">${escapeHtml(i.id)}</span><span class="tag ${i.urgent ? 'urgent' : 'done'}">${i.urgent ? 'URGENT' : 'ACTIVE'}</span></div><h2>${escapeHtml(i.title)}</h2><p>⌖ ${escapeHtml(i.location)}<br />${escapeHtml(i.status)}</p>${i.needsAck ? `<div class="review-actions"><button class="btn btn-danger btn-small" data-ack="${escapeHtml(i.id)}">Acknowledge urgent flag</button></div>` : ''}<h3>Linked reports (${i.reports.length})</h3><ul>${i.reports.map(id => `<li>${escapeHtml(id)}${id === 'INITIAL-100' ? ' · Original case before simulated surge' : ''}</li>`).join('')}</ul>${i.notes.length ? `<h3>Preserved life-safety updates</h3><ul>${i.notes.map(n=>`<li>${escapeHtml(n)}</li>`).join('')}</ul>` : ''}</article>`).join('');
  }
  function renderLog() {
    const entries = state.log;
    $('miniLog').innerHTML = entries.slice(0,3).map(e => `<div class="mini-log-entry"><span class="log-time">${escapeHtml(e.time.slice(0,5))}</span><p>${escapeHtml(e.text)}</p></div>`).join('');
    $('fullLog').innerHTML = entries.map(e => `<div class="full-log-row"><span class="timestamp">${escapeHtml(e.time)}</span><span class="log-event">${escapeHtml(e.label)}</span><span class="log-text">${escapeHtml(e.text)}</span></div>`).join('');
  }
  function render() {
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('is-active', v.id === `${state.view}View`));
    document.querySelectorAll('[data-view]').forEach(b => {b.classList.toggle('active', b.dataset.view === state.view); b.setAttribute('aria-current', b.dataset.view === state.view ? 'page' : 'false');});
    renderMetrics(); renderScenario(); renderFeed(); renderReview(); renderIncidents(); renderLog();
    const done = state.index === calls.length && state.reports.every(r => r.status === 'reviewed');
    if (done && !$('endSummary')) {
      const box = document.createElement('div'); box.id = 'endSummary'; box.className = 'end-summary';
      box.innerHTML = `<strong>✓ All 5 incoming reports handled</strong><p>${state.reports.filter(r=>r.decision==='Linked to existing incident').length} reports linked; ${state.incidents.length - 1} new incident(s) created; ${state.reports.filter(r=>r.classification.priority.urgent).length} urgent signal(s) preserved. Inspect the incident board or full log to verify each decision.</p>`;
      $('reviewContent').appendChild(box);
    }
  }
  function toast(message, urgent = false) {
    const box = document.createElement('div');
    box.className = `toast${urgent ? ' is-urgent' : ''}`; box.setAttribute('role','status'); box.textContent = message;
    $('toastRegion').replaceChildren(box);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => box.remove(), 3500);
  }
  // Every action in auto-play is a scripted *simulated operator decision*, never an autonomous live triage action.
  function runAutoplay() {
    if (autoplay) { stopAutoplay(); toast('Auto-play paused. Continue manually or replay from the start.'); render(); return; }
    reset(true); autoplay = true;
    $('autoButton').innerHTML = 'Ⅱ <span>Pause demo</span>';
    function round(index) {
      if (!autoplay) return;
      if (index >= calls.length) {
        stopAutoplay(); render(); toast('Full walkthrough complete. Inspect the incident board and decision log.'); return;
      }
      addNextCall();
      timers.push(setTimeout(() => {
        if (!autoplay) return;
        const report = state.reports.find(r => r.id === calls[index].id);
        if (report) resolveReport(report.id, calls[index].ideal, true);
        timers.push(setTimeout(() => round(index+1), 850));
      }, 1600));
    }
    round(0);
    render();
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.view) showView(button.dataset.view);
    else if (button.dataset.goto) showView(button.dataset.goto);
    else if (button.dataset.filter) { state.filter = button.dataset.filter; render(); }
    else if (button.dataset.report) { state.selectedId = button.dataset.report; state.view = 'dashboard'; render(); }
    else if (button.dataset.decision) { if (autoplay) stopAutoplay(); resolveReport(button.dataset.id, button.dataset.decision); }
    else if (button.dataset.ack) acknowledgeIncident(button.dataset.ack);
  });
  $('nextCallButton').addEventListener('click', () => { if (!autoplay) addNextCall(); });
  $('resetButton').addEventListener('click', () => reset());
  $('autoButton').addEventListener('click', runAutoplay);
  reset(true);
})();