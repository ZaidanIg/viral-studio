// src/shared/components/Modal.tsx
import React from 'react';
import { RenderZeoLogoSvg } from '../constants/constants';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: React.ReactNode;

  onConfirm?: () => void; // Optional: if present, it's a confirmation modal
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmButtonColor?: string; // e.g., 'bg-red-600 hover:bg-red-700'
  showUpdateLabel?: boolean; // toggle "Update Info" label in header
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  onConfirm, // Optional
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
  confirmButtonColor = 'bg-blue-600 hover:bg-blue-700',
  showUpdateLabel = false,
}) => {
  if (!isOpen) return null;

  const isConfirmation = typeof onConfirm === 'function';

  // Determine the primary action for the main button
  const primaryAction = isConfirmation ? onConfirm : onClose;
  const primaryButtonText = isConfirmation ? confirmButtonText : 'OK';
  const primaryButtonColor = isConfirmation
    ? confirmButtonColor
    : 'btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700';

  return (
    <div
      className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900/95 border border-zinc-700/60 rounded-2xl p-6 sm:p-7 shadow-2xl max-w-2xl w-full relative"
        role="document"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#181818',
          backgroundImage:
            'linear-gradient(135deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent), linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.08) 75%, transparent 75%, transparent), linear-gradient(0deg, rgba(0,0,0,0.24), rgba(0,0,0,0.24))',
          backgroundSize: '12px 12px, 12px 12px, 100% 100%',
          backgroundBlendMode: 'overlay, overlay, normal',
        }}
      >
        <div className="flex items-start gap-3 pb-4 border-b border-zinc-800/70">
          <RenderZeoLogoSvg className="h-8 w-8 text-white" />
          <div className="flex-1 min-w-0">
            {showUpdateLabel && (
              <p className="text-base uppercase tracking-[0.14em] text-white font-semibold mb-1">Update Info</p>
            )}
            <h3 id="modal-title" className="text-xl font-semibold text-gray-50 leading-tight">
              {title}
            </h3>
          </div>
        </div>

        <div className="pt-4 text-gray-200 text-sm leading-relaxed space-y-3" id="modal-description">
          {message}
        </div>

        <div className="flex justify-end gap-3 pt-6">
          {isConfirmation && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-zinc-700 text-gray-200 hover:bg-zinc-800 transition-colors duration-200"
              aria-label={cancelButtonText}
            >
              {cancelButtonText}
            </button>
          )}
          <button
            onClick={primaryAction}
            className={`px-4 py-2 text-white font-semibold rounded-lg transition-colors duration-200 shadow-lg ${primaryButtonColor}`}
            aria-label={primaryButtonText}
          >
            {primaryButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Modal;
