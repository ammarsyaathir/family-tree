import React, { useRef, useState } from 'react';
import {
  X,
  Download,
  Upload,
  Database,
  FileJson,
  RotateCcw,
  Copy,
  Check,
} from 'lucide-react';
import { FamilyMember } from '../types/family';
import { generateCloudflareD1Sql } from '../utils/familyUtils';

interface CloudflareD1ModalProps {
  isOpen: boolean;
  people: FamilyMember[];
  onClose: () => void;
  onExportJson: () => void;
  onImportJson: (peopleList: any[]) => Promise<void>;
  onResetToSeed: () => Promise<void>;
}

export const CloudflareD1Modal: React.FC<CloudflareD1ModalProps> = ({
  isOpen,
  people,
  onClose,
  onExportJson,
  onImportJson,
  onResetToSeed,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadD1Sql = () => {
    const sql = generateCloudflareD1Sql(people);
    const blob = new Blob([sql], { type: 'application/sql' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'd1_migration_seed.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.people)
        ? parsed.people
        : null;
      if (!list) {
        setImportStatus('Invalid JSON structure: expected an array or { "people": [...] }');
        return;
      }
      await onImportJson(list);
      setImportStatus(`Successfully imported ${list.length} family profiles.`);
    } catch (err: any) {
      setImportStatus(`Import failed: ${err.message || 'Invalid JSON file'}`);
    } finally {
      e.target.value = '';
    }
  };

  const wranglerCmd = `npx wrangler d1 execute ammar-family-d1 --file=./d1_migration_seed.sql --remote`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="d1-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-[#E5DEC9] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 bg-[#FBF9F5] border-b border-[#E5DEC9] flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#14362B]">
              Cloudflare D1 &amp; JSON Storage Manager
            </span>
            <h3
              id="d1-modal-title"
              className="font-serif-display text-2xl font-bold text-[#1C1917]"
            >
              Database Sync &amp; Deployment Studio
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-[#E5DEC9] bg-white hover:bg-[#14362B] text-[#57534E] hover:text-white flex items-center justify-center transition-colors"
            aria-label="Close database studio"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Live Count Summary */}
          <div className="p-4 rounded-xl bg-[#FBF9F5] border border-[#E5DEC9] flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-[#78716C]">Active Family Archive State</div>
              <div className="font-serif-display text-xl font-bold text-[#1C1917]">
                <span className="font-mono-num text-[#14362B]">{people.length}</span> Documented Family Profiles
              </div>
              <div className="text-xs text-[#57534E] mt-0.5">
                With <strong className="font-mono-num">{people.filter((p) => Boolean(p.avatar)).length}</strong> custom uploaded portraits
              </div>
            </div>
            <div className="text-right font-mono-num text-xs text-[#57534E]">
              <div>Endpoint: /api/people</div>
              <div>Fallback: /data/people.json</div>
            </div>
          </div>

          {importStatus && (
            <div className="p-3 rounded-xl bg-[#F4EFE6] border border-[#D6CEBE] text-xs font-medium text-[#1C1917]">
              {importStatus}
            </div>
          )}

          {/* Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* JSON Export & Import */}
            <div className="p-4 rounded-xl border border-[#E5DEC9] bg-white space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-[#1C1917]">
                  <FileJson className="w-4 h-4 text-[#14362B]" />
                  <span>JSON Dataset (people.json)</span>
                </div>
                <p className="text-xs text-[#57534E] mt-1">
                  Download or upload the complete JSON profile archive including all added/edited family members and custom avatars.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={onExportJson}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#14362B] hover:bg-[#0D261E] text-white text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#E5DEC9] bg-[#FBF9F5] hover:bg-[#F4EFE6] text-[#1C1917] text-xs font-semibold transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import JSON</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleFileImport}
                />
              </div>
            </div>

            {/* Cloudflare D1 SQL Seed Export */}
            <div className="p-4 rounded-xl border border-[#E5DEC9] bg-white space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-[#1C1917]">
                  <Database className="w-4 h-4 text-[#9A3412]" />
                  <span>Cloudflare D1 SQL Migration</span>
                </div>
                <p className="text-xs text-[#57534E] mt-1">
                  Generate a ready-to-execute SQL seed file (<code className="font-mono-num">d1_migration_seed.sql</code>) with all {people.length} current profiles for your Cloudflare D1 database.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownloadD1Sql}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#9A3412] hover:bg-[#7C2D12] text-white text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download D1 SQL ({people.length} rows)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Cloudflare Wrangler CLI Command Helper */}
          <div className="p-4 rounded-xl bg-[#F4EFE6]/70 border border-[#E5DEC9] space-y-2">
            <div className="text-xs font-semibold text-[#1C1917]">
              Deploy to Cloudflare D1 Command
            </div>
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-[#E5DEC9] font-mono-num text-[11px] text-[#44403C] overflow-x-auto">
              <code className="whitespace-nowrap">{wranglerCmd}</code>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(wranglerCmd);
                    setCopiedCmd(true);
                    setTimeout(() => setCopiedCmd(false), 2000);
                  } catch (_) {}
                }}
                className="p-1.5 rounded-md hover:bg-[#F4EFE6] text-[#14362B] shrink-0"
                title="Copy Wrangler command"
              >
                {copiedCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-[#78716C]">
              Cloudflare Pages Functions are pre-configured in <code className="font-mono-num">/functions/api/people/</code> and <code className="font-mono-num">wrangler.toml</code>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#FBF9F5] border-t border-[#E5DEC9] flex flex-wrap items-center justify-between gap-3">
          {confirmReset ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#9A3412]">
                Reset database to original 64 members?
              </span>
              <button
                type="button"
                onClick={async () => {
                  await onResetToSeed();
                  setConfirmReset(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#9A3412] text-white text-xs font-semibold"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-2.5 py-1.5 rounded-lg border border-[#E5DEC9] bg-white text-xs font-medium text-[#57534E]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#78716C] hover:text-[#9A3412] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Default 64 Members</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#14362B] text-white text-xs font-semibold hover:bg-[#0D261E] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
