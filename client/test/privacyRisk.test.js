import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPrivacyRisk } from '../src/privacyRisk.js';

test('risk levels are deterministic and explain contributing categories', () => {
  const risk = assessPrivacyRisk({ detections: [{ category: 'email' }, { category: 'phone' }] });
  assert.equal(risk.level, 'Medium');
  assert.deepEqual(risk.contributingCategories.map(({ category }) => category), ['email', 'phone']);
  assert.ok(risk.recommendations.some((item) => item.includes('email')));
});

test('identifiers can raise the estimate to high', () => {
  assert.equal(assessPrivacyRisk({ detections: [{ category: 'identifier' }, { category: 'email' }, { category: 'phone' }] }).level, 'High');
});

test('zero matches are not described as safe and incomplete OCR raises the minimum risk', () => {
  const empty = assessPrivacyRisk({ detections: [], pagesExpected: 2, pagesScanned: 2 });
  assert.equal(empty.level, 'Low');
  assert.match(empty.noDetectionWarning, /does not mean the file is safe/);
  const incomplete = assessPrivacyRisk({ detections: [], pagesExpected: 2, pagesScanned: 1 });
  assert.equal(incomplete.level, 'Medium');
  assert.equal(incomplete.coverageComplete, false);
  assert.ok(incomplete.recommendations.some((item) => item.includes('incomplete')));
});
