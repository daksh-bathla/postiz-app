'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Search, RefreshCw, Zap, Target, ExternalLink, Lock, Calendar } from 'lucide-react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useCalendar } from '@gitroom/frontend/components/launches/calendar.context';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import dayjs from 'dayjs';
import { ModelConfig } from './byok-ai';
import {
  ProductContext,
  Opportunity,
  runGrowthScan,
  autoFillProduct,
} from './growth-agents';

const STORAGE_KEYS = {
  modelConfig: 'growthagent:modelConfig',
  product: 'growthagent:product',
};

const PROVIDERS = [
  { id: 'gemini', name: 'Gemini 2.0 Flash', keyField: 'geminiApiKey', hint: 'aistudio.google.com/apikey' },
  { id: 'anthropic', name: 'Claude (Anthropic)', keyField: 'anthropicApiKey', hint: 'console.anthropic.com/settings/keys' },
  { id: 'openai', name: 'GPT-4o (OpenAI)', keyField: 'openaiApiKey', hint: 'platform.openai.com/api-keys' },
  { id: 'groq', name: 'Llama 3.3 (Groq)', keyField: 'groqApiKey', hint: 'console.groq.com/keys' },
  { id: 'xai', name: 'Grok 3 (xAI)', keyField: 'xaiApiKey', hint: 'console.x.ai' },
  { id: 'ollama', name: 'Local Ollama', keyField: null, hint: 'ollama.com' },
  { id: 'custom', name: 'Custom Endpoint', keyField: null, hint: '' },
] as const;

const PLATFORM_COLORS: Record<string, string> = {
  X: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  Reddit: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  LinkedIn: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Discord: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  HackerNews: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  YouTube: 'bg-red-500/20 text-red-300 border-red-500/30',
  IndieHackers: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

const EMPTY_PRODUCT: ProductContext = {
  name: '', description: '', targetAudience: '', painPoints: '',
  tone: '', competitors: '', uniqueAngle: '',
};

const DEFAULT_CONFIG: ModelConfig = {
  provider: 'none',
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: 'llama3',
  customEndpoint: '',
  customModel: '',
  customApiKey: '',
};

export const GrowthAgent: React.FC = () => {
  const [product, setProduct] = useState<ProductContext>(() =>
    loadStorage(STORAGE_KEYS.product, EMPTY_PRODUCT)
  );
  const [modelConfig, setModelConfig] = useState<ModelConfig>(() =>
    loadStorage(STORAGE_KEYS.modelConfig, DEFAULT_CONFIG)
  );
  const [targetTopic, setTargetTopic] = useState('');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'product' | 'config' | 'opportunities'>('product');
  const [activeFilter, setActiveFilter] = useState('All');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.modelConfig, JSON.stringify(modelConfig));
  }, [modelConfig]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.product, JSON.stringify(product));
  }, [product]);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
  }, []);

  const handleRun = useCallback(async () => {
    if (!product.name) {
      setError('Fill in product details first.');
      setActiveTab('product');
      return;
    }
    if (modelConfig.provider === 'none') {
      setError('Configure an AI provider in the Config tab.');
      setActiveTab('config');
      return;
    }
    setIsLoading(true);
    setError(null);
    addLog(`Starting scan for "${product.name}"...`);
    try {
      const ops = await runGrowthScan(product, targetTopic, modelConfig, addLog);
      setOpportunities((prev) => [...ops, ...prev]);
      addLog(`Done. Found ${ops.length} high-value opportunities.`);
      setActiveTab('opportunities');
    } catch (e: any) {
      setError(e.message);
      addLog(`Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [product, targetTopic, modelConfig, addLog]);

  const handleAutoFill = useCallback(async () => {
    if (!websiteUrl || modelConfig.provider === 'none') {
      setError('Configure an AI provider first.');
      return;
    }
    let url = websiteUrl;
    if (!url.startsWith('http')) url = 'https://' + url;
    setIsScraping(true);
    setError(null);
    try {
      const ctx = await autoFillProduct(url, modelConfig);
      setProduct((prev) => ({ ...prev, ...ctx }));
      addLog(`Auto-filled product info from ${url}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsScraping(false);
    }
  }, [websiteUrl, modelConfig, addLog]);

  const updateStatus = useCallback(
    (id: string, status: 'pending' | 'review' | 'ready') => {
      setOpportunities((prev) =>
        prev.map((op) => (op.id === id ? { ...op, status } : op))
      );
    },
    []
  );

  const selectedProvider = PROVIDERS.find((p) => p.id === modelConfig.provider);
  const platforms = ['All', ...Array.from(new Set(opportunities.map((o) => o.platform)))];
  const filtered = activeFilter === 'All'
    ? opportunities
    : opportunities.filter((o) => o.platform === activeFilter);

  return (
    <div className="flex flex-col h-full bg-[#0f0f12] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Growth Agent</h1>
            <div className="flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-emerald-400" />
              <p className="text-[11px] text-emerald-400 font-medium">BYOK — keys never leave your browser</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleRun}
          disabled={isLoading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white shadow-lg shadow-emerald-500/25"
        >
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {isLoading ? 'Scanning...' : 'Run Scan'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.06] px-6">
        {[
          { id: 'product', label: 'Product' },
          { id: 'config', label: 'AI Config' + (modelConfig.provider === 'none' ? ' ⚠' : '') },
          { id: 'opportunities', label: `Opportunities${opportunities.length ? ` (${opportunities.length})` : ''}` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-2">
          <span className="shrink-0 mt-0.5">✕</span>
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* ── Product Tab ── */}
        {activeTab === 'product' && (
          <div className="p-6 space-y-5 max-w-2xl">
            {/* Auto-fill */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Auto-fill from website</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAutoFill()}
                  placeholder="https://yourproduct.com"
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  onClick={handleAutoFill}
                  disabled={isScraping || !websiteUrl}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50 transition-all text-white border border-white/[0.08] flex items-center gap-2"
                >
                  {isScraping ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  Extract
                </button>
              </div>
            </div>

            {/* Fields */}
            {([
              { key: 'name', label: 'Product Name', placeholder: 'Postiz' },
              { key: 'description', label: 'Description', placeholder: 'Social media scheduling tool for 28+ channels' },
              { key: 'targetAudience', label: 'Target Audience', placeholder: 'Founders, marketers, content creators' },
              { key: 'painPoints', label: 'Pain Points Solved', placeholder: 'Managing multiple social accounts, scheduling posts' },
              { key: 'tone', label: 'Brand Tone', placeholder: 'Professional, helpful, slightly playful' },
              { key: 'competitors', label: 'Competitors', placeholder: 'Buffer, Hootsuite, Later' },
              { key: 'uniqueAngle', label: 'Unique Angle', placeholder: 'Open source, self-hostable, 28+ channels' },
            ] as const).map((field) => (
              <div key={field.key} className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{field.label}</label>
                <textarea
                  value={product[field.key]}
                  onChange={(e) =>
                    setProduct((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  placeholder={field.placeholder}
                  rows={field.key === 'description' || field.key === 'painPoints' ? 3 : 2}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none"
                />
              </div>
            ))}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Target Topics <span className="text-slate-600 normal-case font-normal">(optional, comma-separated)</span>
              </label>
              <input
                type="text"
                value={targetTopic}
                onChange={(e) => setTargetTopic(e.target.value)}
                placeholder="social media scheduling, buffer alternative, hootsuite replacement"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>
        )}

        {/* ── Config Tab ── */}
        {activeTab === 'config' && (
          <div className="p-6 space-y-6 max-w-xl">
            {/* BYOK notice */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
              <Lock className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div className="text-xs text-slate-400 leading-relaxed">
                <span className="text-emerald-400 font-bold">BYOK — Bring Your Own Key.</span>{' '}
                API keys are stored only in your browser's localStorage. They are sent
                directly from your browser to the AI provider — never to Postiz servers,
                never logged, never stored anywhere else.
              </div>
            </div>

            {/* Provider grid */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Provider</label>
              <div className="grid grid-cols-2 gap-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      setModelConfig((prev) => ({ ...prev, provider: p.id }))
                    }
                    className={`px-3 py-3 rounded-xl text-sm font-medium border text-left transition-all ${
                      modelConfig.provider === p.id
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:border-white/20 hover:text-slate-200'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* API key field */}
            {selectedProvider && selectedProvider.keyField && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  API Key
                </label>
                <input
                  type="password"
                  value={(modelConfig as any)[selectedProvider.keyField] || ''}
                  onChange={(e) =>
                    setModelConfig((prev) => ({
                      ...prev,
                      [selectedProvider.keyField as string]: e.target.value,
                    }))
                  }
                  placeholder="sk-..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 font-mono"
                  autoComplete="off"
                />
                {selectedProvider.hint && (
                  <p className="text-[11px] text-slate-600">
                    Get key at:{' '}
                    <span className="text-slate-500 font-mono">{selectedProvider.hint}</span>
                  </p>
                )}
              </div>
            )}

            {/* Ollama config */}
            {modelConfig.provider === 'ollama' && (
              <div className="space-y-3">
                {[
                  { key: 'ollamaEndpoint', label: 'Endpoint', placeholder: 'http://localhost:11434' },
                  { key: 'ollamaModel', label: 'Model', placeholder: 'llama3' },
                ].map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{f.label}</label>
                    <input
                      type="text"
                      value={(modelConfig as any)[f.key] || ''}
                      onChange={(e) =>
                        setModelConfig((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                      placeholder={f.placeholder}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Custom endpoint config */}
            {modelConfig.provider === 'custom' && (
              <div className="space-y-3">
                {[
                  { key: 'customEndpoint', label: 'Endpoint', placeholder: 'https://api.deepseek.com/v1', type: 'text' },
                  { key: 'customModel', label: 'Model', placeholder: 'deepseek-chat', type: 'text' },
                  { key: 'customApiKey', label: 'API Key', placeholder: 'sk-...', type: 'password' },
                ].map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{f.label}</label>
                    <input
                      type={f.type}
                      value={(modelConfig as any)[f.key] || ''}
                      onChange={(e) =>
                        setModelConfig((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                      placeholder={f.placeholder}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Opportunities Tab ── */}
        {activeTab === 'opportunities' && (
          <div className="p-6">
            {/* Filters */}
            <div className="flex gap-2 flex-wrap mb-6 items-center">
              {platforms.map((p) => (
                <button
                  key={p}
                  onClick={() => setActiveFilter(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    activeFilter === p
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p}
                </button>
              ))}
              {opportunities.length > 0 && (
                <button
                  onClick={() => setOpportunities([])}
                  className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold border bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all"
                >
                  Clear All
                </button>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-20">
                <Target className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-600 text-sm">
                  No opportunities yet.{' '}
                  {modelConfig.provider === 'none'
                    ? 'Configure an AI provider first.'
                    : 'Run a scan to find growth opportunities.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((op) => (
                  <OpportunityCard
                    key={op.id}
                    op={op}
                    onUpdateStatus={(status) => updateStatus(op.id, status)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Log panel */}
      {logs.length > 0 && (
        <div className="border-t border-white/[0.06] bg-black/40 px-6 py-2 max-h-28 overflow-y-auto">
          {logs.map((log, i) => (
            <p key={i} className="text-[11px] text-slate-600 font-mono py-0.5">
              {log}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

const PLATFORM_TO_IDENTIFIER: Record<string, string[]> = {
  X: ['x', 'twitter'],
  Reddit: ['reddit'],
  LinkedIn: ['linkedin'],
  Discord: ['discord'],
  HackerNews: ['hackernews'],
  YouTube: ['youtube'],
  IndieHackers: ['indiehackers'],
};

const OpportunityCard: React.FC<{
  op: Opportunity;
  onUpdateStatus?: (status: 'pending' | 'review' | 'ready') => void;
}> = ({ op, onUpdateStatus }) => {
  const fetch = useFetch();
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>('');
  const [editedContent, setEditedContent] = useState(op.suggestedResponse);
  const [scheduleType, setScheduleType] = useState<'draft' | 'now' | 'schedule'>('draft');
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/integrations/list')
      .then((r) => r.json())
      .then((data) => {
        const all: any[] = data?.integrations || data || [];
        const identifiers = PLATFORM_TO_IDENTIFIER[op.platform] || [];
        const matched = identifiers.length
          ? all.filter((i: any) => identifiers.includes((i.identifier || '').toLowerCase()))
          : all;
        setIntegrations(matched.length ? matched : all);
        if (matched.length === 1) setSelectedIntegrationId(matched[0].id);
      })
      .catch(() => {});
  }, []);

  const handleSchedule = useCallback(async () => {
    if (!selectedIntegrationId) {
      setSubmitError('Select a channel first.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);

    const utcDate = scheduleType === 'now'
      ? new Date().toISOString().replace('T', 'T').slice(0, 19)
      : new Date(scheduleDate).toISOString().slice(0, 19);

    const group = makeGroupId();
    const body = {
      type: scheduleType,
      date: utcDate,
      tags: [],
      shortLink: false,
      posts: [
        {
          integration: { id: selectedIntegrationId },
          group,
          settings: {},
          value: [{ content: editedContent, delay: 0, image: [] }],
        },
      ],
    };

    try {
      const res = await fetch('/posts', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `HTTP ${res.status}`);
      }
      onScheduled();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedIntegrationId, editedContent, scheduleType, scheduleDate, fetch, onScheduled]);

  return (
    <div className="mt-3 p-4 bg-white/[0.03] border border-emerald-500/20 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Schedule with Postiz</span>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-300 text-xs">✕</button>
      </div>

      {/* Channel picker */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Channel</label>
        {integrations.length === 0 ? (
          <p className="text-xs text-slate-600">
            No {op.platform} channels connected.{' '}
            <a href="/launches" className="text-sky-400 underline">Add one →</a>
          </p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {integrations.map((i: any) => (
              <button
                key={i.id}
                onClick={() => setSelectedIntegrationId(i.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  selectedIntegrationId === i.id
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-slate-200'
                }`}
              >
                {i.picture && (
                  <img src={i.picture} alt="" className="w-4 h-4 rounded-full object-cover" />
                )}
                {i.name || i.display || i.identifier}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Edit content */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Content</label>
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          rows={4}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none"
        />
      </div>

      {/* Schedule type */}
      <div className="flex gap-2">
        {(['draft', 'schedule', 'now'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setScheduleType(t)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold capitalize transition-all ${
              scheduleType === t
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-white/[0.04] border-white/[0.08] text-slate-500 hover:text-slate-300'
            }`}
          >
            {t === 'now' ? 'Post Now' : t}
          </button>
        ))}
      </div>

      {scheduleType === 'schedule' && (
        <input
          type="datetime-local"
          value={scheduleDate}
          onChange={(e) => setScheduleDate(e.target.value)}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
        />
      )}

      {submitError && (
        <p className="text-xs text-rose-400">{submitError}</p>
      )}

      <button
        onClick={handleSchedule}
        disabled={isSubmitting || integrations.length === 0}
        className="w-full py-2 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white flex items-center justify-center gap-2"
      >
        {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
        {isSubmitting ? 'Scheduling...' : scheduleType === 'draft' ? 'Save as Draft' : scheduleType === 'now' ? 'Post Now' : 'Schedule'}
      </button>
    </div>
  );
};

const OpportunityCard: React.FC<{
  op: Opportunity;
  onUpdateStatus?: (status: 'pending' | 'review' | 'ready') => void;
}> = ({ op, onUpdateStatus }) => {
  const [copied, setCopied] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const platformStyle =
    PLATFORM_COLORS[op.platform] || 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  const confidenceColor =
    op.confidenceScore >= 70
      ? 'text-emerald-400'
      : op.confidenceScore >= 40
        ? 'text-yellow-400'
        : 'text-slate-400';
  const riskColor =
    op.riskScore <= 3
      ? 'text-emerald-400'
      : op.riskScore <= 6
        ? 'text-yellow-400'
        : 'text-rose-400';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(op.suggestedResponse).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScheduled = useCallback(() => {
    setShowSchedule(false);
    setScheduled(true);
    onUpdateStatus?.('ready');
  }, [onUpdateStatus]);

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden hover:border-white/[0.14] transition-colors">
      {/* Header */}
      <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${platformStyle}`}>
            {op.platform}
          </span>
          {op.isRealPost && (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase">
              Real Post
            </span>
          )}
          {op.postedAt && (
            <span className="text-[10px] text-slate-600">{op.postedAt}</span>
          )}
          {op.suggestedAction && (
            <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded uppercase">
              {op.suggestedAction.replace(/_/g, ' ')}
            </span>
          )}
          {scheduled && (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase">
              ✓ Scheduled
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={confidenceColor}>{op.confidenceScore}% conf</span>
          <span className={riskColor}>risk {op.riskScore}/10</span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Post info */}
        {(op.postTitle || op.postSnippet) && (
          <div>
            {op.postTitle && (
              <p className="text-sm font-semibold text-white mb-1">{op.postTitle}</p>
            )}
            {op.postSnippet && (
              <p className="text-xs text-slate-500 italic">"{op.postSnippet}"</p>
            )}
          </div>
        )}

        {/* Intent + trigger */}
        <div>
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
            User Intent
          </p>
          <p className="text-sm text-slate-300 italic">"{op.targetUserIntent}"</p>
        </div>

        {op.emotionalTrigger && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
              🔥 {op.emotionalTrigger}
            </span>
          </div>
        )}

        {/* Suggested response */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Suggested Response
            </span>
            <button
              onClick={handleCopy}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                copied
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-slate-500 bg-white/[0.04] border-white/[0.08] hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap selection:bg-emerald-500/30">
            {op.suggestedResponse}
          </p>
        </div>

        {/* Expected outcome */}
        <p className="text-xs text-slate-600">{op.expectedOutcome}</p>

        {/* Schedule panel */}
        {showSchedule && (
          <SchedulePanel
            op={op}
            onClose={() => setShowSchedule(false)}
            onScheduled={handleScheduled}
          />
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          <div className="flex gap-2">
            {op.sourceUrl && (
              <a
                href={op.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 transition-all flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> View Post
              </a>
            )}
            {!scheduled && (
              <button
                onClick={() => setShowSchedule((v) => !v)}
                className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-all flex items-center gap-1"
              >
                <Calendar className="w-3 h-3" /> Schedule with Postiz
              </button>
            )}
          </div>

          <div className="flex gap-1.5">
            {(['pending', 'review', 'ready'] as const).map((s) => (
              <button
                key={s}
                onClick={() => onUpdateStatus?.(s)}
                className={`text-[9px] font-bold px-2 py-1 rounded-lg border uppercase tracking-wider transition-all ${
                  op.status === s
                    ? s === 'ready'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : s === 'review'
                        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                    : 'text-slate-700 border-white/[0.06] hover:text-slate-400 hover:border-white/[0.12]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
