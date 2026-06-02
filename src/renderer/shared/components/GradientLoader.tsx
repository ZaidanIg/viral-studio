import React from 'react';

interface GradientLoaderProps {
  /**
   * Ukuran loader
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Text utama dengan gradient
   */
  text?: string;
  
  /**
   * Subtitle text (tanpa gradient)
   */
  subtitle?: string;
  
  /**
   * Custom className untuk container
   */
  className?: string;
  
  /**
   * Mode tampilan
   */
  mode?: 'spinner-only' | 'with-text';
}

const GradientLoader: React.FC<GradientLoaderProps> = ({
  size = 'md',
  text,
  subtitle,
  className = '',
  mode = 'with-text'
}) => {
  const sizeConfig = {
    sm: {
      outerRing: 'w-8 h-8 border-2',
      innerRing: 'w-6 h-6 border-2',
      innerPosition: 'top-1 left-1',
      textSize: 'text-xs',
      subtitleSize: 'text-[10px]',
      gap: 'gap-2'
    },
    md: {
      outerRing: 'w-16 h-16 border-4',
      innerRing: 'w-12 h-12 border-4',
      innerPosition: 'top-2 left-2',
      textSize: 'text-sm',
      subtitleSize: 'text-xs',
      gap: 'gap-4'
    },
    lg: {
      outerRing: 'w-24 h-24 border-[6px]',
      innerRing: 'w-18 h-18 border-[6px]',
      innerPosition: 'top-3 left-3',
      textSize: 'text-base',
      subtitleSize: 'text-sm',
      gap: 'gap-6'
    }
  };

  const config = sizeConfig[size];

  const defaultText = text || 'Processing...';
  const defaultSubtitle = subtitle || 'Mohon tunggu, proses sedang berjalan';

  if (mode === 'spinner-only') {
    return (
      <div className={`inline-block ${className}`}>
        <div className="relative">
          <div className={`${config.outerRing} border-cyan-500/30 rounded-full`}></div>
          <div className={`${config.outerRing} border-transparent border-t-cyan-400 border-r-purple-400 rounded-full animate-spin absolute top-0 left-0`}></div>
          <div className={`${config.innerRing} border-transparent border-t-pink-400 border-r-cyan-400 rounded-full animate-spin absolute ${config.innerPosition}`} style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`flex flex-col items-center ${config.gap}`}>
        <div className="relative">
          <div className={`${config.outerRing} border-cyan-500/30 rounded-full`}></div>
          <div className={`${config.outerRing} border-transparent border-t-cyan-400 border-r-purple-400 rounded-full animate-spin absolute top-0 left-0`}></div>
          <div className={`${config.innerRing} border-transparent border-t-pink-400 border-r-cyan-400 rounded-full animate-spin absolute ${config.innerPosition}`} style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
        </div>
        <div className="text-center space-y-1">
          <p className={`${config.textSize} font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent`}>
            {defaultText}
          </p>
          <p className={`${config.subtitleSize} text-gray-400`}>{defaultSubtitle}</p>
        </div>
      </div>
    </div>
  );
};

export default GradientLoader;
