// Keep PDFKit's standard font modules as static dependencies so Vercel's
// file tracer includes them in the serverless function bundle. PDFKit's
// Node build loads these modules dynamically when a standard font is used.
require("pdfkit/standard-fonts/Helvetica");
require("pdfkit/standard-fonts/HelveticaBold");
require("pdfkit/standard-fonts/HelveticaOblique");
require("pdfkit/standard-fonts/HelveticaBoldOblique");
