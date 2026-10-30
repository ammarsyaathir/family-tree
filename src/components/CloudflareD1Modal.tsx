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
  BookOpen,
  Terminal,
  Cloud,
  ArrowRight,
  ShieldCheck,
  Code2,
} from 'lucide-react';
import { FamilyMember } from '../types/family';
import { generateCloudflareD1Sql, generatePostgresJsonbSql } from '../utils/familyUtils';

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
  const [activeTab, setActiveTab] = useState<'guide' | 'sql' | 'postgres' | 'json'>('guide');
  const [confirmReset, setConfirmReset] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const sqlContent = generateCloudflareD1Sql(people);
  const postgresSqlContent = generatePostgresJsonbSql(people);

  const handleDownloadD1Sql = () => {
    const blob = new Blob([sqlContent], { type: 'application/sql' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'schema.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPostgresSql = () => {
    const blob = new Blob([postgresSqlContent], { type: 'application/sql' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'supabase_family_members.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCmd(id);
      setTimeout(() => setCopiedCmd(null), 2000);
    } catch (_) {}
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
        setImportStatus('Invalid JSON: expected an array of people or { "people": [...] }');
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="d1-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-[#E5DEC9] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 bg-[#FBF9F5] border-b border-[#E5DEC9] flex items-center justify-between shrink-0">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-[#14362B]">
              Cloudflare Pages &amp; D1 Database Studio
            </div>
            <h3
              id="d1-modal-title"
              className="font-serif-display text-2xl font-bold text-[#1C1917]"
            >
              Cloudflare Hosting &amp; D1 Database Guide
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-[#E5DEC9] bg-white hover:bg-[#14362B] text-[#57534E] hover:text-white flex items-center justify-center transition-colors"
            aria-label="Close studio"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 bg-[#FBF9F5] border-b border-[#E5DEC9] flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'guide'
                ? 'bg-white border-[#14362B] text-[#14362B] shadow-2xs'
                : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Deployment Guide &amp; How D1 Works</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'sql'
                ? 'bg-white border-[#14362B] text-[#14362B] shadow-2xs'
                : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Cloudflare D1 SQL ({people.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('postgres')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'postgres'
                ? 'bg-white border-[#14362B] text-[#14362B] shadow-2xs'
                : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Supabase / Postgres JSONB</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'json'
                ? 'bg-white border-[#14362B] text-[#14362B] shadow-2xs'
                : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>JSON Backup</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'guide' ? (
            /* TAB 1: HOW CLOUDFLARE D1 DEPLOYMENT & INSERTION WORKS */
            <div className="space-y-6">
              {/* Highlight Box: How does the number 64 follow and insert into D1? */}
              <div className="p-5 rounded-2xl bg-[#F0FDF4] border-2 border-[#86EFAC] space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[#14362B]">
                  <ShieldCheck className="w-5 h-5 text-[#16A34A] shrink-0" />
                  <span>How the Member Count &amp; D1 Database Inserts Work</span>
                </div>
                <div className="text-xs text-[#1E3A8A] leading-relaxed space-y-2">
                  <p className="text-[#14532D]">
                    <strong>1. The number 64 is just your starting seed.</strong> All 64 documented relatives are ready in your database schema.
                  </p>
                  <p className="text-[#14532D]">
                    <strong>2. When you add a new member (e.g. 65th person):</strong>
                  </p>
                  <div className="p-3 rounded-xl bg-white border border-[#BBF7D0] font-mono-num text-[11px] text-[#1C1917] space-y-1">
                    <div className="text-[#15803D] font-semibold">// 1. User clicks &quot;Add Member&quot; and saves in the UI</div>
                    <div>Front-End calls: <span className="font-bold text-[#14362B]">POST /api/people</span> with JSON payload</div>
                    <div className="text-[#15803D] font-semibold mt-1">// 2. Cloudflare Pages Function executes SQLite query in D1:</div>
                    <div className="text-[#1C1917] bg-[#F8FAFC] p-2 rounded-lg border border-[#E2E8F0]">
                      INSERT INTO people (id, data, updated_at, updated_by)<br />
                      VALUES (?1, ?2, ?3, ?4)<br />
                      ON CONFLICT(id) DO UPDATE SET data = excluded.data;
                    </div>
                    <div className="text-[#15803D] font-semibold mt-1">// 3. Result in Cloudflare D1:</div>
                    <div>D1 total rows increases from <strong className="text-[#14362B]">64 → 65</strong>!</div>
                  </div>
                  <p className="text-[#14532D]">
                    <strong>3. Live Dynamic Counter:</strong> When anyone opens your website, the front-end fetches <code className="font-mono-num">GET /api/people</code>, which runs <code className="font-mono-num">SELECT * FROM people</code>. The counter automatically reads <strong className="text-[#14362B]">65</strong>, and the new relative appears on the tree!
                  </p>
                </div>
              </div>

              {/* Step by step deployment */}
              <div className="space-y-4">
                <h4 className="font-serif-display text-lg font-bold text-[#1C1917] flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#14362B]" />
                  <span>Step-by-Step Cloudflare Hosting &amp; D1 Setup</span>
                </h4>

                {/* Step 1 */}
                <div className="p-4 rounded-xl border border-[#E5DEC9] bg-[#FBF9F5] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#14362B] uppercase tracking-wider">
                      Step 1: Create your Cloudflare D1 Database
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText('npx wrangler d1 create ammar-family-d1', 'step1')}
                      className="text-xs font-semibold text-[#14362B] hover:underline inline-flex items-center gap-1"
                    >
                      {copiedCmd === 'step1' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy Command</span>
                    </button>
                  </div>
                  <p className="text-xs text-[#57534E]">
                    Open your terminal in this project folder and run:
                  </p>
                  <pre className="p-2.5 rounded-lg bg-[#1C1917] text-[#F5D98F] font-mono text-xs overflow-x-auto">
                    npx wrangler d1 create ammar-family-d1
                  </pre>
                  <p className="text-[11px] text-[#78716C]">
                    Wrangler will output your database ID. Copy the <code className="font-mono">database_id</code> into your <code className="font-mono">wrangler.toml</code>.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="p-4 rounded-xl border border-[#E5DEC9] bg-[#FBF9F5] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#14362B] uppercase tracking-wider">
                      Step 2: Seed the 64+ Family Members into D1
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText('npx wrangler d1 execute ammar-family-d1 --file=./schema.sql --remote', 'step2')}
                      className="text-xs font-semibold text-[#14362B] hover:underline inline-flex items-center gap-1"
                    >
                      {copiedCmd === 'step2' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy Command</span>
                    </button>
                  </div>
                  <p className="text-xs text-[#57534E]">
                    Run this command to create the <code className="font-mono">people</code> table and insert all records:
                  </p>
                  <pre className="p-2.5 rounded-lg bg-[#1C1917] text-[#F5D98F] font-mono text-xs overflow-x-auto">
                    npx wrangler d1 execute ammar-family-d1 --file=./schema.sql --remote
                  </pre>
                  <p className="text-[11px] text-[#78716C]">
                    You can also download the updated SQL anytime from the &quot;Live D1 SQL Script&quot; tab.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="p-4 rounded-xl border border-[#E5DEC9] bg-[#FBF9F5] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#14362B] uppercase tracking-wider">
                      Step 3: Deploy to Cloudflare Pages
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText('npm run build && npx wrangler pages deploy dist', 'step3')}
                      className="text-xs font-semibold text-[#14362B] hover:underline inline-flex items-center gap-1"
                    >
                      {copiedCmd === 'step3' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy Command</span>
                    </button>
                  </div>
                  <p className="text-xs text-[#57534E]">
                    Build the frontend and deploy to Cloudflare:
                  </p>
                  <pre className="p-2.5 rounded-lg bg-[#1C1917] text-[#F5D98F] font-mono text-xs overflow-x-auto">
                    npm run build &amp;&amp; npx wrangler pages deploy dist
                  </pre>
                </div>

                {/* Step 4 */}
                <div className="p-4 rounded-xl border border-[#E5DEC9] bg-[#FBF9F5] space-y-2">
                  <span className="text-xs font-bold text-[#14362B] uppercase tracking-wider block">
                    Step 4: Bind D1 Database in Cloudflare Dashboard
                  </span>
                  <div className="text-xs text-[#57534E] space-y-1 leading-relaxed">
                    <div>1. Go to <strong>Cloudflare Dashboard</strong> &gt; <strong>Workers &amp; Pages</strong> &gt; select your project.</div>
                    <div>2. Go to <strong>Settings</strong> &gt; <strong>Functions</strong> &gt; <strong>D1 Database bindings</strong>.</div>
                    <div>3. Click <strong>Add binding</strong>:</div>
                    <div className="pl-4 font-mono text-[11px] text-[#14362B]">
                      • Variable name: <strong className="text-black">DB</strong><br />
                      • D1 database: <strong className="text-black">ammar-family-d1</strong>
                    </div>
                    <div>4. Redeploy or save. Your live site is now fully connected to Cloudflare D1!</div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'sql' ? (
            /* TAB 2: LIVE D1 SQL SCRIPT */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#FBF9F5] border border-[#E5DEC9]">
                <div>
                  <div className="text-xs font-bold text-[#1C1917]">
                    Live D1 SQL Script ({people.length} Members)
                  </div>
                  <div className="text-[11px] text-[#57534E]">
                    Includes table definition and INSERT statements for every family member currently in your archive.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyText(sqlContent, 'sql_full')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5DEC9] bg-white text-xs font-semibold text-[#1C1917] hover:bg-[#F4EFE6]"
                  >
                    {copiedCmd === 'sql_full' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy SQL</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadD1Sql}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#14362B] text-white text-xs font-semibold hover:bg-[#0D261E]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download schema.sql</span>
                  </button>
                </div>
              </div>

              <pre className="p-4 rounded-xl bg-[#1C1917] text-[#E2E8F0] font-mono text-xs max-h-96 overflow-auto leading-relaxed">
                {sqlContent.slice(0, 3000)}
                {sqlContent.length > 3000 && '\n\n-- ... and all other members included in full export'}
              </pre>
            </div>
          ) : activeTab === 'postgres' ? (
            /* TAB 3: POSTGRESQL / SUPABASE JSONB CLEAN SQL */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#FBF9F5] border border-[#E5DEC9]">
                <div>
                  <div className="text-xs font-bold text-[#1C1917]">
                    Clean Postgres / Supabase JSONB Script ({people.length} Members)
                  </div>
                  <div className="text-[11px] text-[#57534E]">
                    Table definition, trigger for updated_at, public RLS policies, and upsert JSONB statements with clean updated names.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyText(postgresSqlContent, 'pg_full')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5DEC9] bg-white text-xs font-semibold text-[#1C1917] hover:bg-[#F4EFE6]"
                  >
                    {copiedCmd === 'pg_full' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy Postgres SQL</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPostgresSql}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#14362B] text-white text-xs font-semibold hover:bg-[#0D261E]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download supabase_schema.sql</span>
                  </button>
                </div>
              </div>

              <pre className="p-4 rounded-xl bg-[#1C1917] text-[#E2E8F0] font-mono text-xs max-h-96 overflow-auto leading-relaxed">
                {postgresSqlContent.slice(0, 3500)}
                {postgresSqlContent.length > 3500 && '\n\n-- ... and all remaining 64 family records included in full script'}
              </pre>
            </div>
          ) : (
            /* TAB 4: JSON BACKUP & RESTORE */
            <div className="space-y-4">
              {importStatus && (
                <div className="p-3 rounded-xl bg-[#F4EFE6] border border-[#D6CEBE] text-xs font-medium text-[#1C1917]">
                  {importStatus}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-[#E5DEC9] bg-[#FBF9F5] space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#1C1917]">Export Complete JSON</div>
                    <p className="text-xs text-[#57534E] mt-1">
                      Download the latest <code className="font-mono">people.json</code> containing all {people.length} individuals with their photos and relationships.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onExportJson}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#14362B] text-white text-xs font-semibold hover:bg-[#0D261E] transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download people.json</span>
                  </button>
                </div>

                <div className="p-4 rounded-xl border border-[#E5DEC9] bg-[#FBF9F5] space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#1C1917]">Import JSON Archive</div>
                    <p className="text-xs text-[#57534E] mt-1">
                      Upload an existing <code className="font-mono">people.json</code> file to synchronize all members into this app.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-[#E5DEC9] bg-white text-[#1C1917] hover:bg-[#F4EFE6] text-xs font-semibold transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload &amp; Replace from JSON</span>
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

              {/* Reset to initial 64 members */}
              <div className="p-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[#991B1B]">Restore Original 64 Seed Members</div>
                  <div className="text-[11px] text-[#7F1D1D] mt-0.5">
                    Resets the archive to the initial 64 documented members of the Ammar Syaathir heritage tree.
                  </div>
                </div>

                {confirmReset ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await onResetToSeed();
                        setConfirmReset(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#991B1B] text-white text-xs font-semibold hover:bg-red-800"
                    >
                      Confirm Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#FECACA] bg-white text-xs font-medium text-[#7F1D1D]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#991B1B] text-white text-xs font-semibold hover:bg-red-800"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore 64 Members</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#FBF9F5] border-t border-[#E5DEC9] flex items-center justify-between shrink-0">
          <div className="text-xs text-[#57534E] font-mono-num">
            Active Members: <strong>{people.length}</strong> · Cloudflare D1 Ready
          </div>
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
