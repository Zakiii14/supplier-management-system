const { registerStdFonts } = require("pdfkit");
const HelveticaModule = require("pdfkit/standard-fonts/Helvetica");
const HelveticaBoldModule = require(
  "pdfkit/standard-fonts/HelveticaBold"
);
const HelveticaObliqueModule = require(
  "pdfkit/standard-fonts/HelveticaOblique"
);
const HelveticaBoldObliqueModule = require(
  "pdfkit/standard-fonts/HelveticaBoldOblique"
);

const unwrapModule = (value) => value?.default || value;

registerStdFonts(
  unwrapModule(HelveticaModule),
  unwrapModule(HelveticaBoldModule),
  unwrapModule(HelveticaObliqueModule),
  unwrapModule(HelveticaBoldObliqueModule)
);
