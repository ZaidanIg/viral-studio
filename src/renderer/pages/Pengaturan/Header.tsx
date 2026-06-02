// src/pages/Pengaturan/Header.tsx
import React from 'react';
import { ClearDataIcon } from '../../shared/constants/constants';
import { ConfigurationOptionsIcon } from './PengaturanConstants';
import { useLanguage } from '../../shared/i18n';

interface HeaderProps {
  onClearData: () => void;
  onSaveAll: () => void; // New prop for saving all configs
  isAnyConfigModified: boolean; // Prop to indicate if any config is modified
}

const SETTINGS_TUTORIAL_URL = 'https://www.youtube.com/embed/MbCTStT3kiI?autoplay=1&mute=1&origin=http://localhost:3000';

const Header: React.FC<HeaderProps> = ({ onClearData, onSaveAll, isAnyConfigModified }) => {
  const { t } = useLanguage();
  
  // Determine button text and color based on isAnyConfigModified
  const saveAllButtonText = isAnyConfigModified ? t.settings.header.saveConfiguration : t.configStatus.saved;
  // If modified, it's blue and active. If not modified, it's gray and disabled.
  const saveAllButtonColor = isAnyConfigModified
    ? 'btn-glass-primary bg-blue-600 hover:bg-blue-700'
    : 'bg-gray-600 text-gray-400 cursor-not-allowed';

  const handleOpenTutorial = () => {
    const url = SETTINGS_TUTORIAL_URL.replace('/embed/', '/watch?v=');
    const api = (window as any).zeoAPI;
    if (api?.openTutorialWindow) {
      api.openTutorialWindow({ url });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className="flex items-center justify-between p-6 bg-zinc-800 rounded-lg mb-6 shadow-md electron-drag select-none"
      role="banner"
      style={{
        backgroundColor: '#181818',
        backgroundImage:
          'linear-gradient(135deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent), linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.08) 75%, transparent 75%, transparent), linear-gradient(0deg, rgba(0,0,0,0.24), rgba(0,0,0,0.24))',
        backgroundSize: '12px 12px, 12px 12px, 100% 100%',
        backgroundBlendMode: 'overlay, overlay, normal',
      }}
    >
      <h2 className="text-xl font-bold text-gray-50 flex items-center">
        <ConfigurationOptionsIcon />
        {t.settings.header.title.toUpperCase()}
      </h2>
      <div className="flex items-center space-x-3 electron-no-drag">
        <button
          onClick={handleOpenTutorial}
          className="flex items-center px-4 py-2 text-white font-semibold rounded-lg shadow-md transition-all duration-200 btn-glass-primary bg-blue-600 hover:bg-blue-700"
          aria-label="Tutorial Pengaturan"
        >
          Tutorial
        </button>
        <button
          onClick={onSaveAll}
          className={`flex items-center px-4 py-2 text-white font-semibold rounded-lg shadow-md transition-all duration-200
            ${saveAllButtonColor}
          `}
          aria-label={t.settings.header.saveConfiguration}
          disabled={!isAnyConfigModified} // Button is disabled when no configurations are modified
        >
          {saveAllButtonText}
        </button>
        <button
          onClick={onClearData}
          className="flex items-center px-4 py-2 text-white font-semibold rounded-lg shadow-md transition-all duration-200 btn-glass-primary bg-red-600 hover:bg-red-700"
          aria-label={t.settings.header.clearData}
        >
          <ClearDataIcon />
          {t.settings.header.clearData}
        </button>
      </div>
    </div>
  );
};

export default Header;
