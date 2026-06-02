// src/shared/components/Sidebar.tsx
import React from 'react';
import {
  NAV_SECTIONS,
  LOGOUT_ITEM,
  RenderZeoLogoSvg,
  ChevronDownIcon,
} from '../constants/constants';
import { useLanguage } from '../i18n';
import { NavItem } from '../types/types';

interface SidebarProps {
  activeItem: string;
  onNavigate: (path: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onLogoClick: () => void;
  onFooterClick: () => void;
}

// Minimal chevron icon for collapse toggle
const CollapseIcon: React.FC<{ rotated?: boolean }> = ({ rotated }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={`h-3.5 w-3.5 transition-transform duration-300 ${rotated ? 'rotate-180' : ''}`}
    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const Sidebar: React.FC<SidebarProps> = ({
  activeItem, onNavigate, isCollapsed, onToggleCollapse, onLogoClick, onFooterClick
}) => {
  const { t } = useLanguage();
  const [openSectionId, setOpenSectionId] = React.useState<string>('unique');
  const [bearerJenis, setBearerJenis] = React.useState<string>('');

  React.useEffect(() => {
    const checkBearerJenis = () => {
      if (typeof window !== 'undefined') {
        setBearerJenis((localStorage.getItem('zeoStudio.bearerJenis') || '').toLowerCase());
      }
    };
    checkBearerJenis();
    const handle = () => checkBearerJenis();
    window.addEventListener('zeo:auth-mode-changed', handle);
    window.addEventListener('storage', handle);
    return () => {
      window.removeEventListener('zeo:auth-mode-changed', handle);
      window.removeEventListener('storage', handle);
    };
  }, []);

  const getNavLabel = (itemId: string): string => {
    const labelMap: Record<string, string> = {
      'prompt-finder': t.pages.promptFinder,
      'image-editor': t.pages.imageEditor,
      'visual-imagery': 'Visual Imagery',
      'drop-it-puzzle': 'Drop It Puzzle',
      'short-movie': 'Brand Generator',
      'generate-affiliate': 'Affiliate',
      'generate-catalog': 'Catalog',
      'generate-adsmaker': 'Ads Maker',
      'generate-poster': 'Poster',
      'generate-story': 'Animation',
      'generate-storyselling': 'Story Selling',
      'generate-character': 'Character',
      'generate-concept': 'Concept',
      'generate-product': 'Product',
      'generate-storyteller': 'Story Teller',
      'generate-cinematicfilm': 'Cinematic Film',
      'setting': 'Setting',
      'pengaturan': t.sidebar.setting,
      'panduan': t.pages.guide,
      'logs': t.pages.logs,
      'logout': t.common.logout,
    };
    return labelMap[itemId] || itemId;
  };

  const getSectionLabel = (sectionId: string): string => {
    const sectionMap: Record<string, string> = {
      'labs': 'Labs',
      'unique': 'Brand Generator',
      'asset': 'Creator',
      'setting': 'System',
    };
    return sectionMap[sectionId] || sectionId;
  };

  React.useEffect(() => {
    const matchingSection = NAV_SECTIONS.find((section) =>
      section.items.some((item) => item.id === activeItem),
    );
    if (matchingSection) setOpenSectionId(matchingSection.id);
  }, [activeItem]);

  return (
    <aside
      className={`vs-sidebar flex flex-col h-screen fixed top-0 left-0 z-40 transition-[width] duration-300 ease-in-out
        ${isCollapsed ? 'w-[72px]' : 'w-[220px]'}`}
      aria-label="Main sidebar navigation"
    >
      {/* ── Logo Header ── */}
      <button
        onClick={onLogoClick}
        className={`flex items-center gap-3 px-4 py-4 border-b border-white/[0.06] w-full overflow-hidden
          focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:ring-inset
          transition-opacity duration-200 hover:opacity-80 cursor-pointer electron-drag
          ${isCollapsed ? 'justify-center' : ''}`}
        aria-label="Viral Studio — Go to Home"
      >
        <RenderZeoLogoSvg className="h-7 w-7 flex-shrink-0" />
        {!isCollapsed && (
          <div className="min-w-0 text-left">
            <span className="block text-[13px] font-bold text-white tracking-tight whitespace-nowrap">
              Viral Studio
            </span>
            <span className="block text-[9px] text-white/30 tracking-widest uppercase font-medium">
              AI Creative Suite
            </span>
          </div>
        )}
      </button>

      {/* ── Navigation ── */}
      <nav className="flex-grow px-2.5 py-2 overflow-y-auto custom-scrollbar space-y-0.5">
        {isCollapsed ? (
          // Collapsed: show only active item icon + all items as icon-only
          NAV_SECTIONS.map((section) =>
            section.items.map((item: NavItem) => {
              const isActive = activeItem === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.path)}
                  className={`vs-nav-item justify-center ${isActive ? 'active' : ''}`}
                  style={{ padding: '10px' }}
                  aria-label={getNavLabel(item.id)}
                  title={getNavLabel(item.id)}
                >
                  {item.icon}
                </button>
              );
            })
          )
        ) : (
          NAV_SECTIONS.map((section) => (
            <div key={section.id} className="mb-1">
              {/* Section toggle header */}
              <button
                type="button"
                onClick={() => setOpenSectionId(openSectionId === section.id ? '' : section.id)}
                className="flex items-center justify-between w-full px-2 pt-4 pb-1.5 text-[10px] font-semibold tracking-widest uppercase text-white/25 hover:text-white/50 transition-colors duration-150"
              >
                <span>{getSectionLabel(section.id)}</span>
                <ChevronDownIcon
                  className={`h-2.5 w-2.5 transition-transform duration-200 ${
                    openSectionId === section.id ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Section items */}
              {openSectionId === section.id && (
                <div className="space-y-0.5 mt-0.5">
                  {section.items.map((item: NavItem) => {
                    const isActive = activeItem === item.id;
                    const lengkapOnlyMenus = ['generate-storyselling', 'visual-imagery', 'drop-it-puzzle'];
                    const isDisabled = lengkapOnlyMenus.includes(item.id) && bearerJenis === 'image';
                    const disabledMsg = isDisabled
                      ? 'Bearer "image" tidak dapat digunakan di halaman ini.'
                      : '';

                    return (
                      <button
                        key={item.id}
                        onClick={() => !isDisabled && onNavigate(item.path)}
                        className={`vs-nav-item ${isActive ? 'active' : ''} ${isDisabled ? 'opacity-35 cursor-not-allowed' : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={getNavLabel(item.id)}
                        disabled={isDisabled}
                        title={disabledMsg}
                      >
                        {item.icon}
                        <span className="truncate">{getNavLabel(item.id)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}

        {/* Logout */}
        {!isCollapsed && (
          <div className="pt-3 mt-2 border-t border-white/[0.05]">
            <button
              onClick={() => onNavigate(LOGOUT_ITEM.path)}
              className="vs-nav-item text-red-400/70 hover:text-red-400 hover:bg-red-500/8"
              aria-label={t.common.logout}
            >
              {LOGOUT_ITEM.icon}
              <span>{t.common.logout}</span>
            </button>
          </div>
        )}
      </nav>

      {/* ── Footer ── */}
      <div className="px-2.5 py-3 border-t border-white/[0.05] space-y-2">
        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className={`w-full h-8 rounded-lg text-xs text-white/40 flex items-center justify-center
            hover:bg-white/[0.05] hover:text-white/70 transition-all duration-200`}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          <CollapseIcon rotated={isCollapsed} />
          {!isCollapsed && <span className="ml-1.5 text-[10px] font-medium">Collapse</span>}
        </button>

        {/* Version badge */}
        {!isCollapsed && (
          <button
            onClick={onFooterClick}
            className="w-full h-7 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer
              text-[10px] font-semibold text-white/50 hover:text-white/80
              hover:bg-white/[0.05] transition-all duration-200"
            aria-label={t.sidebar.footerVersion}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            v1.1.0
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
