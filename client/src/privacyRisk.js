const CATEGORY_WEIGHT = Object.freeze({ email: 2, phone: 2, identifier: 3, manual: 1 });
const CATEGORY_LABEL = Object.freeze({ email: 'Email addresses', phone: 'Phone numbers', identifier: 'Configured identifiers', manual: 'Manual selections' });

export function assessPrivacyRisk({ detections = [], manual = [], pagesExpected = 1, pagesScanned = pagesExpected } = {}) {
  const all = [...detections, ...manual];
  const counts = Object.fromEntries(Object.keys(CATEGORY_WEIGHT).map((key) => [key, all.filter((item) => item.category === key).length]));
  const score = Object.entries(counts).reduce((sum, [category, count]) => sum + CATEGORY_WEIGHT[category] * count, 0);
  const coverageComplete = pagesExpected > 0 && pagesScanned === pagesExpected;
  const level = score >= 6 ? 'High' : score >= 2 || !coverageComplete ? 'Medium' : 'Low';
  const contributingCategories = Object.entries(counts).filter(([, count]) => count > 0).map(([category, count]) => ({
    category, label: CATEGORY_LABEL[category], count,
    reason: count + ' ' + CATEGORY_LABEL[category].toLowerCase() + ' ' + (count === 1 ? 'was' : 'were') + ' detected or selected.',
  }));
  const recommendations = [];
  if (counts.email) recommendations.push('Review each detected email address and its surrounding text.');
  if (counts.phone) recommendations.push('Review each detected phone number, including nearby labels and digits.');
  if (counts.identifier) recommendations.push('Check configured identifiers and any other account or identity numbers.');
  if (counts.manual) recommendations.push('Confirm each manually selected region fully covers the sensitive content.');
  if (all.length === 0) recommendations.push('No supported pattern was detected. Manually inspect every page; an empty scan does not establish that the file contains no personal information.');
  if (!coverageComplete) recommendations.push('OCR coverage is incomplete. Scan or manually inspect every page before redacting.');
  return {
    level, score, counts, contributingCategories, recommendations, coverageComplete,
    estimateLabel: 'Educational estimate only — not a security rating or compliance certification.',
    noDetectionWarning: all.length === 0 ? 'No patterns detected does not mean the file is safe.' : null,
  };
}
