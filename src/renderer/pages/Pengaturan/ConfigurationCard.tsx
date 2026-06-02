// src/pages/Pengaturan/ConfigurationCard.tsx
import React, { useState } from 'react';
import { ConfigurationCardProps, ConfigStatus } from '../../shared/types/types';
import { ChevronDownIcon } from '../../shared/constants/constants';
import { useLanguage } from '../../shared/i18n';

const ConfigurationCard: React.FC<ConfigurationCardProps> = ({
  icon,
  title,
  description,
  status,
  detailsComponent,
}) => {
  const { t } = useLanguage();
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);

  const statusColor = status === ConfigStatus.Configured ? 'text-green-500' : 'text-red-500';
  const statusText = status === ConfigStatus.Configured ? t.configStatus.configured : t.configStatus.notConfigured;

  const rawTitleForId =
    typeof title === 'string'
      ? title
      : typeof description === 'string'
      ? description
      : 'configuration-card';
  const titleSlug = rawTitleForId.replace(/\s/g, '-');

  const toggleDetails = () => {
    setIsDetailsVisible(!isDetailsVisible);
  };

  return (
    <div
      className="bg-zinc-800 rounded-lg p-6 shadow-xl flex flex-col justify-between"
      aria-labelledby={`card-title-${titleSlug}`}
      style={{
        backgroundColor: '#181818',
        backgroundImage:
          'linear-gradient(135deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent), linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.08) 75%, transparent 75%, transparent), linear-gradient(0deg, rgba(0,0,0,0.24), rgba(0,0,0,0.24))',
        backgroundSize: '12px 12px, 12px 12px, 100% 100%',
        backgroundBlendMode: 'overlay, overlay, normal',
      }}
    >
      <div>
        <div className="flex items-center mb-4">
          {icon}
          <h3 id={`card-title-${titleSlug}`} className="ml-3 text-lg font-semibold text-gray-50">
            {title}
          </h3>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          {description}
        </p>
        <div className="flex items-center text-sm mb-6" aria-live="polite">
          <span className={`h-2.5 w-2.5 rounded-full ${statusColor} bg-current mr-2`} aria-hidden="true"></span>
          <span className={statusColor}>{statusText}</span>
        </div>
      </div>
      <div className="mt-auto"> {/* Ensures button is at the bottom */}
        <button
          onClick={toggleDetails}
          className="flex items-center justify-between w-full px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-gray-300 transition-colors duration-200"
          aria-expanded={isDetailsVisible}
          aria-controls={`details-${titleSlug}`}
        >
          <span>{isDetailsVisible ? t.buttons.hideDetails : t.buttons.showDetails}</span>
          <ChevronDownIcon className={`h-4 w-4 transform transition-transform duration-200 ${isDetailsVisible ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {isDetailsVisible && detailsComponent && (
          <div id={`details-${titleSlug}`} className="mt-4 animate-fadeIn" role="region" aria-labelledby={`card-title-${titleSlug}`}>
            {detailsComponent}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfigurationCard;
