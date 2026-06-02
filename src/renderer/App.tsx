// src/App.tsx
import React, { useEffect, useState } from 'react';

import Sidebar from './shared/components/Sidebar';

import LoginScreen from './pages/Login/LoginScreen';
import LogsPage from './pages/Logs/LogsPage';
import PengaturanPage from './pages/Pengaturan/PengaturanPage';
import PanduanPage from './pages/Panduan/PanduanPage';
import GenerateAffiliatePage from './pages/GenerateAffiliate/GenerateAffiliatePage';
import GenerateCatalogPage from './pages/GenerateCatalog/GenerateCatalogPage';
import GenerateCharacterPage from './pages/GenerateCharacter/GenerateCharacterPage';
import GenerateConceptPage from './pages/GenerateConcept/GenerateConceptPage';
import GenerateProductPage from './pages/GenerateProduct/GenerateProductPage';
import GeneratePosterPage from './pages/GeneratePoster/GeneratePosterPage';
import GenerateAnimationPage from './pages/GenerateAnimation/GenerateAnimationPage';
import GenerateStoryTellerPage from './pages/GenerateStoryTeller/GenerateStoryTeller';
import GenerateCinematicFilmPage from './pages/GenerateCinematicFilm/GenerateCinematicFilmPage';
import GenerateStorySellingPage from './pages/GenerateStorySelling/GenerateStorySellingPage';
import GenerateAdsMakerPage from './pages/GenerateAdsMaker/GenerateAdsMaker';
import PromptFinderPage from './pages/GeneratePromptFinder/PromptFinderPage';
import ImageEditorPage from './pages/GenerateImageEditor/GenerateImageEditorPage';
import VisualImageryPage from './pages/GenerateVisualImagery/GenerateVisualImageryPage';
import GenerateDropItPuzzlePage from './pages/GenerateDropItPuzze/GenerateDropItPuzzle';
import { RenderZeoLogoSvg } from './shared/constants/constants';
import Modal from './shared/components/Modal';
import GradientLoader from './shared/components/GradientLoader';
import { LogType, LogLevel, LogStatus } from './shared/types/types';
import { addRuntimeLog } from './shared/runtimeLogs';
import { useLanguage } from './shared/i18n';
import { useImageResolution } from './shared/utils/useImageResolution';


import './index.css';

const CURRENT_VERSION = '1.1.0';
const VERSION_NOTICE_KEY = `zeoStudio.versionNotice.${CURRENT_VERSION}.dismissed`;
const SESSION_EMAIL_KEY = 'zeoStudio.session.email';
const KEY_BEARER_STATUS = 'zeoStudio.authTest.bearer.status';
const KEY_APIKEY_STATUS = 'zeoStudio.authTest.apiKey.status';
const KEY_BEARER_TOKEN = 'zeoStudio.bearerToken';
const KEY_AI_APIKEY = 'zeoStudio.ai.apiKey';

const AppLoadingScreen: React.FC = () => {
  const { t } = useLanguage();
  
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-6">
        <div className="w-24 h-24 rounded-2xl bg-zinc-900 flex items-center justify-center shadow-lg">
          <RenderZeoLogoSvg className="h-14 w-auto" />
        </div>
        <GradientLoader
          size="md"
          text={t.loadingScreen.title}
          subtitle={t.loadingScreen.loading}
        />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const initialEmailFromStorage = (() => {
    if (typeof window === 'undefined') return '';
    try {
      return window.localStorage.getItem(SESSION_EMAIL_KEY) || '';
    } catch {
      return '';
    }
  })();

  const [activeMenuItem, setActiveMenuItem] = useState<string>('pengaturan');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!initialEmailFromStorage);
  const [isAppLoading, setIsAppLoading] = useState<boolean>(true);
  const [hasLicenseSession, setHasLicenseSession] = useState<boolean>(!!initialEmailFromStorage);

  const [currentUserEmail, setCurrentUserEmail] = useState<string>(initialEmailFromStorage);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState<boolean>(false);
  const [licenseInfo, setLicenseInfo] = useState<any | null>(null);
  const [licenseStatusMessage, setLicenseStatusMessage] = useState<string>('');
  const [isClearingMachine, setIsClearingMachine] = useState<boolean>(false);

  const [isVersionModalOpen, setIsVersionModalOpen] = useState<boolean>(false);
  const [dontShowVersionAgain, setDontShowVersionAgain] = useState<boolean>(false);

  const [imageResolution] = useImageResolution();


  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAppLoading(false);
      addRuntimeLog({
        type: LogType.System,
        level: LogLevel.Info,
        status: LogStatus.Success,
        message: 'Application started successfully',
      });
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;

    const applyResolutionClass = () => {
      root.classList.remove('resolution-compact', 'resolution-qhd');

      if (imageResolution === '1366x768') {
        root.classList.add('resolution-compact');
      } else if (imageResolution === '2560x1440') {
        root.classList.add('resolution-qhd');
      }

      root.dataset.resolution = imageResolution;
    };

    applyResolutionClass();

    return () => {
      root.classList.remove('resolution-compact', 'resolution-qhd');
      delete root.dataset.resolution;
    };
  }, [imageResolution]);

  // Hapus sesi saat aplikasi ditutup KECUALI jika user memilih "Ingat sesi saya".
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleBeforeUnload = () => {
      try {
        const rememberMe = window.localStorage.getItem('zeoStudio.session.rememberMe') === 'true';
        if (!rememberMe) {
          // Keep authentication, cookies, AI config, and workflow IDs persistent across sessions.
          window.localStorage.removeItem(SESSION_EMAIL_KEY);
        }
      } catch {
        // ignore storage errors
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);


  const handleLoginSuccess = (email: string) => {
    setCurrentUserEmail(email);
    setHasLicenseSession(true);
    setIsLoggedIn(true);
    setActiveMenuItem('pengaturan'); // Default to Pengaturan page after login

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(SESSION_EMAIL_KEY, String(email || '').trim().toLowerCase());
      } catch {
        // Abaikan error akses localStorage
      }
    }

    addRuntimeLog({
      type: LogType.System,
      level: LogLevel.Success,
      status: LogStatus.Success,
      message: `User session initialized for ${email}`,
    });

    if (typeof window !== 'undefined') {
      try {
        const dismissed = window.localStorage.getItem(VERSION_NOTICE_KEY) === 'true';
        if (!dismissed) {
          setDontShowVersionAgain(false);
          setIsVersionModalOpen(true);
        }
      } catch {
        // Abaikan error akses localStorage
      }
    }
  };

  const handleNavigate = (path: string) => {
    const menuItemId = path.split('/').pop() || '';
    setActiveMenuItem(menuItemId);
    console.log(`Navigating to: ${path}`);
    addRuntimeLog({
      type: LogType.Navigation,
      level: LogLevel.Info,
      status: LogStatus.Success,
      message: `Navigated to ${path}`,
    });
    if (path === '/logout') {
      // Logout penuh: sesi lisensi dan state UI di-reset
      setIsLoggedIn(false);
      setHasLicenseSession(false);
      setActiveMenuItem('');
      setCurrentUserEmail('');

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(SESSION_EMAIL_KEY);
        } catch {
          // Abaikan error akses localStorage
        }
      }
    }
  };

  if (typeof window !== 'undefined') {
    (window as any).zeoNavigate = handleNavigate;
  }

  const handleLogoClick = () => {
    // Jika belum ada sesi lisensi, cukup tetap di layar login awal
    if (!hasLicenseSession) {
      return;
    }

    // Jika sudah ada sesi lisensi, hanya kembali ke tampilan login
    // namun tidak menghapus sesi lisensi maupun email.
    setIsLoggedIn(false);
    setActiveMenuItem('');
  };

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handleSidebarFooterClick = async () => {
    if (!currentUserEmail) {
      setLicenseInfo(null);
      setLicenseStatusMessage('Anda belum login dengan email yang valid. Silakan login kembali.');
      setIsLicenseModalOpen(true);
      return;
    }

    if (typeof window === 'undefined' || !window.zeoAPI) {
      setLicenseInfo(null);
      setLicenseStatusMessage(
        'Informasi lisensi tidak dapat ditampilkan karena bridge Electron belum aktif. Pastikan aplikasi berjalan sebagai desktop app.',
      );
      setIsLicenseModalOpen(true);
      return;
    }

    try {
      setLicenseInfo(null);
      setLicenseStatusMessage('Mengambil informasi lisensi...');
      setIsLicenseModalOpen(true);

      const result = window.zeoAPI.getLicenseInfo
        ? await window.zeoAPI.getLicenseInfo({ email: currentUserEmail })
        : undefined;

      if (result && result.ok && result.license) {
        setLicenseInfo(result.license);
        setLicenseStatusMessage(result.message || 'Informasi lisensi berhasil diambil.');
      } else if (result) {
        setLicenseInfo(null);
        setLicenseStatusMessage(
          result.message || 'Informasi lisensi tidak dapat diambil. Coba lagi beberapa saat lagi.',
        );
      } else {
        setLicenseInfo(null);
        setLicenseStatusMessage('Informasi lisensi tidak dapat diambil. Coba lagi beberapa saat lagi.');
      }
    } catch (error) {
      setLicenseInfo(null);
      setLicenseStatusMessage('Terjadi kesalahan saat mengambil informasi lisensi. Coba lagi beberapa saat lagi.');
    }
  };

  const handleCloseLicenseModal = () => {
    setIsLicenseModalOpen(false);
    setIsClearingMachine(false);
  };

  const handleClearMachineId = async () => {
    if (!currentUserEmail || typeof window === 'undefined' || !window.zeoAPI?.clearLicenseMachine) {
      return;
    }

    try {
      setIsClearingMachine(true);
      const result = await window.zeoAPI.clearLicenseMachine({ email: currentUserEmail });

      if (result && typeof result.message === 'string') {
        setLicenseStatusMessage(result.message);
      }

      if (result && result.ok) {
        // Setelah Mesin ID dihapus, otomatis logout penuh dan kembali ke layar login.
        setIsLoggedIn(false);
        setHasLicenseSession(false);
        setActiveMenuItem('');
        setCurrentUserEmail('');
        setIsLicenseModalOpen(false);
      }
    } catch (error) {
      setLicenseStatusMessage('Permintaan hapus Mesin ID gagal. Coba lagi beberapa saat lagi.');
    } finally {
      setIsClearingMachine(false);
    }
  };

  const handleCloseVersionModal = () => {
    if (typeof window !== 'undefined' && dontShowVersionAgain) {
      try {
        window.localStorage.setItem(VERSION_NOTICE_KEY, 'true');
      } catch {
        // Abaikan error akses localStorage
      }
    }
    setIsVersionModalOpen(false);
  };

  if (isAppLoading) {
    return <AppLoadingScreen />;
  }

  // Jika belum ada sesi lisensi sama sekali, tampilkan login normal (cek lisensi penuh)
  if (!hasLicenseSession) {
    return (
      <>
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  // Jika sudah ada sesi lisensi tetapi UI sedang di layar login
  // (misalnya setelah user klik logo Viral), tampilkan login dengan email terisi dan disembunyikan.
  if (!isLoggedIn) {
    return (
      <>
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          initialEmail={currentUserEmail}
          hasActiveSession
        />
      </>
    );
  }

  return (
    <>
      <div className="flex h-screen bg-gray-950 rm-main-background">
        <Sidebar
          activeItem={activeMenuItem}
          onNavigate={handleNavigate}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
          onLogoClick={handleLogoClick}
          onFooterClick={handleSidebarFooterClick}
        />

        <main
          className={`flex-1 overflow-y-auto custom-scrollbar transition-[margin] duration-500 ease-in-out
          ${isSidebarCollapsed ? 'ml-[72px]' : 'ml-[220px]'}
        `}
        >
          {/* Render all pages and control visibility with CSS */}
          <div className={`p-8 ${activeMenuItem === 'pengaturan' ? 'block' : 'hidden'}`}>
            <PengaturanPage />
          </div>
          <div className={`p-8 ${activeMenuItem === 'panduan' ? 'block' : 'hidden'}`}>
            <PanduanPage />
          </div>
          <div className={`p-8 ${activeMenuItem === 'logs' ? 'block' : 'hidden'}`}>
            <LogsPage />
          </div>
          {/* Add more conditional rendering for other menu items as needed */}
          <div className={`h-full ${activeMenuItem === 'prompt-finder' ? 'block' : 'hidden'}`}>
            <PromptFinderPage />
          </div>
          <div className={`h-full ${activeMenuItem === 'image-editor' ? 'block' : 'hidden'}`}>
            <ImageEditorPage />
          </div>
          <div className={`h-full ${activeMenuItem === 'visual-imagery' ? 'block' : 'hidden'}`}>
            <VisualImageryPage />
          </div>
          <div className={`h-full ${activeMenuItem === 'drop-it-puzzle' ? 'block' : 'hidden'}`}>
            <GenerateDropItPuzzlePage />
          </div>
          <div className={`h-full ${activeMenuItem === 'generate-affiliate' ? 'block' : 'hidden'}`}>
            <GenerateAffiliatePage />
          </div>
          <div className={`h-full ${activeMenuItem === 'generate-catalog' ? 'block' : 'hidden'}`}>
            <GenerateCatalogPage />
          </div>
          <div className={`h-full ${activeMenuItem === 'generate-adsmaker' ? 'block' : 'hidden'}`}>
            <GenerateAdsMakerPage />
          </div>
          <div className={`h-full ${activeMenuItem === 'generate-poster' ? 'block' : 'hidden'}`}>
            <GeneratePosterPage />
          </div>
          <div className={`h-full ${activeMenuItem === 'generate-story' ? 'block' : 'hidden'}`}>
            <GenerateAnimationPage />
          </div>
          <div className={`h-full ${activeMenuItem === 'generate-storyteller' ? 'block' : 'hidden'}`}>
            <GenerateStoryTellerPage />
          </div>
          <div className={`h-full ${activeMenuItem === 'generate-cinematicfilm' ? 'block' : 'hidden'}`}>
            <GenerateCinematicFilmPage />
          </div>
          <div className={`h-full ${activeMenuItem === 'generate-character' ? 'block' : 'hidden'}`}>
            <GenerateCharacterPage />
          </div>
          <div className={`h-full ${activeMenuItem === 'generate-concept' ? 'block' : 'hidden'}`}>
            <GenerateConceptPage />
          </div>
          <div className={`h-full ${activeMenuItem === 'generate-product' ? 'block' : 'hidden'}`}>
            <GenerateProductPage />
          </div>
          <div className={`h-full ${activeMenuItem === 'generate-storyselling' ? 'block' : 'hidden'}`}>
            <GenerateStorySellingPage />
          </div>

          {/* License info modal triggered from sidebar footer */}
          <Modal
            isOpen={isLicenseModalOpen}
            onClose={handleCloseLicenseModal}
            onConfirm={licenseInfo ? handleClearMachineId : undefined}
            confirmButtonText="Hapus Mesin ID"
            confirmButtonColor="btn-glass-primary bg-red-600 hover:bg-red-700"
            showUpdateLabel={false}
            title="Informasi Lisensi Akun"
            message={(
              <div className="space-y-2 text-sm text-gray-200">
                {licenseInfo && (
                  <>
                    <div>
                      <span className="font-semibold">Email:</span> {licenseInfo.email || currentUserEmail}
                    </div>
                    <div>
                      <span className="font-semibold">Tanggal Join:</span> {licenseInfo.tanggalJoin || '-'}
                    </div>
                    <div>
                      <span className="font-semibold">Tanggal Berakhir:</span> {licenseInfo.tanggalBerakhir || '-'}
                    </div>
                    <div>
                      <span className="font-semibold">Mesin ID 1:</span>{' '}
                      <span className="break-all">{licenseInfo.mesinId1 || '-'}</span>
                    </div>
                  </>
                )}
                <p className="text-gray-300 text-xs whitespace-pre-line">{licenseStatusMessage}</p>
              </div>
            )}
          />

          {/* Version update modal */}
          <Modal
            isOpen={isVersionModalOpen}
            onClose={handleCloseVersionModal}
            showUpdateLabel
            message={(
              <div className="space-y-3 text-sm text-gray-200">
                <p><strong>Viral Studio v{CURRENT_VERSION}</strong> — Catatan singkat untuk pengguna.</p>
                <ul className="list-disc ml-4 space-y-1 text-gray-200">
                  <li>Ads Maker: label sudut kini murni dari AI (Gemini 2.5 flash) tanpa fallback lokal.</li>
                  <li>Tombol Generate terkunci sampai 12 label AI siap; label kartu mengikuti log AI.</li>
                </ul>
                <p className="text-xs text-gray-400">Versi 1.1.0 · 3 Jun 2026</p>
              </div>
            )} title={''}          />
        </main>
      </div>
    </>
  );
};

export default App;
