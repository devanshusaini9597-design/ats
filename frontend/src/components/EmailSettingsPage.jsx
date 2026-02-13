import React, { useState, useEffect } from 'react';
import { Mail, Settings, Save, TestTube, Eye, EyeOff, CheckCircle, AlertCircle, Trash2, Shield, ExternalLink, Loader2, Info, Globe, Server } from 'lucide-react';
import Layout from './Layout';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';

const BASE = 'http://localhost:5000';

// Common SMTP presets for popular providers
const SMTP_PRESETS = {
  gmail:     { label: 'Gmail',           host: 'smtp.gmail.com',        port: 587, icon: '📧', desc: 'Google Workspace or personal Gmail' },
  outlook:   { label: 'Outlook / Office 365', host: 'smtp.office365.com', port: 587, icon: '📬', desc: 'Microsoft Outlook, Hotmail, Office 365' },
  zoho:      { label: 'Zoho Mail',       host: 'smtp.zoho.com',         port: 587, icon: '✉️', desc: 'Zoho Mail or Zoho Workspace' },
  hostinger: { label: 'Hostinger',       host: 'smtp.hostinger.com',    port: 587, icon: '🌐', desc: 'Hostinger domain email' },
  godaddy:   { label: 'GoDaddy',         host: 'smtpout.secureserver.net', port: 465, icon: '🌍', desc: 'GoDaddy domain email' },
  namecheap: { label: 'Namecheap',       host: 'mail.privateemail.com', port: 587, icon: '📮', desc: 'Namecheap Private Email' },
  yahoo:     { label: 'Yahoo Mail',      host: 'smtp.mail.yahoo.com',   port: 587, icon: '📨', desc: 'Yahoo Mail' },
  custom:    { label: 'Custom SMTP',     host: '',                      port: 587, icon: '⚙️', desc: 'Enter your own SMTP server details' },
};

const EmailSettingsPage = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [settings, setSettings] = useState({
    smtpEmail: '',
    smtpAppPassword: '',
    smtpProvider: 'gmail',
    smtpHost: '',
    smtpPort: 587,
    isConfigured: false,
    hasPassword: false
  });

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const res = await authenticatedFetch(`${BASE}/api/email-settings`);
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (err) {
      console.error('Fetch settings error:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectProvider = (key) => {
    const preset = SMTP_PRESETS[key];
    setSettings(prev => ({
      ...prev,
      smtpProvider: key,
      smtpHost: preset.host || prev.smtpHost,
      smtpPort: preset.port || prev.smtpPort
    }));
  };

  const handleSave = async () => {
    if (!settings.smtpEmail) return toast.error('Email address is required');
    if (!settings.smtpAppPassword && !settings.hasPassword) return toast.error('Password is required');
    if (settings.smtpProvider === 'custom' && !settings.smtpHost) return toast.error('SMTP Host is required for custom provider');
    setSaving(true);
    try {
      const res = await authenticatedFetch(`${BASE}/api/email-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (data.success) {
        toast.success('Email settings saved!');
        setSettings(data.settings);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!settings.smtpEmail) return toast.error('Enter your email first');
    if (!settings.smtpAppPassword && !settings.hasPassword) return toast.error('Enter your password first');
    setTesting(true);
    try {
      const res = await authenticatedFetch(`${BASE}/api/email-settings/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Test failed. Check your settings.');
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Remove your email settings? System will use the default email for sending.')) return;
    try {
      const res = await authenticatedFetch(`${BASE}/api/email-settings`, { method: 'DELETE' });
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setSettings({ smtpEmail: '', smtpAppPassword: '', smtpProvider: 'gmail', smtpHost: '', smtpPort: 587, isConfigured: false, hasPassword: false });
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Failed to remove settings');
    }
  };

  const activePreset = SMTP_PRESETS[settings.smtpProvider] || SMTP_PRESETS.custom;
  const isGmail = settings.smtpProvider === 'gmail';
  const isCustom = settings.smtpProvider === 'custom';

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Settings size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Email Settings</h1>
            <p className="text-xs text-gray-500">Configure your email to send candidate communications from your own address</p>
          </div>
        </div>

        {/* Status Banner */}
        {settings.isConfigured ? (
          <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">Email Configured — {activePreset.label}</p>
              <p className="text-xs text-green-600">All emails will be sent from <strong>{settings.smtpEmail}</strong></p>
            </div>
            <button onClick={handleRemove} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors" title="Remove settings">
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">No Email Configured</p>
              <p className="text-xs text-amber-600">Emails are sent from the system default. Configure your own email below — supports Gmail, Outlook, domain emails (Hostinger, GoDaddy, Zoho), and any custom SMTP.</p>
            </div>
          </div>
        )}

        {/* ═══════ STEP 1: CHOOSE PROVIDER ═══════ */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-3.5 border-b border-gray-100 bg-gray-50/60">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Globe size={15} className="text-indigo-500" /> Step 1 — Choose Email Provider
            </h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(SMTP_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => selectProvider(key)}
                  className={`px-3 py-2.5 rounded-lg border text-left transition-all ${
                    settings.smtpProvider === key
                      ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-400'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{preset.icon}</span>
                    <span className={`text-xs font-semibold ${settings.smtpProvider === key ? 'text-indigo-700' : 'text-gray-700'}`}>{preset.label}</span>
                  </div>
                </button>
              ))}
            </div>
            {activePreset.desc && (
              <p className="text-[11px] text-gray-400 mt-2.5 flex items-center gap-1">
                <Info size={11} /> {activePreset.desc}
              </p>
            )}
          </div>
        </div>

        {/* ═══════ STEP 2: CREDENTIALS ═══════ */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-3.5 border-b border-gray-100 bg-gray-50/60">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Mail size={15} className="text-indigo-500" /> Step 2 — Enter Credentials
            </h2>
          </div>

          <div className="p-6 space-y-4">
            {/* Custom SMTP Host & Port */}
            {(isCustom || !SMTP_PRESETS[settings.smtpProvider]) && (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">SMTP Host</label>
                  <div className="relative">
                    <Server size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={settings.smtpHost}
                      onChange={(e) => setSettings(prev => ({ ...prev, smtpHost: e.target.value }))}
                      placeholder="smtp.yourdomain.com"
                      className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Port</label>
                  <input
                    type="number"
                    value={settings.smtpPort}
                    onChange={(e) => setSettings(prev => ({ ...prev, smtpPort: parseInt(e.target.value) || 587 }))}
                    placeholder="587"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">587 (TLS) or 465 (SSL)</p>
                </div>
              </div>
            )}

            {/* Show auto-filled host for known providers */}
            {!isCustom && !isGmail && SMTP_PRESETS[settings.smtpProvider] && (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                <Server size={13} className="text-gray-400" />
                <span className="text-xs text-gray-500">SMTP Server:</span>
                <span className="text-xs font-semibold text-gray-700">{activePreset.host}:{activePreset.port}</span>
                <span className="text-[10px] text-gray-400 ml-auto">(auto-configured)</span>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                {isGmail ? 'Gmail Address' : 'Email Address'}
              </label>
              <input
                type="email"
                value={settings.smtpEmail}
                onChange={(e) => setSettings(prev => ({ ...prev, smtpEmail: e.target.value }))}
                placeholder={isGmail ? 'you@gmail.com' : 'you@yourdomain.com'}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
              <p className="text-[10px] text-gray-400 mt-1">Emails will be sent from this address</p>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                {isGmail ? 'Google App Password' : 'Email Password / App Password'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={settings.smtpAppPassword}
                  onChange={(e) => setSettings(prev => ({ ...prev, smtpAppPassword: e.target.value }))}
                  placeholder={settings.hasPassword ? '••••••••••••••••' : (isGmail ? '16-character App Password' : 'Your email password')}
                  className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Provider-specific help text */}
            {isGmail && (
              <div className="bg-indigo-50 rounded-xl p-4 space-y-2.5">
                <h3 className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
                  <Info size={14} /> Gmail requires an App Password (not your regular password)
                </h3>
                <ol className="text-xs text-indigo-700 space-y-1 ml-4 list-decimal">
                  <li>Go to <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="underline font-semibold hover:text-indigo-900">Google Account Security</a></li>
                  <li>Enable <strong>2-Step Verification</strong></li>
                  <li>Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline font-semibold hover:text-indigo-900">App Passwords</a> → Generate one for "Mail"</li>
                  <li>Paste the 16-character code above</li>
                </ol>
                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800">
                  Open Google App Passwords <ExternalLink size={12} />
                </a>
              </div>
            )}

            {settings.smtpProvider === 'outlook' && (
              <div className="bg-blue-50 rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                  <Info size={14} /> Outlook / Office 365
                </h3>
                <ul className="text-xs text-blue-700 space-y-1 ml-4 list-disc">
                  <li>Use your full Outlook email and password</li>
                  <li>If you have MFA enabled, create an <strong>App Password</strong> in Microsoft Security settings</li>
                  <li>For Office 365 admin accounts, ensure SMTP AUTH is enabled</li>
                </ul>
              </div>
            )}

            {(settings.smtpProvider === 'hostinger' || settings.smtpProvider === 'godaddy' || settings.smtpProvider === 'namecheap') && (
              <div className="bg-emerald-50 rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <Info size={14} /> Domain Email — {activePreset.label}
                </h3>
                <ul className="text-xs text-emerald-700 space-y-1 ml-4 list-disc">
                  <li>Use your full domain email (e.g., <strong>hr@yourcompany.com</strong>)</li>
                  <li>Use the email account password you created in your hosting panel</li>
                  <li>SMTP: <strong>{activePreset.host}</strong> — Port: <strong>{activePreset.port}</strong> (auto-configured)</li>
                </ul>
              </div>
            )}

            {settings.smtpProvider === 'zoho' && (
              <div className="bg-orange-50 rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-bold text-orange-800 flex items-center gap-1.5">
                  <Info size={14} /> Zoho Mail
                </h3>
                <ul className="text-xs text-orange-700 space-y-1 ml-4 list-disc">
                  <li>Use your Zoho email and password</li>
                  <li>If 2FA is enabled, generate an <strong>App Password</strong> from Zoho Security settings</li>
                  <li>Ensure SMTP access is enabled in Zoho Mail settings</li>
                </ul>
              </div>
            )}

            {isCustom && (
              <div className="bg-gray-100 rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Info size={14} /> Custom SMTP Server
                </h3>
                <ul className="text-xs text-gray-600 space-y-1 ml-4 list-disc">
                  <li>Enter your SMTP host (e.g., <strong>smtp.yourdomain.com</strong>)</li>
                  <li>Common ports: <strong>587</strong> (TLS/STARTTLS) or <strong>465</strong> (SSL)</li>
                  <li>Use your full email address and email password</li>
                  <li>Contact your email/hosting provider if unsure about SMTP details</li>
                </ul>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center gap-3 flex-wrap">
            <button
              onClick={handleSave}
              disabled={saving || !settings.smtpEmail}
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm"
            >
              {saving ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : <><Save size={15} /> Save Settings</>}
            </button>
            <button
              onClick={handleTest}
              disabled={testing || !settings.smtpEmail}
              className="px-5 py-2.5 bg-white text-indigo-600 border border-indigo-200 text-sm font-semibold rounded-lg hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {testing ? <><Loader2 size={15} className="animate-spin" /> Sending test...</> : <><TestTube size={15} /> Send Test Email</>}
            </button>
          </div>
        </div>

        {/* Security Note */}
        <div className="flex items-start gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
          <Shield size={16} className="text-gray-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-gray-700">Security Note</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Your password is stored securely and never shown after saving. Each user can only access their own email settings.</p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default EmailSettingsPage;
