const IMAGE_METADATA_GROUPS = [
  { category: 'Location', keys: ['GPSLatitude', 'GPSLongitude', 'GPSPosition'], explanation: 'Location tags may reveal where a photo was taken.' },
  { category: 'Device details', keys: ['Make', 'Model', 'LensModel', 'Software'], explanation: 'Camera or software details can identify a device or editing workflow.' },
  { category: 'Capture time', keys: ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'DateCreated'], explanation: 'Capture dates can reveal a schedule or timeline.' },
  { category: 'Orientation', keys: ['Orientation'], explanation: 'Orientation tags describe how the image should be displayed.' },
];
const PDF_METADATA_GROUPS = [
  { category: 'Document details', keys: ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer'], explanation: 'Document properties may identify an author or describe the file.' },
  { category: 'Document dates', keys: ['CreationDate', 'ModDate'], explanation: 'Creation and modification dates can reveal a timeline.' },
];

function rowsFor(info, groups) {
  return groups.map(({ category, keys, explanation }) => ({
    category, found: keys.some((key) => Boolean(info?.[key])),
    explanation, removalSupported: true, verifiedRemoved: null,
  }));
}

export async function inspectImageMetadata(file) {
  const exifr = await import('exifr');
  let tags = {};
  let complete = true;
  try { tags = (await exifr.parse(file, { exif: true, tiff: true, gps: true, xmp: true, iptc: true })) || {}; }
  catch { complete = false; }
  return { complete, rows: rowsFor(tags, IMAGE_METADATA_GROUPS), format: 'image' };
}

export async function inspectPdfMetadata(file) {
  const { readPdfPrivacyMetadata } = await import('./pdf.js');
  const info = await readPdfPrivacyMetadata(file);
  return {
    complete: info.complete,
    rows: rowsFor(info.info, PDF_METADATA_GROUPS).concat([
      { category: 'Embedded files', found: info.attachments > 0, explanation: 'A PDF can carry files that are not visible on its pages.', removalSupported: true, verifiedRemoved: null },
      { category: 'Annotations', found: info.annotations > 0, explanation: 'Comments and form annotations may contain information outside visible page text.', removalSupported: true, verifiedRemoved: null },
    ]),
    format: 'pdf',
  };
}
