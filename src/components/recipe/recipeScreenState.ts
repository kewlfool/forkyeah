export type RecipePeekPanel = 'ingredients' | 'notes' | 'nutrients' | 'timer';

interface IngredientEditorState {
  index: number;
  value: string;
}

export interface RecipeScreenState {
  nowTick: number;
  peekPanel: RecipePeekPanel | null;
  cookModeOpen: boolean;
  cookStepIndex: number;
  timerMinutes: number;
  timerEndsAt: number | null;
  timerNow: number;
  timerDurationMs: number | null;
  ingredientDone: boolean[];
  stepDone: boolean[];
  ingredientRailIndex: number | null;
  ingredientEditor: IngredientEditorState | null;
}

type RecipeScreenAction =
  | { type: 'tick-clock'; now: number }
  | { type: 'tick-timer'; now: number }
  | { type: 'set-peek-panel'; panel: RecipePeekPanel | null }
  | { type: 'open-cook-mode' }
  | { type: 'close-cook-mode' }
  | { type: 'go-to-next-cook-step'; count: number }
  | { type: 'go-to-previous-cook-step' }
  | { type: 'reset-progress' }
  | { type: 'set-timer-minutes'; minutes: number }
  | { type: 'start-timer'; now: number }
  | { type: 'stop-timer' }
  | { type: 'sync-ingredients'; count: number }
  | { type: 'sync-steps'; count: number }
  | { type: 'toggle-ingredient-done'; index: number }
  | { type: 'toggle-step-done'; index: number }
  | { type: 'open-ingredient-rail'; index: number }
  | { type: 'close-ingredient-rail' }
  | { type: 'open-ingredient-editor'; index: number; value: string }
  | { type: 'set-ingredient-editor-value'; value: string }
  | { type: 'close-ingredient-editor' }
  | { type: 'remove-ingredient-state'; index: number };

const DEFAULT_TIMER_MINUTES = 10;

const syncBooleanList = (previous: boolean[], count: number): boolean[] =>
  Array.from({ length: count }, (_, index) => previous[index] ?? false);

export const createRecipeScreenState = (
  ingredientCount: number,
  stepCount: number
): RecipeScreenState => {
  const now = Date.now();
  return {
    nowTick: now,
    peekPanel: null,
    cookModeOpen: false,
    cookStepIndex: 0,
    timerMinutes: DEFAULT_TIMER_MINUTES,
    timerEndsAt: null,
    timerNow: now,
    timerDurationMs: null,
    ingredientDone: Array.from({ length: ingredientCount }, () => false),
    stepDone: Array.from({ length: stepCount }, () => false),
    ingredientRailIndex: null,
    ingredientEditor: null
  };
};

export const recipeScreenReducer = (
  state: RecipeScreenState,
  action: RecipeScreenAction
): RecipeScreenState => {
  switch (action.type) {
    case 'tick-clock':
      return {
        ...state,
        nowTick: action.now
      };

    case 'tick-timer': {
      if (state.timerEndsAt && action.now >= state.timerEndsAt) {
        return {
          ...state,
          timerNow: action.now,
          timerEndsAt: null,
          timerDurationMs: null
        };
      }

      return {
        ...state,
        timerNow: action.now
      };
    }

    case 'set-peek-panel':
      return {
        ...state,
        peekPanel: action.panel
      };

    case 'open-cook-mode':
      return {
        ...state,
        cookModeOpen: true,
        peekPanel: null,
        ingredientRailIndex: null,
        ingredientEditor: null
      };

    case 'close-cook-mode':
      return {
        ...state,
        cookModeOpen: false,
        peekPanel: null
      };

    case 'go-to-next-cook-step':
      return {
        ...state,
        cookStepIndex: Math.min(Math.max(0, action.count - 1), state.cookStepIndex + 1)
      };

    case 'go-to-previous-cook-step':
      return {
        ...state,
        cookStepIndex: Math.max(0, state.cookStepIndex - 1)
      };

    case 'reset-progress':
      return {
        ...state,
        ingredientDone: state.ingredientDone.map(() => false),
        stepDone: state.stepDone.map(() => false),
        ingredientRailIndex: null
      };

    case 'set-timer-minutes':
      return {
        ...state,
        timerMinutes: action.minutes
      };

    case 'start-timer': {
      const minutes = Number.isFinite(state.timerMinutes)
        ? Math.max(1, Math.floor(state.timerMinutes))
        : 1;
      const durationMs = minutes * 60 * 1000;

      return {
        ...state,
        timerMinutes: minutes,
        timerNow: action.now,
        timerDurationMs: durationMs,
        timerEndsAt: action.now + durationMs
      };
    }

    case 'stop-timer':
      return {
        ...state,
        timerEndsAt: null,
        timerDurationMs: null
      };

    case 'sync-ingredients':
      return {
        ...state,
        ingredientDone: syncBooleanList(state.ingredientDone, action.count),
        ingredientRailIndex:
          state.ingredientRailIndex !== null && state.ingredientRailIndex >= action.count
            ? null
            : state.ingredientRailIndex,
        ingredientEditor:
          state.ingredientEditor && state.ingredientEditor.index >= action.count
            ? null
            : state.ingredientEditor
      };

    case 'sync-steps':
      return {
        ...state,
        stepDone: syncBooleanList(state.stepDone, action.count),
        cookStepIndex:
          action.count === 0 ? 0 : Math.min(state.cookStepIndex, Math.max(0, action.count - 1)),
        cookModeOpen: action.count === 0 ? false : state.cookModeOpen
      };

    case 'toggle-ingredient-done':
      return {
        ...state,
        ingredientDone: state.ingredientDone.map((value, index) =>
          index === action.index ? !value : value
        ),
        ingredientRailIndex: null
      };

    case 'toggle-step-done':
      return {
        ...state,
        stepDone: state.stepDone.map((value, index) => (index === action.index ? !value : value))
      };

    case 'open-ingredient-rail':
      return {
        ...state,
        ingredientRailIndex: action.index
      };

    case 'close-ingredient-rail':
      return {
        ...state,
        ingredientRailIndex: null
      };

    case 'open-ingredient-editor':
      return {
        ...state,
        ingredientRailIndex: null,
        ingredientEditor: {
          index: action.index,
          value: action.value
        }
      };

    case 'set-ingredient-editor-value':
      return state.ingredientEditor
        ? {
            ...state,
            ingredientEditor: {
              ...state.ingredientEditor,
              value: action.value
            }
          }
        : state;

    case 'close-ingredient-editor':
      return {
        ...state,
        ingredientEditor: null
      };

    case 'remove-ingredient-state':
      return {
        ...state,
        ingredientDone: state.ingredientDone.filter((_, index) => index !== action.index),
        ingredientRailIndex: null,
        ingredientEditor:
          state.ingredientEditor && state.ingredientEditor.index === action.index
            ? null
            : state.ingredientEditor
      };

    default:
      return state;
  }
};
