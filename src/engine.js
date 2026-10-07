/* Signal911 — intentionally transparent prototype heuristics, NOT certified triage logic. */
(function (root, factory) {
  const engine = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = engine;
  if (root) root.SignalEngine = engine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const RED_FLAGS = [
    { re: /\b(trapped|can't get out|cannot get out|stuck inside)\b/i, label: 'Possible entrapment / unable to escape' },
    { re: /\b(not breathing|isn.t breathing|stopped breathing|unconscious|unresponsive)\b/i, label: 'Possible respiratory or consciousness emergency' },
    { re: /\b(explosion|exploded|active shooter|shots fired)\b/i, label: 'Possible immediate life-safety threat' },
    { re: /\b(severe bleeding|bleeding heavily|can.t breathe|cannot breathe)\b/i, label: 'Possible life-threatening injury' }
  ];
  function normalizeLocation(value) {
    return String(value || '').toLowerCase()
      .replace(/\bstreet\b/g, 'st').replace(/\bavenue\b/g, 'ave').replace(/\broad\b/g, 'rd')
      .replace(/\bboulevard\b/g, 'blvd').replace(/\bthird\b/g, '3rd')
      .replace(/\band\b/g, '&').replace(/[.,#]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function streetOf(value) {
    return normalizeLocation(value).replace(/^\d+\s+/, '').replace(/\s+(apt|unit|floor)\s+\w+.*$/, '').trim();
  }
  function findUrgency(report) {
    const text = `${report.transcript || ''} ${report.summary || ''}`;
    const found = RED_FLAGS.filter(s => s.re.test(text)).map(s => s.label);
    return { urgent: found.length > 0, signals: [...new Set(found)], label: found.length ? 'Immediate review' : 'Standard review' };
  }
  function compareReport(report, incident) {
    const currentLocation = normalizeLocation(report.location);
    const knownLocation = normalizeLocation(incident.location);
    const exactLocation = !!currentLocation && currentLocation === knownLocation;
    const sameStreet = !exactLocation && !!currentLocation && !!knownLocation &&
      streetOf(currentLocation) === streetOf(knownLocation) && /\d/.test(currentLocation) && /\d/.test(knownLocation);
    const sameType = report.incidentType === incident.incidentType;
    const delta = Math.abs(Number(report.minute) - Number(incident.minute));
    const recent = Number.isFinite(delta) && delta <= 15;
    // Weights are a demo sorting heuristic, not calibrated probabilities.
    const score = (exactLocation ? 65 : (sameStreet ? 24 : 0)) + (sameType ? 25 : 0) + (recent ? 10 : 0);
    const evidence = [
      exactLocation ? 'Same normalized street address' : sameStreet ? 'Same street; address number differs' : 'No verified exact address match',
      sameType ? 'Same incident category' : 'Different incident category',
      recent ? 'Within the 15-minute surge window' : 'Outside the 15-minute window'
    ];
    return { incidentId: incident.id, score, exactLocation, sameStreet, sameType, recent, evidence };
  }
  function classifyReport(report, incidents) {
    const priority = findUrgency(report);
    const matches = incidents.map(i => compareReport(report, i)).sort((a, b) => b.score - a.score);
    const best = matches[0] || null;
    let kind = 'new';
    if (best && best.score >= 80 && best.exactLocation && best.sameType) kind = 'related';
    else if (best && best.score >= 45) kind = 'uncertain';
    return { kind, match: kind === 'new' ? null : best, nearest: best, priority };
  }
  return { normalizeLocation, streetOf, findUrgency, compareReport, classifyReport };
});