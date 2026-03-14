import { AnimatePresence, motion } from 'framer-motion';

export type AppStatusTone = 'loading' | 'error';
export interface AppStatusAction {
  id: string;
  label: string;
  appearance?: 'solid' | 'ghost';
}

interface AppStatusOverlayProps {
  open: boolean;
  tone: AppStatusTone;
  title: string;
  message?: string;
  actions?: AppStatusAction[];
  onAction?: (actionId: string) => void;
}

export const AppStatusOverlay = ({
  open,
  tone,
  title,
  message,
  actions,
  onAction
}: AppStatusOverlayProps): JSX.Element => {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="app-status-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="app-status-card"
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
          >
            {tone === 'loading' ? <div className="app-status-spinner" aria-hidden="true" /> : null}
            <h2>{title}</h2>
            {message ? <p>{message}</p> : null}
            {tone === 'error' && actions?.length && onAction ? (
              <div className="app-status-actions">
                {actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className={action.appearance === 'ghost' ? 'ghost-button' : 'solid-button'}
                    onClick={() => onAction(action.id)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
