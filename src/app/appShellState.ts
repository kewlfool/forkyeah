import type { Recipe } from '../types/models';
import type { RecipeStagingDraft } from '../components/recipe/RecipeStagingScreen';

export type RootScene = 'empty' | 'deck';

export type RootRoute = {
  type: 'root';
  root: RootScene;
};

export type SearchRoute = {
  type: 'search';
  root: RootScene;
  query: string;
};

export type RecipeRoute = {
  type: 'recipe';
  root: RootScene;
  recipeId: string;
  fallbackRecipe: Recipe;
};

export type StagingReturnTarget =
  | { type: 'root' }
  | {
      type: 'search';
      query: string;
    };

export type StagingRoute = {
  type: 'staging';
  root: RootScene;
  draft: RecipeStagingDraft;
  mode: 'create' | 'edit';
  editingRecipeId: string | null;
  returnTo: StagingReturnTarget;
};

export type AppRoute = RootRoute | SearchRoute | RecipeRoute | StagingRoute;

export type AppStatusOverlayAction = {
  id: 'close' | 'retry-import' | 'create-manual';
  label: string;
  appearance?: 'solid' | 'ghost';
};

export type AppOverlay =
  | { type: 'none' }
  | { type: 'import-sheet' }
  | {
      type: 'image-picker';
      recipeId: string;
    }
  | {
      type: 'status';
      kind: 'app-loading' | 'recipe-parsing' | 'error';
      title: string;
      message?: string;
      actions?: AppStatusOverlayAction[];
    };

export interface AppShellState {
  route: AppRoute;
  overlay: AppOverlay;
}

export type AppShellAction =
  | { type: 'sync-root'; hasRecipes: boolean }
  | { type: 'clear-startup-overlay' }
  | { type: 'open-import' }
  | { type: 'request-image'; recipeId: string }
  | { type: 'close-overlay' }
  | { type: 'show-parsing-overlay' }
  | { type: 'hide-parsing-overlay' }
  | {
      type: 'show-error-overlay';
      title: string;
      message?: string;
      actions?: AppStatusOverlayAction[];
    }
  | { type: 'open-search' }
  | { type: 'set-search-query'; query: string }
  | { type: 'open-recipe'; recipe: Recipe }
  | {
      type: 'open-staging';
      draft: RecipeStagingDraft;
      mode: 'create' | 'edit';
      editingRecipeId: string | null;
      returnTo: StagingReturnTarget;
    }
  | { type: 'close-route' }
  | { type: 'reset-to-root'; hasRecipes: boolean };

export const rootSceneForRecipes = (hasRecipes: boolean): RootScene => (hasRecipes ? 'deck' : 'empty');

export const initialRoute = (): RootRoute => ({
  type: 'root',
  root: 'deck'
});

export const buildInitialAppShellState = (): AppShellState => ({
  route: initialRoute(),
  overlay: { type: 'status', kind: 'app-loading', title: 'Loading...' }
});

export const syncRouteRoot = (route: AppRoute, root: RootScene): AppRoute => {
  switch (route.type) {
    case 'root':
      return { type: 'root', root };

    case 'search':
      return { ...route, root };

    case 'recipe':
      return { ...route, root };

    case 'staging':
      return { ...route, root };

    default:
      return route;
  }
};

export const routeAfterClose = (route: AppRoute): AppRoute => {
  switch (route.type) {
    case 'search':
    case 'recipe':
      return { type: 'root', root: route.root };

    case 'staging':
      return route.returnTo.type === 'search'
        ? { type: 'search', root: route.root, query: route.returnTo.query }
        : { type: 'root', root: route.root };

    case 'root':
    default:
      return route;
  }
};

export const appShellReducer = (state: AppShellState, action: AppShellAction): AppShellState => {
  switch (action.type) {
    case 'sync-root': {
      const nextRoot = rootSceneForRecipes(action.hasRecipes);
      if (state.route.root === nextRoot) {
        return state;
      }
      return {
        ...state,
        route: syncRouteRoot(state.route, nextRoot)
      };
    }

    case 'clear-startup-overlay':
      return state.overlay.type === 'status' && state.overlay.kind === 'app-loading'
        ? {
            ...state,
            overlay: { type: 'none' }
          }
        : state;

    case 'open-import':
      return {
        ...state,
        overlay: { type: 'import-sheet' }
      };

    case 'request-image':
      return {
        ...state,
        overlay: { type: 'image-picker', recipeId: action.recipeId }
      };

    case 'close-overlay':
      return state.overlay.type === 'none'
        ? state
        : {
            ...state,
            overlay: { type: 'none' }
          };

    case 'show-parsing-overlay':
      return {
        ...state,
        overlay: {
          type: 'status',
          kind: 'recipe-parsing',
          title: 'Parsing recipe...'
        }
      };

    case 'hide-parsing-overlay':
      if (state.overlay.type !== 'status' || state.overlay.kind !== 'recipe-parsing') {
        return state;
      }
      return {
        ...state,
        overlay: { type: 'none' }
      };

    case 'show-error-overlay':
      return {
        ...state,
        overlay: {
          type: 'status',
          kind: 'error',
          title: action.title,
          message: action.message,
          actions: action.actions
        }
      };

    case 'open-search':
      return {
        route: {
          type: 'search',
          root: state.route.root,
          query: ''
        },
        overlay: { type: 'none' }
      };

    case 'set-search-query':
      if (state.route.type !== 'search') {
        return state;
      }

      return {
        ...state,
        route: {
          ...state.route,
          query: action.query
        }
      };

    case 'open-recipe':
      return {
        route: {
          type: 'recipe',
          root: state.route.root,
          recipeId: action.recipe.id,
          fallbackRecipe: action.recipe
        },
        overlay: { type: 'none' }
      };

    case 'open-staging':
      return {
        route: {
          type: 'staging',
          root: state.route.root,
          draft: action.draft,
          mode: action.mode,
          editingRecipeId: action.editingRecipeId,
          returnTo: action.returnTo
        },
        overlay: { type: 'none' }
      };

    case 'close-route':
      return {
        ...state,
        route: routeAfterClose(state.route)
      };

    case 'reset-to-root':
      return {
        route: {
          type: 'root',
          root: rootSceneForRecipes(action.hasRecipes)
        },
        overlay: { type: 'none' }
      };

    default:
      return state;
  }
};
