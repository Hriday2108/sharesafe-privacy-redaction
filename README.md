# ShareSafe

**ShareSafe: A Privacy-Preserving Personal Information Detection and Redaction System** is a student project for finding likely personal details in images and PDFs and irreversibly covering user-selected regions.

## What it does

- Registers users, hashes passwords with bcrypt, and protects private APIs with JWTs.
- Runs Tesseract OCR in the browser. OCR text is not sent to the server or saved.
- Detects likely email addresses, phone numbers, and configured `SSN`, `ID`, and `ACCOUNT` labels. Detection is a convenience, not a guarantee; manually review the image and add boxes for anything OCR misses.
- Accepts PNG, JPEG, and PDF files. PDFs are rendered locally for OCR and review; selected coordinates are applied after the server independently renders the original PDF.
- Validates image signatures through Sharp, limits images to 10 MB and 6,000 × 6,000 pixels, limits PDFs to 4 MB and 8 pages, and caps selections at 50 regions.
- Rasterizes PDF pages in memory, covers selected regions, and rebuilds a flattened, image-only PDF. The server verifies the page count, image content, and absence of searchable text before returning it. Image uploads are flattened to PNG as before.
- Stores only the user ID, timestamp, original format, and category counts for history. It never stores uploaded files, OCR text, sensitive values, or plaintext passwords.

## Requirements

- Node.js 22.13 or later (PDF.js 6 runtime requirement)
- MongoDB 6 or later (local install or a MongoDB Atlas connection string)

## Setup

1. Install dependencies from the repository root:

   ```bash
   npm run install:all
   ```

2. Copy `server/.env.example` to `server/.env`. Set `MONGODB_URI` and a random `JWT_SECRET` of at least 32 characters. `CLIENT_ORIGIN` should match the Vite origin (`http://localhost:5173` by default). Keep `.env` private.

3. Optionally copy `client/.env.example` to `client/.env` and set `VITE_API_URL` (default `http://localhost:4000`).

4. Start MongoDB. For a local service, confirm it accepts connections at `mongodb://127.0.0.1:27017`.

5. Start both apps:

   ```bash
   npm run dev
   ```

   Open `http://localhost:5173`. The API listens on `http://localhost:4000`.

6. Create a fabricated test image (never use real identity documents):

   ```bash
   npm --prefix server run sample
   ```

   The generated `sample-synthetic.png` is ignored by Git. You can also choose an image you create yourself.

## Checks

```bash
npm test
npm run build
```

The server tests use Node's built-in test runner and exercise redaction pixels, region validation, API validation, auth gates, and CORS policy. Database-backed registration and history isolation require MongoDB; start MongoDB and the API for a full local workflow. Browser UI and Tesseract require the Vite app in a browser.

## API

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public, rate limited | Create account and return JWT |
| `POST` | `/api/auth/login` | Public, rate limited | Verify credentials and return JWT |
| `GET` | `/api/health` | Public | API liveness |
| `POST` | `/api/redact` | Bearer JWT | Multipart `image` plus JSON `regions`; returns a flattened PNG or PDF |
| `GET` | `/api/history` | Bearer JWT | Return up to 100 metadata-only sessions for the signed-in user |

Each region is `{ "category": "email|phone|identifier|manual", "page": 1, "x": 0, "y": 0, "width": 100, "height": 30 }`, expressed in rendered page pixels (`page` is 1 for images). PDF uploads are limited to 4 MB and 8 pages; each rendered page is capped at 1,800 px and 2 million pixels. Images remain limited to PNG/JPEG, 10 MB, and 6,000 × 6,000 pixels. The service validates actual file signatures and every region. PDF output is image-only and checked for an empty text layer and matching page count. Review each output after download before sharing; OCR can miss sensitive content.

## Privacy notes

The scan and PDF page rendering occur locally in the browser. To redact, the original file is sent over the authenticated API in memory, processed, and not written to disk. Only history metadata is persisted. Production deployment should use HTTPS, a strong unique secret, a narrowly configured `CLIENT_ORIGIN`, a protected MongoDB connection, secure operational logging, and an explicit data-retention policy. This educational project is not a security certification or a substitute for careful human review.

## Deploy to Vercel

Deploy this repository as two Vercel projects, both connected to the same GitHub repository:

1. Create a MongoDB Atlas database and allow connections from Vercel. Use its connection URI for the API deployment; the local `127.0.0.1` URI cannot work in production.
2. Import the repository into Vercel for the API and set **Root Directory** to `server`. Keep the detected Express framework and build defaults. Add these Production (and Preview, if desired) environment variables:
   - `MONGODB_URI`: your Atlas connection string
   - `JWT_SECRET`: a new, private random value of at least 32 characters
   - `CLIENT_ORIGIN`: the exact deployed frontend origin, such as `https://sharesafe-web.vercel.app`
   - `NODE_ENV`: `production`
3. Deploy the API and confirm `https://<api-domain>/api/health` returns `{"status":"ok"}`.
4. Create a second Vercel project from the same repository with **Root Directory** set to `client`. Use the Vite framework preset and the default build command/output (`npm run build`, `dist`). Set `VITE_API_URL` to the API origin, with no trailing slash, such as `https://sharesafe-api.vercel.app`.
5. Deploy the frontend, then update the API project's `CLIENT_ORIGIN` to the final frontend origin and redeploy the API.

Vercel stores environment variables outside Git. Never add `.env` files, Atlas credentials, or JWT secrets to the repository. The frontend defaults to same-origin API requests in production only when `VITE_API_URL` is unset; for the two-project setup above, set it to the API origin.
