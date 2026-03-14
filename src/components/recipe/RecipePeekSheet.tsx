import { type CSSProperties } from 'react';
import type { RecipePeekPanel } from './recipeScreenState';

interface RecipePeekSheetProps {
  panel: RecipePeekPanel | null;
  ingredientItems: string[];
  ingredientDone: boolean[];
  notes: string;
  nutrientItems: string[];
  timerMinutes: number;
  timerEndsAt: number | null;
  remainingMinutes: number;
  remainingDisplaySeconds: number;
  timerProgress: number;
  onClose: () => void;
  onTimerMinutesChange: (value: number) => void;
  onStartTimer: () => void;
  onStopTimer: () => void;
}

export const RecipePeekSheet = ({
  panel,
  ingredientItems,
  ingredientDone,
  notes,
  nutrientItems,
  timerMinutes,
  timerEndsAt,
  remainingMinutes,
  remainingDisplaySeconds,
  timerProgress,
  onClose,
  onTimerMinutesChange,
  onStartTimer,
  onStopTimer
}: RecipePeekSheetProps): JSX.Element | null => {
  if (!panel) {
    return null;
  }

  return (
    <div className="recipe-peek-overlay" onClick={onClose}>
      <div
        className="recipe-peek-card"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {panel === 'ingredients' ? (
          <>
            <h3>Ingredients</h3>
            {ingredientItems.length ? (
              <ul className="recipe-peek-list">
                {ingredientItems.map((item, index) => (
                  <li key={`${item}-${index}`} className={ingredientDone[index] ? 'is-done' : undefined}>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No ingredients yet.</p>
            )}
          </>
        ) : null}

        {panel === 'notes' ? (
          <>
            <h3>Notes</h3>
            {notes.trim() ? <p>{notes}</p> : <p className="muted">No notes yet.</p>}
          </>
        ) : null}

        {panel === 'nutrients' ? (
          <>
            <h3>Nutrients</h3>
            {nutrientItems.length ? (
              <ul className="recipe-peek-list">
                {nutrientItems.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">No nutrients yet.</p>
            )}
          </>
        ) : null}

        {panel === 'timer' ? (
          <>
            <h3>Timer</h3>
            {timerEndsAt ? (
              <div className="timer-readout">
                <strong>
                  {remainingMinutes}:{remainingDisplaySeconds.toString().padStart(2, '0')}
                </strong>
                <span className="timer-dial timer-dial-large" style={{ '--progress': timerProgress } as CSSProperties}>
                  <span className="timer-dial-inner" />
                </span>
                <button type="button" className="ghost-button" onClick={onStopTimer}>
                  Stop
                </button>
              </div>
            ) : (
              <div className="timer-controls">
                <label className="form-field">
                  <span className="field-label">Minutes</span>
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={timerMinutes}
                    onChange={(event) => onTimerMinutesChange(Number(event.target.value))}
                    className="list-input"
                  />
                </label>
                <div className="timer-presets">
                  {[5, 10, 15, 20].map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      className="ghost-button"
                      onClick={() => onTimerMinutesChange(minutes)}
                    >
                      {minutes}m
                    </button>
                  ))}
                </div>
                <button type="button" className="solid-button" onClick={onStartTimer}>
                  Start timer
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};
