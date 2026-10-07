const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeLocation, findUrgency, classifyReport, compareReport } = require('../src/engine.js');
const incident = { id: 'INC-102', incidentType: 'fire', location: '245 Main St', minute: 600 };
const makeReport = (changes={}) => ({ location:'245 Main Street', incidentType:'fire', minute:603, transcript:'There is smoke at this building.', summary:'Smoke', ...changes });

test('normalizes common address suffixes', () => {
  assert.equal(normalizeLocation('245 Main Street.'), normalizeLocation('245 MAIN St'));
});
test('identifies a related duplicate with matching location/type/time', () => {
  const result = classifyReport(makeReport(), [incident]);
  assert.equal(result.kind, 'related');
  assert.equal(result.match.incidentId, 'INC-102');
  assert.equal(result.match.score, 100);
});
test('duplicate does not suppress urgent information', () => {
  const result = classifyReport(makeReport({transcript:'My child is trapped on floor three!'}), [incident]);
  assert.equal(result.kind, 'related');
  assert.equal(result.priority.urgent, true);
  assert.match(result.priority.signals[0], /entrapment/i);
});
test('unrelated medical emergency remains a new urgent incident', () => {
  const result = classifyReport(makeReport({location:'3rd & Pine', incidentType:'medical', transcript:"He isn't breathing!"}), [incident]);
  assert.equal(result.kind, 'new');
  assert.equal(result.match, null);
  assert.equal(result.priority.urgent, true);
});
test('nearby different address must be marked uncertain, not auto-duplicate', () => {
  const result = classifyReport(makeReport({location:'247 Main St', transcript:'Something exploded and I see flames!'}), [incident]);
  assert.equal(result.kind, 'uncertain');
  assert.equal(result.priority.urgent, true);
});
test('same address but different incident type is not considered a duplicate', () => {
  const result = classifyReport(makeReport({incidentType:'medical'}), [incident]);
  assert.equal(result.kind, 'uncertain');
});
test('a report outside the time window has a lower score', () => {
  const nearby = compareReport(makeReport({minute:650}), incident);
  assert.equal(nearby.recent, false);
  assert.equal(nearby.score, 90);
});
test('low-information descriptions do not create false urgency flags', () => {
  assert.equal(findUrgency(makeReport()).urgent, false);
});
test('no active cases implies new incident, never a duplicate', () => {
  const result = classifyReport(makeReport(), []);
  assert.equal(result.kind, 'new');
  assert.equal(result.nearest, null);
});