import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVerificationReport } from '../src/verificationReport.js';

test('verification report masks source filename and field values and includes integrity hash', async () => {
  const report = await buildVerificationReport({
    work: { kind: 'image', name: 'private-person@example.test.jpg', detections: [{ category: 'email', selected: true, value: 'private-person@example.test' }], manual: [], pagesScanned: 1, metadataComplete: true, metadataRows: [{ category: 'Location', found: true, removalSupported: true }] },
    counts: { email: 1, phone: 0, identifier: 0, manual: 0 },
    output: new Blob(['synthetic-redacted-output'], { type: 'image/png' }),
    checks: ['output-is-png', 'dimensions-verified', 'source-metadata-not-carried'],
  });
  const serialized = JSON.stringify(report);
  assert.ok(report.outputSha256.length === 64);
  assert.equal(report.humanReviewRequired, true);
  assert.equal(report.postRedactionVerification.status, 'verified');
  assert.equal(report.metadataInspection.categories[0].removalVerified, true);
  assert.equal(serialized.includes('private-person@example.test'), false);
  assert.equal(serialized.includes('private-person@example.test.jpg'), false);
});

test('report marks missing server checks as failed and retains non-automated warnings', async () => {
  const report = await buildVerificationReport({
    work: { kind: 'pdf', name: 'synthetic.pdf', pages: [{}, {}], detections: [], manual: [], pagesScanned: 1, metadataComplete: false },
    counts: { email: 0, phone: 0, identifier: 0, manual: 0 },
    output: new Blob(['synthetic'], { type: 'application/pdf' }),
  });
  assert.equal(report.postRedactionVerification.status, 'failed');
  assert.ok(report.postRedactionVerification.notPerformedChecks.length);
  assert.equal(report.beforeRedactionRisk.coverageComplete, false);
  assert.equal(report.beforeRedactionRisk.noDetectionWarning, 'No patterns detected does not mean the file is safe.');
});
