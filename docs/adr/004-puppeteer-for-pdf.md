# ADR-004: Puppeteer (HTML→PDF) over JasperReports

**Date**: 2024-01 | **Status**: Accepted

## Context

The system generates formatted PDFs: account statements and FD certificates.

Options:
1. **JasperReports** — Java-based; used in MIFOS, Finacle, many CBS platforms
2. **PDFKit / pdf-lib** — Node.js programmatic PDF construction
3. **Puppeteer** — headless Chrome; renders HTML to PDF

## Decision

**Puppeteer.**

## Reasons

**JasperReports requires a Java runtime.** In a Node.js app this means a sidecar container
or HTTP call to a JasperReports server. First-hand experience (MIFOS) shows JasperReports
causes reliability issues, long startup times, and complex `.jrxml` template management.

**PDFKit/pdf-lib require pixel-coordinate layout.** Positioning elements by coordinates
is fragile — changing the statement layout means code changes with precise measurements.

**Puppeteer renders HTML.** HTML + CSS are universal skills. The statement template is
a normal HTML file — any developer can modify the layout. The ₦ symbol, Nigerian number
formatting, and table styling are trivially handled with CSS and `toLocaleString('en-NG')`.

**Logo embedding**: because Puppeteer cannot authenticate against MinIO presigned URLs,
logos are fetched server-side and embedded as base64 data URIs before the HTML is rendered.

## Configuration

```bash
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

Launch flags in Docker: `--no-sandbox` (required when running as root).
In production: run container as non-root user and remove `--no-sandbox`.

## Consequences

- Chromium binary adds ~150 MB to Docker image. Use `puppeteer-core` + system Chromium
  to avoid bundling the browser inside the image.
- PDF generation is synchronous and CPU-intensive. For high volume, add a
  `StatementGenerationQueue` (RabbitMQ) so PDF jobs don't block API threads.
- Generated PDFs stored in MinIO, served via presigned URL — never streamed from app server.
