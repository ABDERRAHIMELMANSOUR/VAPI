'use client';

import { useRef, useState } from 'react';
import { FileUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { parseLeadFile, type ParsedLead } from '@/lib/csv';

interface ListUploadProps {
  /** Which field each row must have to be considered valid. */
  requires: 'phone' | 'email';
  onChange: (rows: ParsedLead[]) => void;
}

/**
 * Upload or paste a CSV / JSON contact list. Parses client-side, filters to
 * rows that carry the required field, de-duplicates, and reports the result.
 */
export function ListUpload({ requires, onChange }: ListUploadProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ valid: number; skipped: number } | null>(null);

  function ingest(content: string) {
    const parsed = parseLeadFile(content);
    const seen = new Set<string>();
    const valid: ParsedLead[] = [];
    for (const row of parsed.rows) {
      const key = requires === 'phone' ? row.phone : row.email;
      if (!key) continue;
      const norm = key.toLowerCase().replace(/\s+/g, '');
      if (seen.has(norm)) continue;
      seen.add(norm);
      valid.push(row);
    }
    setSummary({ valid: valid.length, skipped: parsed.rows.length - valid.length + parsed.skipped });
    onChange(valid);
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setFileName(file.name);
    setRawText(text);
    ingest(text);
  }

  function handlePaste(value: string) {
    setRawText(value);
    setFileName(null);
    if (value.trim()) ingest(value);
    else {
      setSummary(null);
      onChange([]);
    }
  }

  function clear() {
    setRawText('');
    setFileName(null);
    setSummary(null);
    onChange([]);
    if (fileInput.current) fileInput.current.value = '';
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{requires === 'phone' ? 'Lead list' : 'Contact list'}</Label>
        <div className="flex items-center gap-2">
          {summary ? (
            <span className="text-xs text-muted-foreground">
              {summary.valid} valid{summary.skipped > 0 ? `, ${summary.skipped} skipped` : ''}
            </span>
          ) : null}
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.json,.txt,text/csv,application/json"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInput.current?.click()}
          >
            <FileUp className="size-4" aria-hidden />
            Upload file
          </Button>
          {rawText ? (
            <Button type="button" variant="ghost" size="icon" className="size-8" onClick={clear}>
              <X className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>
      <Textarea
        rows={5}
        placeholder={
          requires === 'phone'
            ? 'Paste CSV/JSON, or upload a file.\nname,phone\nAda Lovelace,+14155550100'
            : 'Paste CSV/JSON, or upload a file.\nname,email\nAda Lovelace,ada@example.com'
        }
        className="resize-y font-mono text-xs"
        value={rawText}
        onChange={(e) => handlePaste(e.target.value)}
      />
      {fileName ? (
        <p className="text-xs text-muted-foreground">Loaded from {fileName}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Accepts CSV (with a header row) or a JSON array. Columns are auto-detected.
        </p>
      )}
    </div>
  );
}
