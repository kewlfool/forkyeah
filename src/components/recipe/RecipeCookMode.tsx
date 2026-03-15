import { AnimatePresence, motion } from 'framer-motion';
import { ChefHat, Timer, Utensils } from 'lucide-react';
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from 'react';
import { createPortal } from 'react-dom';
import { useDocumentOverlayPresence } from '../../hooks/useDocumentOverlayPresence';
import { useHorizontalSwipe } from '../../hooks/useHorizontalSwipe';

interface RecipeCookModeProps {
  open: boolean;
  steps: string[];
  stepIndex: number;
  timerEndsAt: number | null;
  timerProgress: number;
  onPreviousStep: () => void;
  onNextStep: () => void;
  onOpenIngredients: () => void;
  onOpenTimer: () => void;
  onClose: () => void;
}

const STEP_FONT_MAX_PX = 35;
const STEP_FONT_MIN_PX = 22;
const STEP_FONT_STEP_PX = 2;

const AutoFitStepText = ({ text }: { text: string }): JSX.Element => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const [fontSizePx, setFontSizePx] = useState(STEP_FONT_MAX_PX);

  useLayoutEffect(() => {
    const fitText = () => {
      const container = containerRef.current;
      const content = textRef.current;
      if (!container || !content) {
        return;
      }

      let nextSize = STEP_FONT_MAX_PX;
      content.style.fontSize = `${nextSize}px`;

      while (
        nextSize > STEP_FONT_MIN_PX &&
        (content.scrollHeight > container.clientHeight || content.scrollWidth > container.clientWidth)
      ) {
        nextSize -= STEP_FONT_STEP_PX;
        content.style.fontSize = `${nextSize}px`;
      }

      setFontSizePx(nextSize);
    };

    const frameId = window.requestAnimationFrame(fitText);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => fitText()) : null;

    if (resizeObserver && containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
    };
  }, [text]);

  return (
    <div ref={containerRef} className="cook-mode-step-fitbox">
      <p ref={textRef} className="cook-mode-step-text" style={{ fontSize: `${fontSizePx}px` }}>
        {text}
      </p>
    </div>
  );
};

export const RecipeCookMode = ({
  open,
  steps,
  stepIndex,
  timerEndsAt,
  timerProgress,
  onPreviousStep,
  onNextStep,
  onOpenIngredients,
  onOpenTimer,
  onClose
}: RecipeCookModeProps): JSX.Element => {
  const COOK_MODE_DOCUMENT_BG = 'color-mix(in srgb, var(--bg) 94%, var(--surface-soft) 6%)';
  useDocumentOverlayPresence(open, COOK_MODE_DOCUMENT_BG);

  const hasSteps = steps.length > 0;
  const currentStep = hasSteps ? steps[stepIndex] ?? steps[0] ?? '' : '';
  const stepProgress = hasSteps ? (stepIndex + 1) / steps.length : 0;
  const swipe = useHorizontalSwipe({
    onSwipeLeft: () => {
      if (stepIndex < steps.length - 1) {
        onNextStep();
      }
    },
    onSwipeRight: () => {
      if (stepIndex > 0) {
        onPreviousStep();
      }
    },
    threshold: 42,
    disabled: !open || !hasSteps
  });

  const stepLabel = useMemo(() => {
    if (!hasSteps) {
      return 'No steps';
    }

    return `Step ${stepIndex + 1} of ${steps.length}`;
  }, [hasSteps, stepIndex, steps.length]);

  const overlay = (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="cook-mode-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="cook-mode-chrome">
            <div className="cook-mode-progress">
              <span className="cook-mode-step-count">{stepLabel}</span>
              {hasSteps ? (
                <span className="cook-mode-progress-bar" aria-hidden="true">
                  <span
                    className="cook-mode-progress-bar-fill"
                    style={{ transform: `scaleX(${stepProgress})` }}
                  />
                </span>
              ) : null}
            </div>

            <div
              className="cook-mode-step-shell"
              onTouchStart={swipe.onTouchStart}
              onTouchMove={swipe.onTouchMove}
              onTouchEnd={swipe.onTouchEnd}
              onTouchCancel={swipe.onTouchCancel}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${stepIndex}-${currentStep}`}
                  className="cook-mode-step-stage"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  {hasSteps ? (
                    <AutoFitStepText text={currentStep} />
                  ) : (
                    <p className="cook-mode-empty muted">This recipe does not have cooking steps yet.</p>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="cook-mode-actions">
              <button
                type="button"
                className="deck-mode-toggle cook-mode-action-button"
                onClick={onOpenIngredients}
                aria-label="Open ingredients"
              >
                <Utensils size={18} />
              </button>

              <button
                type="button"
                className="deck-mode-toggle cook-mode-action-button cook-mode-action-button-primary"
                onClick={onClose}
                aria-label="Exit cook mode"
              >
                <ChefHat size={18} />
              </button>

              <button
                type="button"
                className="deck-mode-toggle cook-mode-action-button"
                onClick={onOpenTimer}
                aria-label="Open timer"
              >
                {timerEndsAt ? (
                  <span className="timer-dial" style={{ '--progress': timerProgress } as CSSProperties}>
                    <span className="timer-dial-inner" />
                  </span>
                ) : (
                  <Timer size={18} />
                )}
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(overlay, document.body) : overlay;
};
