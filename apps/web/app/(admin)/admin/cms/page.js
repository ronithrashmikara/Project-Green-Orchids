'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Button, Input, Textarea, Select } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { GlassPanel, DashboardHero } from '@/components/domain/DashboardUI';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'homepage', label: 'Homepage Content', icon: '🏠' },
  { key: 'branding', label: 'Site Branding', icon: '🎨' },
  { key: 'media', label: 'Media Library', icon: '🖼️' },
  { key: 'blocks', label: 'Content Blocks', icon: '📋' },
];

const BLOCK_TYPES = [
  { value: 'hero', label: 'Hero Section' },
  { value: 'announcement', label: 'Announcement Bar' },
  { value: 'text', label: 'Text Block' },
  { value: 'cta', label: 'CTA Section' },
  { value: 'featured_section', label: 'Featured Section' },
  { value: 'about_section', label: 'About Section' },
];

function GlassField({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function GlassInput({ value, onChange, type = 'text', placeholder }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30"
    />
  );
}

function GlassTextarea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30"
    />
  );
}

function GlassToggle({ value, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200',
        value ? 'bg-emerald-500' : 'bg-slate-200'
      )}
    >
      <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200', value ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  );
}

function SaveButton({ loading, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-60"
    >
      {loading ? 'Saving…' : 'Save changes'}
    </button>
  );
}

function HomepageTab({ blocks }) {
  const getBlock = (key) => blocks.find((b) => b.key === key) || {};
  const [forms, setForms] = useState({});
  const [saving, setSaving] = useState({});

  useEffect(() => {
    const init = {};
    ['hero', 'announcement', 'featured_section', 'about_section'].forEach((key) => {
      const b = getBlock(key);
      init[key] = b.content ? (typeof b.content === 'string' ? (() => { try { return JSON.parse(b.content); } catch { return {}; } })() : b.content) : {};
    });
    setForms(init);
  }, [blocks]);

  const set = (key, field, val) => setForms((f) => ({ ...f, [key]: { ...f[key], [field]: val } }));

  const save = async (key) => {
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      const b = getBlock(key);
      const payload = { key, type: key, content: JSON.stringify(forms[key]), title: forms[key].headline || forms[key].title || key };
      if (b.id) {
        await api.put(`/admin/cms/blocks/${b.id}`, payload).catch(() => api.patch(`/cms/blocks/${key}`, payload));
      } else {
        await api.post('/admin/cms/blocks', payload).catch(() => api.post('/cms/blocks', payload));
      }
      toast.success('Saved');
    } catch { toast.error('Failed to save'); }
    setSaving((s) => ({ ...s, [key]: false }));
  };

  const f = (key) => forms[key] || {};

  return (
    <div className="space-y-5">
      <GlassPanel title="Hero section" subtitle="Main landing banner with video, headline and call-to-action.">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <GlassField label="Video URL"><GlassInput value={f('hero').videoUrl || ''} onChange={(e) => set('hero', 'videoUrl', e.target.value)} placeholder="/hero.mp4" /></GlassField>
            <GlassField label="Poster image URL"><GlassInput value={f('hero').posterUrl || ''} onChange={(e) => set('hero', 'posterUrl', e.target.value)} placeholder="/hero-poster.jpg" /></GlassField>
          </div>
          <GlassField label="Headline"><GlassInput value={f('hero').headline || ''} onChange={(e) => set('hero', 'headline', e.target.value)} placeholder="Welcome to Orchids" /></GlassField>
          <GlassField label="Subheadline"><GlassInput value={f('hero').subheadline || ''} onChange={(e) => set('hero', 'subheadline', e.target.value)} placeholder="Sri Lanka's premier wholesale orchid marketplace" /></GlassField>
          <div className="grid gap-4 sm:grid-cols-2">
            <GlassField label="CTA button text"><GlassInput value={f('hero').ctaText || ''} onChange={(e) => set('hero', 'ctaText', e.target.value)} placeholder="Browse Catalogue" /></GlassField>
            <GlassField label="CTA URL"><GlassInput value={f('hero').ctaUrl || ''} onChange={(e) => set('hero', 'ctaUrl', e.target.value)} placeholder="/catalogue" /></GlassField>
          </div>
          <div className="flex justify-end"><SaveButton loading={saving.hero} onClick={() => save('hero')} /></div>
        </div>
      </GlassPanel>

      <GlassPanel title="Announcement bar" subtitle="Top-of-page message strip.">
        <div className="space-y-4">
          <GlassField label="Message"><GlassInput value={f('announcement').message || ''} onChange={(e) => set('announcement', 'message', e.target.value)} placeholder="Free delivery on orders over LKR 50,000" /></GlassField>
          <div className="grid gap-4 sm:grid-cols-2">
            <GlassField label="Link text"><GlassInput value={f('announcement').linkText || ''} onChange={(e) => set('announcement', 'linkText', e.target.value)} placeholder="Learn more" /></GlassField>
            <GlassField label="Link URL"><GlassInput value={f('announcement').linkUrl || ''} onChange={(e) => set('announcement', 'linkUrl', e.target.value)} placeholder="/shipping" /></GlassField>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GlassToggle value={!!f('announcement').enabled} onChange={(v) => set('announcement', 'enabled', v)} />
              <span className="text-sm font-medium text-slate-600">Bar enabled</span>
            </div>
            <SaveButton loading={saving.announcement} onClick={() => save('announcement')} />
          </div>
        </div>
      </GlassPanel>

      <GlassPanel title="Featured products section" subtitle="Homepage featured catalogue grid.">
        <div className="space-y-4">
          <GlassField label="Section title"><GlassInput value={f('featured_section').title || ''} onChange={(e) => set('featured_section', 'title', e.target.value)} placeholder="Featured Orchids" /></GlassField>
          <GlassField label="Subtitle"><GlassInput value={f('featured_section').subtitle || ''} onChange={(e) => set('featured_section', 'subtitle', e.target.value)} placeholder="Hand-picked selections for trade buyers" /></GlassField>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GlassToggle value={!!f('featured_section').enabled} onChange={(v) => set('featured_section', 'enabled', v)} />
              <span className="text-sm font-medium text-slate-600">Section enabled</span>
            </div>
            <SaveButton loading={saving.featured_section} onClick={() => save('featured_section')} />
          </div>
        </div>
      </GlassPanel>

      <GlassPanel title="About section" subtitle="Company story and identity block.">
        <div className="space-y-4">
          <GlassField label="Title"><GlassInput value={f('about_section').title || ''} onChange={(e) => set('about_section', 'title', e.target.value)} placeholder="About Orchids" /></GlassField>
          <GlassField label="Body text"><GlassTextarea value={f('about_section').body || ''} onChange={(e) => set('about_section', 'body', e.target.value)} placeholder="Our story..." rows={5} /></GlassField>
          <GlassField label="Image URL"><GlassInput value={f('about_section').imageUrl || ''} onChange={(e) => set('about_section', 'imageUrl', e.target.value)} placeholder="/about.jpg" /></GlassField>
          <div className="flex justify-end"><SaveButton loading={saving.about_section} onClick={() => save('about_section')} /></div>
        </div>
      </GlassPanel>
    </div>
  );
}

function BrandingTab({ blocks }) {
  const getBlock = (key) => blocks.find((b) => b.key === key) || {};
  const [forms, setForms] = useState({});
  const [saving, setSaving] = useState({});

  useEffect(() => {
    const init = {};
    ['brand', 'theme', 'social'].forEach((key) => {
      const b = getBlock(key);
      init[key] = b.content ? (typeof b.content === 'string' ? (() => { try { return JSON.parse(b.content); } catch { return {}; } })() : b.content) : {};
    });
    setForms(init);
  }, [blocks]);

  const set = (key, field, val) => setForms((f) => ({ ...f, [key]: { ...f[key], [field]: val } }));

  const save = async (key) => {
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      const b = getBlock(key);
      const payload = { key, type: 'brand', content: JSON.stringify(forms[key]), title: key };
      if (b.id) {
        await api.put(`/admin/cms/blocks/${b.id}`, payload).catch(() => api.patch(`/cms/blocks/${key}`, payload));
      } else {
        await api.post('/admin/cms/blocks', payload).catch(() => api.post('/cms/blocks', payload));
      }
      toast.success('Saved');
    } catch { toast.error('Failed to save'); }
    setSaving((s) => ({ ...s, [key]: false }));
  };

  const f = (key) => forms[key] || {};

  return (
    <div className="space-y-5">
      <GlassPanel title="Brand identity" subtitle="Logo, company name and footer text.">
        <div className="space-y-4">
          <GlassField label="Logo URL"><GlassInput value={f('brand').logoUrl || ''} onChange={(e) => set('brand', 'logoUrl', e.target.value)} placeholder="/logo.svg" /></GlassField>
          <GlassField label="Company name"><GlassInput value={f('brand').companyName || ''} onChange={(e) => set('brand', 'companyName', e.target.value)} placeholder="Orchids" /></GlassField>
          <GlassField label="Tagline"><GlassInput value={f('brand').tagline || ''} onChange={(e) => set('brand', 'tagline', e.target.value)} placeholder="Sri Lanka's premier wholesale orchid marketplace" /></GlassField>
          <GlassField label="Footer text"><GlassInput value={f('brand').footerText || ''} onChange={(e) => set('brand', 'footerText', e.target.value)} placeholder="© 2026 Orchids. All rights reserved." /></GlassField>
          <div className="flex justify-end"><SaveButton loading={saving.brand} onClick={() => save('brand')} /></div>
        </div>
      </GlassPanel>

      <GlassPanel title="Theme colours" subtitle="Primary and accent palette. Paste hex codes including the # symbol.">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <GlassField label="Primary colour">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={f('theme').primary || '#22c55e'}
                  onChange={(e) => set('theme', 'primary', e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200 bg-transparent"
                />
                <GlassInput value={f('theme').primary || ''} onChange={(e) => set('theme', 'primary', e.target.value)} placeholder="#22c55e" />
              </div>
            </GlassField>
            <GlassField label="Accent colour">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={f('theme').accent || '#a855f7'}
                  onChange={(e) => set('theme', 'accent', e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200 bg-transparent"
                />
                <GlassInput value={f('theme').accent || ''} onChange={(e) => set('theme', 'accent', e.target.value)} placeholder="#a855f7" />
              </div>
            </GlassField>
          </div>
          <div className="flex justify-end"><SaveButton loading={saving.theme} onClick={() => save('theme')} /></div>
        </div>
      </GlassPanel>

      <GlassPanel title="Social links" subtitle="Platform profiles and contact channels.">
        <div className="space-y-4">
          <GlassField label="Instagram URL"><GlassInput value={f('social').instagram || ''} onChange={(e) => set('social', 'instagram', e.target.value)} placeholder="https://instagram.com/orchids" /></GlassField>
          <GlassField label="Facebook URL"><GlassInput value={f('social').facebook || ''} onChange={(e) => set('social', 'facebook', e.target.value)} placeholder="https://facebook.com/orchids" /></GlassField>
          <GlassField label="LinkedIn URL"><GlassInput value={f('social').linkedin || ''} onChange={(e) => set('social', 'linkedin', e.target.value)} placeholder="https://linkedin.com/company/orchids" /></GlassField>
          <GlassField label="WhatsApp number"><GlassInput value={f('social').whatsapp || ''} onChange={(e) => set('social', 'whatsapp', e.target.value)} placeholder="+94771234567" /></GlassField>
          <div className="flex justify-end"><SaveButton loading={saving.social} onClick={() => save('social')} /></div>
        </div>
      </GlassPanel>
    </div>
  );
}

function MediaTab() {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [noEndpoint, setNoEndpoint] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/cms/media');
        setMedia(res.data.files || res.data.media || res.data || []);
      } catch (err) {
        if (err.response?.status === 404) setNoEndpoint(true);
        setMedia([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/cms/media', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMedia((m) => [res.data, ...m]);
      toast.success('Uploaded');
    } catch (err) {
      if (err.response?.status === 404) {
        setNoEndpoint(true);
        toast.error('Media upload endpoint not available yet');
      } else {
        toast.error('Upload failed');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/cms/media/${deleteTarget.id || encodeURIComponent(deleteTarget.filename)}`);
      setMedia((m) => m.filter((x) => x.id !== deleteTarget.id && x.filename !== deleteTarget.filename));
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
  };

  if (loading) return <Spinner className="py-20" />;

  return (
    <div className="space-y-5">
      {noEndpoint && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">
          Media upload API endpoint is not yet available. The UI is ready — connect <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">POST /api/cms/media</code> to enable uploads.
        </div>
      )}

      <GlassPanel
        title="Media library"
        subtitle="Uploaded images and assets for use across the site."
        action={
          <label className={cn('cursor-pointer rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100', uploading && 'opacity-60 cursor-not-allowed')}>
            {uploading ? 'Uploading…' : '+ Upload image'}
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        }
      >
        {media.length === 0 ? (
          <EmptyState title="No media files" description="Upload images to use them in your CMS blocks." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {media.map((item, idx) => (
              <div key={item.id || idx} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <div className="aspect-square overflow-hidden bg-slate-100">
                  <img
                    src={item.url || item.path}
                    alt={item.filename || item.name}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
                <div className="p-3">
                  <p className="truncate text-xs font-medium text-slate-600">{item.filename || item.name}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => { navigator.clipboard.writeText(item.url || item.path); toast.success('URL copied'); }}
                      className="flex-1 rounded-lg border border-slate-200 bg-white py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                    >
                      Copy URL
                    </button>
                    <button
                      onClick={() => setDeleteTarget(item)}
                      className="rounded-lg border border-rose-400/20 bg-rose-400/10 py-1 px-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-400/20"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete media file"
        message={`Delete "${deleteTarget?.filename || deleteTarget?.name}"? Any CMS blocks referencing this file will break.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

function BlocksTab({ blocks, onRefresh }) {
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ key: '', type: 'text', title: '', content: '', ctaText: '', ctaUrl: '', imageUrl: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openEdit = (block) => {
    setEditing(block);
    setForm({ key: block.key || '', type: block.type || 'text', title: block.title || '', content: block.content || '', ctaText: block.ctaText || '', ctaUrl: block.ctaUrl || '', imageUrl: block.imageUrl || '' });
    setShowEditor(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await api.put(`/admin/cms/blocks/${editing.id}`, form).catch(() => api.patch(`/cms/blocks/${editing.key}`, form));
      } else {
        await api.post('/admin/cms/blocks', form).catch(() => api.post('/cms/blocks', form));
      }
      toast.success('Saved');
      setShowEditor(false);
      setEditing(null);
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/cms/blocks/${deleteTarget.id}`).catch(() => api.delete(`/cms/blocks/${deleteTarget.key}`));
      toast.success('Deleted');
      onRefresh();
    } catch { toast.error('Failed'); }
  };

  const handleTogglePublish = async (block) => {
    try {
      await api.patch(`/cms/blocks/${block.key}/publish`);
      toast.success(block.is_published ? 'Unpublished' : 'Published');
      onRefresh();
    } catch { toast.error('Failed to change publish status'); }
  };

  return (
    <div className="space-y-5">
      <GlassPanel
        title="All content blocks"
        subtitle="Raw CMS block registry."
        action={
          <button
            onClick={() => { setEditing(null); setForm({ key: '', type: 'text', title: '', content: '', ctaText: '', ctaUrl: '', imageUrl: '' }); setShowEditor(true); }}
            className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/20"
          >
            + New block
          </button>
        }
      >
        {blocks.length === 0 ? <EmptyState title="No CMS blocks" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Key', 'Type', 'Title', 'Updated', 'Status', ''].map((h) => (
                    <th key={h} className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {blocks.map((b) => (
                  <tr key={b.id || b.key} className="group transition hover:bg-slate-50">
                    <td className="py-3 pr-4 font-mono text-xs text-slate-600">{b.key}</td>
                    <td className="py-3 pr-4 text-slate-500">{b.block_type || b.type}</td>
                    <td className="py-3 pr-4 text-slate-600">{b.title || '—'}</td>
                    <td className="py-3 pr-4 text-slate-400">{formatDate(b.updated_at || b.updatedAt)}</td>
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => handleTogglePublish(b)}
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-semibold transition',
                          b.is_published ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        )}
                      >
                        {b.is_published ? '● Published' : '○ Draft'}
                      </button>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2 opacity-0 transition group-hover:opacity-100">
                        <button onClick={() => openEdit(b)} className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800">Edit</button>
                        <button onClick={() => setDeleteTarget(b)} className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-400/20">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>

      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setShowEditor(false)} />
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#0d1117]/95 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h3 className="text-lg font-bold text-white">{editing ? 'Edit block' : 'New block'}</h3>
              <button onClick={() => setShowEditor(false)} className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/40 transition hover:text-white">✕</button>
            </div>
            <div className="space-y-4 p-6">
              <GlassField label="Block key"><GlassInput value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} placeholder="hero" /></GlassField>
              <GlassField label="Type">
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none">
                  {BLOCK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </GlassField>
              <GlassField label="Title"><GlassInput value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></GlassField>
              <GlassField label="Content"><GlassTextarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} /></GlassField>
              <div className="grid grid-cols-2 gap-4">
                <GlassField label="CTA text"><GlassInput value={form.ctaText} onChange={(e) => setForm((f) => ({ ...f, ctaText: e.target.value }))} /></GlassField>
                <GlassField label="CTA URL"><GlassInput value={form.ctaUrl} onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))} /></GlassField>
              </div>
              <GlassField label="Image URL"><GlassInput value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} /></GlassField>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowEditor(false)} className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white/55 transition hover:text-white">Cancel</button>
                <button onClick={handleSave} className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400">Save block</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete block"
        message={`Delete block "${deleteTarget?.key}"? Pages referencing this key will fall back to defaults.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

export default function CMSPage() {
  const [tab, setTab] = useState('homepage');
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBlocks = useCallback(async () => {
    const res = await api.get('/admin/cms/blocks').catch(() => api.get('/cms/blocks').catch(() => ({ data: [] })));
    setBlocks(res.data.blocks || res.data.data || res.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow="Content management"
        title="Site CMS"
        description="Manage homepage content, brand settings, media assets and all content blocks from one place."
        tone="violet"
      />

      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition',
              tab === t.key
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            )}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {loading ? <Spinner className="py-20" /> : (
        <>
          {tab === 'homepage' && <HomepageTab blocks={blocks} />}
          {tab === 'branding' && <BrandingTab blocks={blocks} />}
          {tab === 'media' && <MediaTab />}
          {tab === 'blocks' && <BlocksTab blocks={blocks} onRefresh={fetchBlocks} />}
        </>
      )}
    </div>
  );
}
