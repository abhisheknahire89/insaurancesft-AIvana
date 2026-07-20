import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).toString();
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

console.log("pdfjsLib legacy workerSrc set successfully to:", workerSrc);
