import sharp from 'sharp';
const svg = `<svg width="1200" height="700" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f3f6f2"/><rect x="100" y="70" width="1000" height="560" rx="24" fill="#ffffff" stroke="#dfe8e2" stroke-width="4"/><text x="150" y="155" font-family="Arial" font-size="32" fill="#23735d" font-weight="700">SYNTHETIC OCR TEST — FABRICATED DATA</text><text x="150" y="270" font-family="Arial" font-size="36" fill="#172b3a">Email: alex@example.com</text><text x="150" y="365" font-family="Arial" font-size="36" fill="#172b3a">Phone: 202-555-0147</text><text x="150" y="460" font-family="Arial" font-size="36" fill="#172b3a">ID: DEMO-482731</text><text x="150" y="565" font-family="Arial" font-size="22" fill="#74858e">All names and values are fictional test data.</text></svg>`;
const output = process.argv[2] || 'sample-synthetic.png';
await sharp(Buffer.from(svg)).png().toFile(output);
console.log(`Created fabricated sample image: ${output}`);
