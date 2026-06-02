import React from 'react';
import { useLanguage } from '../../shared/i18n';

const GuideHeaderIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-6 w-6 mr-3 text-sky-400"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V5Z" />
    <path d="M9 7h6" />
    <path d="M9 11h4" />
  </svg>
);

interface GuideSectionProps {
  tag: string;
  title: string;
  description: string;
  points: string[];
  path?: string;
  t?: any;
}

const GuideSection: React.FC<GuideSectionProps> = ({ tag, title, description, points, path, t }) => {
  const handleNavigate = () => {
    if (!path) return;
    if (typeof window !== 'undefined' && (window as any).zeoNavigate) {
      (window as any).zeoNavigate(path);
    }
  };

  return (
    <section
      className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3 h-full"
      style={{
        backgroundColor: '#181818',
        backgroundImage:
          'linear-gradient(135deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent), linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.08) 75%, transparent 75%, transparent), linear-gradient(0deg, rgba(0,0,0,0.24), rgba(0,0,0,0.24))',
        backgroundSize: '12px 12px, 12px 12px, 100% 100%',
        backgroundBlendMode: 'overlay, overlay, normal',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-purple-300">{tag}</p>
          <h3 className="text-sm font-semibold text-gray-50">{title}</h3>
        </div>
        {path && (
          <button
            type="button"
            onClick={handleNavigate}
            className="px-2.5 py-1 rounded-md text-[10px] font-semibold text-white btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 border border-transparent transition-colors duration-200"
          >
            {t.buttons.viewPage}
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
      <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </section>
  );
};

const PanduanPage: React.FC = () => {
  const { t } = useLanguage();
  
  const handleOpenSettings = () => {
    if (typeof window !== 'undefined' && (window as any).zeoNavigate) {
      (window as any).zeoNavigate('/pengaturan');
    }
  };

  return (
    <div className="h-full w-full flex flex-col min-h-0 text-gray-50">
      <div className="flex-shrink-0 electron-drag select-none">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
          <GuideHeaderIcon />
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-50">{t.guide.title}</h1>
            <p className="text-xs text-gray-400">{t.guide.description}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="space-y-6">
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4"
            style={{
              backgroundColor: '#181818',
              backgroundImage:
                'linear-gradient(135deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent), linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.08) 75%, transparent 75%, transparent), linear-gradient(0deg, rgba(0,0,0,0.24), rgba(0,0,0,0.24))',
              backgroundSize: '12px 12px, 12px 12px, 100% 100%',
              backgroundBlendMode: 'overlay, overlay, normal',
            }}
          >
            <h2 className="text-base font-semibold text-gray-50 flex items-center gap-2">
              <span>⚡</span> {t.guide.quickStart}
            </h2>
            <ul className="space-y-2 text-xs text-gray-300">
              {t.guide.quickStartItems.map((item, index) => (
                <li key={index} className="flex gap-2">
                  <span className="text-purple-400">{index + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={handleOpenSettings}
                className="px-3 py-2 rounded-lg text-[11px] font-semibold text-white btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 border border-transparent transition-colors duration-200"
              >
                {t.buttons.viewSettings}
              </button>
            </div>
          </div>

          <div
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4"
            style={{
              backgroundColor: '#181818',
              backgroundImage:
                'linear-gradient(135deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent), linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.08) 75%, transparent 75%, transparent), linear-gradient(0deg, rgba(0,0,0,0.24), rgba(0,0,0,0.24))',
              backgroundSize: '12px 12px, 12px 12px, 100% 100%',
              backgroundBlendMode: 'overlay, overlay, normal',
            }}
          >
            <h2 className="text-base font-semibold text-gray-50 flex items-center gap-2">
              <span>🧭</span> {t.guide.navigationTips}
            </h2>
            <ul className="space-y-2 text-xs text-gray-300 list-disc list-inside">
              {t.guide.navigationTipsItems.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {t.guide.sections.map((section) => (
              <GuideSection key={section.title} {...section} t={t} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PanduanPage;
