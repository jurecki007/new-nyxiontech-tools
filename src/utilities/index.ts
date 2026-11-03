// The dashboard tool registry. To add a tool, write a `Utility` (see types.ts and
// ui.tsx for the shared building blocks) and list it here; the sidebar, the
// dashboard grid and the URL route (#/tool/<id>) pick it up.
import { backgroundUtility } from './background';
import { compareUtility } from './compare';
import { compressUtility, imagesToPdfUtility, pdfToImagesUtility, pdfToTextUtility } from './convert';
import { editUtility, metadataUtility, organizeUtility, pageNumbersUtility, signUtility, watermarkUtility } from './edit';
import { formsUtility } from './forms';
import { heicUtility, imageConverterUtility } from './images';
import { ocrUtility } from './ocr';
import { pdfToWordUtility, wordToPdfUtility } from './office';
import { mergeUtility, rotateUtility, splitUtility } from './organize';
import { qrUtility } from './qr';
import { redactUtility } from './redact';
import { protectUtility, unlockUtility } from './security';
import type { Utility } from './types';

export const UTILITIES: Utility[] = [
  editUtility,
  signUtility,
  formsUtility,
  pageNumbersUtility,
  watermarkUtility,
  metadataUtility,
  mergeUtility,
  splitUtility,
  organizeUtility,
  rotateUtility,
  compressUtility,
  ocrUtility,
  imagesToPdfUtility,
  pdfToImagesUtility,
  pdfToTextUtility,
  pdfToWordUtility,
  wordToPdfUtility,
  protectUtility,
  unlockUtility,
  redactUtility,
  compareUtility,
  imageConverterUtility,
  backgroundUtility,
  heicUtility,
  qrUtility,
];

export const getUtility = (id: string) => UTILITIES.find((u) => u.id === id);

export { UTILITY_GROUPS } from './types';
export type { Utility, UtilityContext } from './types';
