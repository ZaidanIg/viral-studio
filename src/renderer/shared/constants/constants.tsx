// src/shared/constants/constants.tsx

import React from 'react';
import { NavItem } from '../types/types';

// ─── Viral Studio SVG Logo ──────────────────────────────────────────────────
export const RenderZeoLogoSvg: React.FC<React.SVGProps<SVGSVGElement> & { className?: string }> = ({ className, ...rest }) => (
  <svg
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className || 'h-8 w-8'}
    aria-label="Viral Studio"
    {...rest}
  >
    <defs>
      <linearGradient id="vs-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stopColor="#22d3ee" />
        <stop offset="50%"  stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#ec4899" />
      </linearGradient>
      <linearGradient id="vs-logo-grad2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stopColor="#38e8ff" />
        <stop offset="100%" stopColor="#c084fc" />
      </linearGradient>
    </defs>
    {/* Outer hexagon-ish rounded shape */}
    <rect x="2" y="2" width="36" height="36" rx="11" fill="rgba(139,92,246,0.12)" stroke="url(#vs-logo-grad2)" strokeWidth="1.2" />
    {/* "V" shape — lightning bolt style */}
    <path
      d="M10 11 L17 29 L20 22 L23 29 L30 11"
      stroke="url(#vs-logo-grad)"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Spark dot at top center */}
    <circle cx="20" cy="8" r="1.5" fill="url(#vs-logo-grad)" opacity="0.8" />
  </svg>
);

// ─── Navigation Icons ────────────────────────────────────────────────────────

const StockFootageIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const CinematicFilmIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 6.5h16l-1.2 3H5.2L4 6.5Z" />
    <path d="M6.5 6.5l2 3M11 6.5l2 3M15.5 6.5l2 3" />
    <rect x="4" y="9" width="16" height="9.5" rx="1.8" />
    <path d="M11 11.8l3.4 2-3.4 2v-4Z" fill="currentColor" stroke="none" />
  </svg>
);

const ImageEditorIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="M21 16l-4.086-4.086a2 2 0 0 0-2.828 0L8 18" />
  </svg>
);

const VisualImageryIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <rect x="3" y="4" width="18" height="14" rx="2" ry="2" />
    <path d="M3 10h18" />
    <circle cx="9" cy="8" r="1.2" />
    <path d="M8 16l3.5-3.5a1.5 1.5 0 0 1 2.1 0L17 16" />
  </svg>
);

const DropPuzzleIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 11a2 2 0 1 1 2-2h2.5a1.5 1.5 0 0 0 0-3H9V4a2 2 0 1 0-4 0v4.5A1.5 1.5 0 0 0 6.5 10H8zm8 2a2 2 0 1 0-2 2h-2.5a1.5 1.5 0 0 0 0 3H15v2a2 2 0 1 0 4 0v-4.5A1.5 1.5 0 0 0 17.5 13H16z" />
  </svg>
);

const PromptFinderIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.35-4.35" />
    <path d="M8.5 11h5M11 8.5v5" strokeWidth={1.6} />
  </svg>
);

const PromptToVideoIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 4v16M17 4v16M3 8h4m-4 8h4m10-8h4m-4 8h4M7 8a4 4 0 014-4h4a4 4 0 014 4v8a4 4 0 01-4 4h-4a4 4 0 01-4-4V8z" />
  </svg>
);

const BuildStoryIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const StoryTellerIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 15c0-2.21 1.79-4 4-4s4 1.79 4 4v4H8v-4zM12 5a3 3 0 1 1-3 3 3 3 0 0 1 3-3z" />
  </svg>
);

const StorySellingIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6zm4 4.5h6m-6 3h4M7 6V4h10v2" />
  </svg>
);

const AdsMakerIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5.9V19a1 1 0 0 0 1.55.83L17 17h1a3 3 0 0 0 3-3v-1a3 3 0 0 0-3-3h-1l-4.45-2.78A1 1 0 0 0 11 7.12V5.9zM5 10H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h1a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2z" />
  </svg>
);

const MakeStoryboardIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const PosterIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <rect x="5" y="3" width="14" height="18" rx="2" ry="2" />
    <path d="M8 7h8M8 11h5M8 15h6" strokeLinecap="round" />
  </svg>
);

const AffiliateIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const CatalogIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" ry="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" ry="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" ry="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" ry="1.5" />
  </svg>
);

const CharacterIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

const ConceptIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a7 7 0 0 1 5.35 11.53L17 17H7l-.35-3.47A7 7 0 0 1 12 2z" />
    <path d="M10 22h4M11 17v5" />
  </svg>
);

const ProductIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
  </svg>
);

export const EmailIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

export const LogsIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 7h14M5 12h14M5 17h9" />
  </svg>
);

const PengaturanIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const GuideIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 22l-2.09-9.26L4 10l5.91-2.74L12 2z" />
  </svg>
);

export const LogoutIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

// ─── Navigation Items ─────────────────────────────────────────────────────────

export const NAV_ITEMS: NavItem[] = [
  { id: 'prompt-finder',          label: 'Prompt Finder',         icon: <PromptFinderIcon />,    path: '/prompt-finder' },
  { id: 'image-editor',           label: 'Image Editor',          icon: <ImageEditorIcon />,     path: '/image-editor' },
  { id: 'visual-imagery',         label: 'Visual Imagery',        icon: <VisualImageryIcon />,   path: '/visual-imagery' },
  { id: 'drop-it-puzzle',         label: 'Drop It Puzzle',        icon: <DropPuzzleIcon />,      path: '/drop-it-puzzle' },
  { id: 'short-movie',            label: 'Brand Generator',       icon: <StockFootageIcon />,    path: '/short-movie' },
  { id: 'generate-character',     label: 'Character',             icon: <CharacterIcon />,       path: '/generate-character' },
  { id: 'generate-product',       label: 'Product',               icon: <ProductIcon />,         path: '/generate-product' },
  { id: 'generate-concept',       label: 'Concept',               icon: <ConceptIcon />,         path: '/generate-concept' },
  { id: 'generate-poster',        label: 'Poster',                icon: <PosterIcon />,          path: '/generate-poster' },
  { id: 'generate-catalog',       label: 'Catalog',               icon: <CatalogIcon />,         path: '/generate-catalog' },
  { id: 'generate-affiliate',     label: 'Affiliate',             icon: <AffiliateIcon />,       path: '/generate-affiliate' },
  { id: 'generate-storyselling',  label: 'Story Selling',         icon: <StorySellingIcon />,    path: '/generate-storyselling' },
  { id: 'generate-adsmaker',      label: 'Ads Maker',             icon: <AdsMakerIcon />,        path: '/generate-adsmaker' },
  { id: 'generate-story',         label: 'Animation',             icon: <BuildStoryIcon />,      path: '/generate-story' },
  { id: 'generate-storyteller',   label: 'Story Teller',          icon: <StoryTellerIcon />,     path: '/generate-storyteller' },
  { id: 'generate-cinematicfilm', label: 'Cinematic Film',        icon: <CinematicFilmIcon />,   path: '/generate-cinematicfilm' },
  { id: 'setting',                label: 'Setting',               icon: <PengaturanIcon />,      path: '/setting' },
  { id: 'pengaturan',             label: 'Pengaturan',            icon: <PengaturanIcon />,      path: '/pengaturan' },
  { id: 'panduan',                label: 'Panduan',               icon: <GuideIcon />,           path: '/panduan' },
  { id: 'logs',                   label: 'Logs',                  icon: <LogsIcon />,            path: '/logs' },
  { id: 'logout',                 label: 'Logout',                icon: <LogoutIcon />,          path: '/logout' },
];

export const getNavIconById = (id: string, className?: string): React.ReactNode => {
  const navIcon = NAV_ITEMS.find((item) => item.id === id)?.icon;
  if (!navIcon || !React.isValidElement(navIcon)) return navIcon ?? null;
  const mergedClassName = className ?? navIcon.props.className ?? 'h-4 w-4';
  return React.cloneElement(navIcon, { className: mergedClassName });
};

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'unique',
    label: 'Brand Generator',
    items: NAV_ITEMS.filter((item) =>
      ['generate-character','generate-product','generate-concept','generate-poster','generate-catalog','generate-affiliate','generate-storyselling','generate-adsmaker'].includes(item.id)),
  },
  {
    id: 'asset',
    label: 'Creator',
    items: NAV_ITEMS.filter((item) => ['generate-story','generate-storyteller','generate-cinematicfilm'].includes(item.id)),
  },
  {
    id: 'labs',
    label: 'Labs',
    items: NAV_ITEMS.filter((item) => ['prompt-finder','image-editor','visual-imagery','drop-it-puzzle'].includes(item.id)),
  },
  {
    id: 'setting',
    label: 'System',
    items: NAV_ITEMS.filter((item) => ['pengaturan','panduan','logs'].includes(item.id)),
  },
];

export const LOGOUT_ITEM: NavItem =
  NAV_ITEMS.find((item) => item.id === 'logout') || NAV_ITEMS[NAV_ITEMS.length - 1];

export const FOOTER_TEXT = 'Developed by Ngulik AI Community';
export const LOGIN_FOOTER_TEXT = 'Developed by Ngulik AI Community';

// ─── General UI Icons ─────────────────────────────────────────────────────────

export const ChevronDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

export const ClearDataIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export const ChevronLeftIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

export const ChevronRightIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);
