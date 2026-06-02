// src/pages/Login/LoginScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import { RenderZeoLogoSvg, LOGIN_FOOTER_TEXT } from '../../shared/constants/constants';
import { useLanguage } from '../../shared/i18n';
import { supabase } from '../../shared/utils/supabase';
import Modal from '../../shared/components/Modal';

interface LoginScreenProps {
  onLoginSuccess: (email: string) => void;
  initialEmail?: string;
  hasActiveSession?: boolean;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const GoogleIcon: React.FC = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const LockIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const CheckIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const CloseIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SpinnerIcon: React.FC = () => (
  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

// ── Floating Bubble Component ─────────────────────────────────────────────────

const FloatingBubbles: React.FC = () => (
  <div className="vs-bubbles">
    {Array.from({ length: 12 }).map((_, i) => (
      <div key={i} className={`vs-bubble`} />
    ))}
  </div>
);

// ── Custom Checkbox ────────────────────────────────────────────────────────────

const GlassCheckbox: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
  label: React.ReactNode;
}> = ({ checked, onChange, id, label }) => (
  <label htmlFor={id} className="flex items-start gap-2.5 cursor-pointer group">
    <button
      type="button"
      id={id}
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex-shrink-0 mt-0.5 h-4 w-4 rounded-[4px] border flex items-center justify-center transition-all duration-150
        ${checked
          ? 'bg-purple-600 border-purple-500'
          : 'bg-white/[0.04] border-white/20 group-hover:border-white/35'
        }`}
    >
      {checked && <CheckIcon />}
    </button>
    <span className="text-[11.5px] text-white/55 leading-relaxed">{label}</span>
  </label>
);

// ── Main Login Screen ─────────────────────────────────────────────────────────

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, initialEmail = '', hasActiveSession = false }) => {
  const { t } = useLanguage();
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [hasAcceptedPolicies, setHasAcceptedPolicies] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [showPoliciesModal, setShowPoliciesModal] = useState<boolean>(false);
  const [activePolicyTab, setActivePolicyTab] = useState<'tos' | 'guidelines' | 'sanctions'>('tos');

  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const [notificationTitle, setNotificationTitle] = useState<string>('');
  const [notificationMessage, setNotificationMessage] = useState<string>('');

  const showNotification = (title: string, message: string) => {
    setNotificationTitle(title);
    setNotificationMessage(message);
    setIsNotificationOpen(true);
  };

  const isLastPolicyTab = activePolicyTab === 'sanctions';

  const handlePoliciesPrimaryAction = () => {
    if (activePolicyTab === 'tos')        { setActivePolicyTab('guidelines'); return; }
    if (activePolicyTab === 'guidelines') { setActivePolicyTab('sanctions'); return; }
    if (activePolicyTab === 'sanctions')  { setShowPoliciesModal(false); }
  };

  const handleGoogleLogin = async () => {
    if (!hasAcceptedPolicies) {
      showNotification('Perhatian', t.login.pleaseAcceptTerms);
      return;
    }

    try {
      setIsChecking(true);
      setStatusMessage('Menghubungkan ke Google...');

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { skipBrowserRedirect: true },
      });

      if (oauthError || !data?.url) throw new Error(oauthError?.message || 'Gagal membuat sesi login Google');

      if (!window.zeoAPI) {
        showNotification('Kesalahan Sistem', 'API zeo tidak tersedia.');
        setIsChecking(false);
        return;
      }

      const redirectUrl = await window.zeoAPI.openOAuthWindow(data.url);

      if (!redirectUrl) {
        showNotification('Login Dibatalkan', 'Anda menutup jendela login sebelum selesai.');
        setStatusMessage('');
        setIsChecking(false);
        return;
      }

      setStatusMessage('Memverifikasi sesi...');
      const urlObj = new URL(redirectUrl);
      const hash = urlObj.hash.substring(1);
      const params = new URLSearchParams(hash);
      const access_token  = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      if (!access_token || !refresh_token) throw new Error('Gagal mendapatkan token autentikasi dari Google.');

      const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
      if (sessionError) throw new Error(sessionError.message);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user?.email) throw new Error('Gagal membaca profil Google Anda.');

      const authenticatedEmail = userData.user.email;
      setStatusMessage(`Memeriksa lisensi untuk ${authenticatedEmail}...`);

      if (!window.zeoAPI?.licenseCheck) throw new Error('API untuk verifikasi lisensi tidak tersedia.');

      const result = await window.zeoAPI.licenseCheck({ email: authenticatedEmail });

      if (result && typeof result.message === 'string' && !result.ok) {
        showNotification('Lisensi Ditolak', result.message);
        setStatusMessage('');
      } else if (!result || !result.ok) {
        showNotification('Login Gagal', t.login.loginFailed);
        setStatusMessage('');
      }

      if (result && result.ok) {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('zeoStudio.session.rememberMe', String(rememberMe));
        }
        onLoginSuccess(authenticatedEmail);
      }

    } catch (error: any) {
      console.error('Google Auth Error:', error);
      showNotification('Kesalahan Sistem', error.message || t.login.loginFailed);
      setStatusMessage('');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div
      className="relative flex h-screen w-screen items-center justify-center overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* ── Animated gradient background ── */}
      <div className="vs-bg-gradient" />

      {/* ── Grid overlay ── */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      {/* ── Floating bubbles ── */}
      <FloatingBubbles />

      {/* ── Login card ── */}
      <div className="relative z-10 w-full max-w-[400px] mx-4">
        {/* Glow behind card */}
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 50%, rgba(139,92,246,0.18) 0%, transparent 70%)',
            filter: 'blur(24px)',
            transform: 'scale(1.15)',
          }}
        />

        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.042)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 32px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          {/* Top gradient line */}
          <div
            className="h-[1.5px] w-full"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.7), rgba(34,211,238,0.7), transparent)' }}
          />

          <div className="px-8 py-9 space-y-7">
            {/* ── Logo + Brand ── */}
            <div className="flex flex-col items-center gap-3 text-center">
              <div
                className="relative flex items-center justify-center h-14 w-14 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(34,211,238,0.15))',
                  border: '1px solid rgba(139,92,246,0.3)',
                  boxShadow: '0 8px 24px rgba(139,92,246,0.25)',
                }}
              >
                <RenderZeoLogoSvg className="h-8 w-8" />
              </div>
              <div>
                <h1
                  id="login-title"
                  className="text-2xl font-bold text-white tracking-tight"
                >
                  Viral Studio
                </h1>
                <p className="text-[12px] text-white/35 mt-0.5 font-medium tracking-wide">
                  AI Creative Suite · v1.1.0
                </p>
              </div>
            </div>

            {/* ── Tagline ── */}
            <div className="text-center">
              <p className="text-[13px] text-white/50 leading-relaxed">
                {t.login.tagline1}{' '}
                <span
                  className="font-semibold"
                  style={{
                    background: 'linear-gradient(90deg, #22d3ee, #c084fc)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {t.login.tagline2}
                </span>
              </p>
            </div>

            {/* ── Checkboxes ── */}
            <div className="space-y-3">
              <GlassCheckbox
                id="accept-policies"
                checked={hasAcceptedPolicies}
                onChange={(checked) => {
                  setHasAcceptedPolicies(checked);
                  if (checked) {
                    setActivePolicyTab('tos');
                    setShowPoliciesModal(true);
                  }
                }}
                label={
                  <>
                    {t.login.checkboxText}{' '}
                    <button
                      type="button"
                      onClick={() => { setActivePolicyTab('tos'); setShowPoliciesModal(true); }}
                      className="text-purple-400/80 hover:text-purple-300 underline underline-offset-2"
                    >
                      {t.login.termsOfService}
                    </button>{' '}
                    {t.login.andConnector}{' '}
                    <button
                      type="button"
                      onClick={() => { setActivePolicyTab('guidelines'); setShowPoliciesModal(true); }}
                      className="text-purple-400/80 hover:text-purple-300 underline underline-offset-2"
                    >
                      {t.login.communityGuidelines}
                    </button>
                  </>
                }
              />
              <GlassCheckbox
                id="remember-me"
                checked={rememberMe}
                onChange={setRememberMe}
                label="Ingat sesi saya (Jangan logout saat aplikasi ditutup)"
              />
            </div>

            {/* ── Google Sign In Button ── */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isChecking || !hasAcceptedPolicies}
              aria-label="Sign in with Google"
              className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5
                transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/40
                ${isChecking || !hasAcceptedPolicies
                  ? 'bg-white/[0.04] text-white/25 cursor-not-allowed border border-white/08'
                  : 'bg-white text-gray-900 hover:bg-gray-50 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0'
                }`}
            >
              {isChecking ? <SpinnerIcon /> : <GoogleIcon />}
              <span>{isChecking ? t.login.checkingLicense : 'Sign in with Google'}</span>
            </button>

            {/* ── Status message ── */}
            {isChecking && statusMessage && (
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/40">
                <SpinnerIcon />
                <span>{statusMessage}</span>
              </div>
            )}

            {/* ── Footer ── */}
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-white/20">
              <LockIcon />
              <span>{LOGIN_FOOTER_TEXT}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Policies Modal ── */}
      {showPoliciesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" style={{ backdropFilter: 'blur(8px)' }}>
          <div
            className="max-w-2xl w-full h-[520px] max-h-[80vh] overflow-hidden flex flex-col rounded-2xl"
            style={{
              background: 'rgba(12,12,20,0.95)',
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: '0 32px 64px rgba(0,0,0,0.7)',
            }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-semibold text-gray-50">{t.login.tos.modalTitle}</h2>
              <button
                type="button"
                onClick={() => setShowPoliciesModal(false)}
                className="text-white/40 hover:text-white/80 rounded-lg p-1 hover:bg-white/[0.06] transition-colors"
                aria-label={t.login.tos.closeButton}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="px-6 pb-4 pt-3 overflow-y-auto custom-scrollbar text-sm text-gray-200 space-y-4 flex-1">
              {activePolicyTab === 'tos' && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">{t.login.tos.tosTitle}</h3>
                  <p className="text-xs text-gray-400 mb-2">{t.login.tos.tosIntro}</p>
                  <h4 className="text-[12px] font-semibold mt-3 mb-1">{t.login.tos.section1Title}</h4>
                  <ul className="list-disc list-inside text-xs text-gray-400 space-y-1">
                    {t.login.tos.section1Items.map((item, idx) => <li key={idx}>{item}</li>)}
                  </ul>
                  <h4 className="text-[12px] font-semibold mt-3 mb-1">{t.login.tos.section2Title}</h4>
                  <p className="text-xs text-gray-400 mb-1">{t.login.tos.section2Intro}</p>
                  <ul className="list-disc list-inside text-xs text-gray-400 space-y-1">
                    {t.login.tos.section2Items.map((item, idx) => <li key={idx}>{item}</li>)}
                  </ul>
                  <h4 className="text-[12px] font-semibold mt-3 mb-1">{t.login.tos.section3Title}</h4>
                  <ul className="list-disc list-inside text-xs text-gray-400 space-y-1">
                    {t.login.tos.section3Items.map((item, idx) => <li key={idx}>{item}</li>)}
                  </ul>
                  <h4 className="text-[12px] font-semibold mt-3 mb-1">{t.login.tos.section4Title}</h4>
                  <p className="text-xs text-gray-400">{t.login.tos.section4Content}</p>
                </div>
              )}
              {activePolicyTab === 'guidelines' && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">{t.login.tos.guidelinesTitle}</h3>
                  <p className="text-xs text-gray-400 mb-2">{t.login.tos.guidelinesIntro}</p>
                  <h4 className="text-[12px] font-semibold mt-3 mb-1">{t.login.tos.sectionATitle}</h4>
                  <ul className="list-disc list-inside text-xs text-gray-400 space-y-1">
                    {t.login.tos.sectionAItems.map((item, idx) => <li key={idx}>{item}</li>)}
                  </ul>
                  <h4 className="text-[12px] font-semibold mt-3 mb-1">{t.login.tos.sectionBTitle}</h4>
                  <ul className="list-disc list-inside text-xs text-gray-400 space-y-1">
                    {t.login.tos.sectionBItems.map((item, idx) => <li key={idx}>{item}</li>)}
                  </ul>
                  <h4 className="text-[12px] font-semibold mt-3 mb-1">{t.login.tos.sectionCTitle}</h4>
                  <p className="text-xs text-gray-400">{t.login.tos.sectionCContent}</p>
                </div>
              )}
              {activePolicyTab === 'sanctions' && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">{t.login.tos.sanctionsTitle}</h3>
                  <p className="text-xs text-gray-400 mb-2">{t.login.tos.sanctionsIntro}</p>
                  <h4 className="text-[12px] font-semibold mt-3 mb-1">{t.login.tos.violationsTitle}</h4>
                  <ul className="list-disc list-inside text-xs text-gray-400 space-y-1">
                    {t.login.tos.violationsItems.map((item, idx) => <li key={idx}>{item}</li>)}
                  </ul>
                  <h4 className="text-[12px] font-semibold mt-3 mb-1">{t.login.tos.actionsTitle}</h4>
                  <p className="text-xs text-gray-400 mb-1">{t.login.tos.actionsIntro}</p>
                  <ul className="list-disc list-inside text-xs text-gray-400 space-y-1">
                    {t.login.tos.actionsItems.map((item, idx) => <li key={idx}>{item}</li>)}
                  </ul>
                  <h4 className="text-[12px] font-semibold mt-3 mb-1">{t.login.tos.legalTitle}</h4>
                  <p className="text-xs text-gray-400">{t.login.tos.legalContent}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-white/[0.06] flex justify-end">
              <button
                type="button"
                onClick={handlePoliciesPrimaryAction}
                className="px-5 py-1.5 rounded-lg text-sm font-semibold text-white btn-glass-primary"
              >
                {isLastPolicyTab ? t.login.tos.understoodButton : t.login.tos.nextButton}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Notification Modal ── */}
      <Modal
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        title={notificationTitle}
        message={notificationMessage}
      />
    </div>
  );
};

export default LoginScreen;
