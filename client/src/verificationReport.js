import { assessPrivacyRisk } from './privacyRisk.js';

async function sha256(blob) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildVerificationReport({ work, counts, output, checks = [] }) {
  const regionsSelected = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const expectedPages = work.kind === 'pdf' ? work.pages.length : 1;
  const risk = assessPrivacyRisk({
    detections: (work.detections || []).filter((item) => item.selected),
    manual: (work.manual || []).filter((item) => item.selected),
    pagesExpected: expectedPages,
    pagesScanned: work.pagesScanned ?? expectedPages,
  });
  const verified = checks.length > 0;
  return {
    reportVersion: 1,
    generatedAt: new Date().toISOString(),
    inputFormat: work.kind === 'pdf' ? 'PDF' : (work.inputFormat === 'jpeg' ? 'JPEG' : 'PNG'),
    regionsSelected,
    counts: { email: counts.email, phone: counts.phone, identifier: counts.identifier, manual: counts.manual },
    beforeRedactionRisk: {
      level: risk.level,
      contributingCategories: risk.contributingCategories,
      recommendations: risk.recommendations,
      coverageComplete: risk.coverageComplete,
      estimateLabel: risk.estimateLabel,
      noDetectionWarning: risk.noDetectionWarning,
    },
    outputFormat: output.type === 'application/pdf' ? 'PDF' : 'PNG',
    postRedactionVerification: {
      status: verified ? 'verified' : 'failed',
      completedChecks: checks,
      failedChecks: verified ? [] : ['Server verification marker was missing.'],
      notPerformedChecks: [
        'OCR cannot prove that every sensitive detail was detected or covered.',
        'No external or semantic review of visible page content was performed.',
      ],
    },
    metadataInspection: {
      complete: Boolean(work.metadataComplete),
      categories: (work.metadataRows || []).map(({ category, found, removalSupported }) => ({
        category, valueFound: Boolean(found), removalSupported: Boolean(removalSupported),
        removalVerified: verified && checks.includes('source-metadata-not-carried'),
      })),
    },
    warnings: [
      ...(!risk.coverageComplete ? ['OCR coverage is incomplete.'] : []),
      ...(!work.metadataComplete ? ['Metadata inspection was incomplete or unavailable.'] : []),
      ...(risk.noDetectionWarning ? [risk.noDetectionWarning] : []),
      'Visible content has not been semantically checked; human review is required.',
    ],
    outputSha256: await sha256(output),
    humanReviewRequired: true,
    integrityHashNote: 'SHA-256 helps verify that this output file has not changed; it does not prove the file contains no sensitive information.',
    privacyNote: 'This report contains no source filename, OCR text, or field values.',
  };
}
