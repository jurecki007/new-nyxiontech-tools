// Fill-in PDF forms (AcroForm) with pdf-lib.
import { PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField, type PDFField } from 'pdf-lib';
import { embedRegistryFont } from './export';
import { loadPdf } from './pdfTools';

export type FormFieldInfo =
  | { kind: 'text'; name: string; value: string; multiline: boolean; maxLength?: number; readOnly: boolean }
  | { kind: 'checkbox'; name: string; value: boolean; readOnly: boolean }
  | { kind: 'radio'; name: string; value: string; options: string[]; readOnly: boolean }
  | { kind: 'dropdown'; name: string; value: string; options: string[]; editable: boolean; readOnly: boolean }
  | { kind: 'list'; name: string; value: string[]; options: string[]; multiple: boolean; readOnly: boolean };

export type FormValues = Record<string, string | boolean | string[]>;

function describe(field: PDFField): FormFieldInfo | null {
  const name = field.getName();
  const readOnly = field.isReadOnly();
  if (field instanceof PDFTextField) {
    return { kind: 'text', name, value: field.getText() ?? '', multiline: field.isMultiline(), maxLength: field.getMaxLength(), readOnly };
  }
  if (field instanceof PDFCheckBox) return { kind: 'checkbox', name, value: field.isChecked(), readOnly };
  if (field instanceof PDFRadioGroup) return { kind: 'radio', name, value: field.getSelected() ?? '', options: field.getOptions(), readOnly };
  if (field instanceof PDFDropdown) {
    return { kind: 'dropdown', name, value: field.getSelected()[0] ?? '', options: field.getOptions(), editable: field.isEditable(), readOnly };
  }
  if (field instanceof PDFOptionList) {
    return { kind: 'list', name, value: field.getSelected(), options: field.getOptions(), multiple: field.isMultiselect(), readOnly };
  }
  // Buttons and signature fields have nothing to fill.
  return null;
}

export async function readForm(bytes: Uint8Array): Promise<FormFieldInfo[]> {
  const doc = await loadPdf(bytes);
  return doc
    .getForm()
    .getFields()
    .map(describe)
    .filter((f): f is FormFieldInfo => f !== null);
}

/**
 * Multiline fields often come with "auto" (0 pt) or an oversized font, and
 * pdf-lib then draws text that overflows the box. Shrink it so the lines fit.
 */
function fitMultiline(field: PDFTextField, text: string) {
  if (!field.isMultiline()) return;
  const rect = field.acroField.getWidgets()[0]?.getRectangle();
  if (!rect) return;
  const da = field.acroField.getDefaultAppearance() ?? '';
  const size = Number(/([\d.]+)\s+Tf/.exec(da)?.[1] ?? 0);
  const lines = Math.max(1, text.split('\n').length);
  const fit = Math.max(6, Math.min(12, (rect.height - 4) / (lines * 1.2)));
  if (size === 0 || size > fit) field.setFontSize(fit);
}

/**
 * Writes the values and regenerates field appearances with a font that has
 * Polish characters. With `flatten`, fields become ordinary page content.
 */
export async function fillForm(bytes: Uint8Array, values: FormValues, flatten: boolean): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  const form = doc.getForm();
  for (const field of form.getFields()) {
    const name = field.getName();
    if (!(name in values) || field.isReadOnly()) continue;
    const v = values[name];
    if (field instanceof PDFTextField) {
      field.setText(String(v) || undefined);
      fitMultiline(field, String(v));
    }
    else if (field instanceof PDFCheckBox) (v ? field.check() : field.uncheck());
    else if (field instanceof PDFRadioGroup) (v ? field.select(String(v)) : field.clear());
    else if (field instanceof PDFDropdown) (v ? field.select(String(v)) : field.clear());
    else if (field instanceof PDFOptionList) {
      const list = Array.isArray(v) ? v : [String(v)];
      if (list.length) field.select(list);
      else field.clear();
    }
  }
  form.updateFieldAppearances(await embedRegistryFont(doc, 'arimo'));
  if (flatten) form.flatten({ updateFieldAppearances: false });
  return doc.save({ updateFieldAppearances: false });
}
