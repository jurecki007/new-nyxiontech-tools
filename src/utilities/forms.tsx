import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { fillForm, readForm, type FormFieldInfo, type FormValues } from '../lib/forms';
import { baseName, pdfBlob } from '../lib/pdfTools';
import { linkTo } from '../lib/route';
import { Option, Results, RunBar, SinglePdfInput, ToolPage, useSinglePdf, useTask, type OutputFile } from './ui';
import type { Utility } from './types';
import { useT } from '../i18n';

function FieldInput({ field, value, onChange }: { field: FormFieldInfo; value: FormValues[string]; onChange: (v: FormValues[string]) => void }) {
  const disabled = field.readOnly;
  const t = useT().forms;
  switch (field.kind) {
    case 'text':
      return field.multiline ? (
        <textarea className="text-field" rows={3} disabled={disabled} maxLength={field.maxLength} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="text-field" disabled={disabled} maxLength={field.maxLength} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
      );
    case 'checkbox':
      return (
        <label className="check">
          <input type="checkbox" disabled={disabled} checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          {value ? t.checked : t.notChecked}
        </label>
      );
    case 'radio':
      return (
        <div className="checks">
          {field.options.map((o) => (
            <label key={o} className="check">
              <input type="radio" name={field.name} disabled={disabled} checked={value === o} onChange={() => onChange(o)} />
              {o}
            </label>
          ))}
        </div>
      );
    case 'dropdown':
      return (
        <select className="text-field" disabled={disabled} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      );
    case 'list':
      return (
        <select
          className="text-field tall"
          multiple={field.multiple}
          disabled={disabled}
          value={(value as string[]) ?? []}
          onChange={(e) => onChange(Array.from(e.target.selectedOptions, (o) => o.value))}
        >
          {field.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      );
  }
}

export const formsUtility: Utility = {
  id: 'fill-form',
  icon: ClipboardList,
  group: 'edit',
  Component: function FillForm({ ctx }) {
    const pdf = useSinglePdf();
    const [fields, setFields] = useState<FormFieldInfo[] | null>(null);
    const [values, setValues] = useState<FormValues>({});
    const [flatten, setFlatten] = useState(false);
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    const all = useT();
    const t = all.forms;

    useEffect(() => {
      setFields(null);
      setOut([]);
      if (!pdf.bytes || !pdf.pages) return;
      void readForm(pdf.bytes).then(
        (f) => {
          setFields(f);
          setValues(Object.fromEntries(f.map((x) => [x.name, x.value])));
        },
        () => setFields([]),
      );
    }, [pdf.bytes, pdf.pages]);

    return (
      <ToolPage utility={formsUtility}>
        <SinglePdfInput pdf={pdf} />
        {fields && fields.length === 0 && (
          <p className="hint">
            {t.noFieldsBefore} <a {...linkTo('edit')}>{all.tools.edit.label}</a> {t.noFieldsAfter}
          </p>
        )}
        {fields && fields.length > 0 && (
          <>
            <p className="hint">{t.found(fields.length)}</p>
            {fields.map((f) => (
              <Option key={f.name} label={f.name}>
                <FieldInput field={f} value={values[f.name]} onChange={(v) => setValues({ ...values, [f.name]: v })} />
              </Option>
            ))}
            <Option label="">
              <label className="check">
                <input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} />
                {t.flatten}
              </label>
            </Option>
          </>
        )}
        <RunBar
          label={t.run}
          disabled={!pdf.bytes || !fields?.length}
          {...task}
          onRun={() =>
            task.run(async () => {
              const bytes = await fillForm(pdf.bytes!, values, flatten);
              setOut([{ name: `${baseName(pdf.file!.name)}_filled.pdf`, blob: pdfBlob(bytes) }]);
            })
          }
        />
        <Results files={out} zipName="filled.zip" ctx={ctx} />
      </ToolPage>
    );
  },
};
