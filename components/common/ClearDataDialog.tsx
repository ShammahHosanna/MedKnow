'use client';

import { useEffect, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useI18n } from '@/lib/i18n';
import { clearAllData } from '@/lib/storage/session-store';
import { Button } from '@/components/ui/button';

export default function ClearDataDialog({
  open,
  onClose,
  onCleared,
}: {
  open: boolean;
  onClose: () => void;
  onCleared?: () => void;
}) {
  const { t } = useI18n();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  const confirm = () => {
    clearAllData();
    onCleared?.();
    onClose();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          role="alertdialog"
          className="fixed left-1/2 top-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900"
        >
          <DialogPrimitive.Title className="text-lg font-bold">{t('clear.title')}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {t('clear.body')}
          </DialogPrimitive.Description>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t('clear.cancel')}
            </Button>
            <Button ref={confirmRef} variant="destructive" onClick={confirm}>
              {t('clear.confirm')}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
