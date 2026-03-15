
# How To Use Forkyeah

This guide covers the current live recipe app screens and the gestures they support.

Tap and click are interchangeable for most buttons and cards. Swipes and pinches are touch-first interactions.

## Quick Gesture Reference

- `Tap`: Open, confirm, close, or select.
- `Long press`: Enter edit mode on recipe cards, close the recipe detail screen, or switch a staging preview into edit mode.
- `Swipe left`: Used for delete or reveal-actions flows on specific screens.
- `Swipe right`: Used for marking ingredients or steps as done on specific screens.
- `Pinch inward`: Closes the Search screen and the main Recipe screen.

Current live recipe screens do not use a pull-to-create gesture.

## 1. Empty State

When there are no recipes yet:

- Tap `Import recipe` to open the import sheet.

## 2. Import Sheet

The import sheet is the main entry point for new recipes.

- Paste a recipe URL into the field if you want to import from a link.
- Tap `Search` to open the dedicated search screen.
- Tap `Create` with a URL in the field to import that link.
- Tap `Create` with an empty field to start a blank manual recipe.
- Tap outside the sheet to close it.

## 3. Search Screen

The search screen is for finding recipes before importing them.

- Type at least 2 characters in the search field.
- Tap `Search` to run the search.
- Watch the status line under the search bar for `Searching...`, errors, no results, or result counts.
- Tap any result card to import that result's URL.
- Pinch inward anywhere on the screen to close search and go back.

## 4. Deck View

Deck view has 3 modes: `List`, `Grid`, and `Stack`.

- Tap the bottom-left mode button to cycle between `List -> Grid -> Stack -> List`.
- Tap the bottom `+` button to open the import sheet.

### List and Grid Modes

These two modes share the same core editing gestures.

- Tap a recipe card to open that recipe.
- Long press a recipe card to enter card edit mode.
- While in card edit mode:
    - swipe left on that card to delete it.
    - tap the card twice to open the full edit screen.
    - tap outside the active card to leave edit mode.
- Switching deck modes also exits card edit mode.

Image updates in card edit mode:

- In `List` and `Grid`, long press a card to enter edit mode.
- Then tap the recipe image area to open the system photo picker for a new thumbnail.

Metadata shown in each mode:

- `List`: Prep, Cook, and Last cooked.
- `Grid`: Prep and Cook only.

### Stack Mode

Stack mode is browse-first. It does not open a recipe by tapping the header.

- Swipe left or right on the top card header area to move through recipes.
- You can also start that swipe from the left or right edge gutters of the active card.
- Scroll vertically inside the card body to read ingredients and steps.
- Tap `Let's cook` at the bottom to open the active recipe.

## 5. Recipe Screen

This is the full recipe detail screen.

- Pinch inward anywhere to close the recipe and return to the deck.
- Long press the recipe title to close the recipe.
- Long press the bottom floating action bar to close the recipe.
- Tap the export icon in the top-right corner to export the recipe as a PDF.
- Tap the `Last cooked` value in the timing row to stamp it to now.
  This also resets the recipe progress state.
- If the description is longer than 4 lines, tap `Show more` or `Show less`.

### Ingredients

- Swipe left on an ingredient to reveal the action rail.
- Tap the pencil action to edit that ingredient.
- Tap the trash action to delete that ingredient.
- Swipe right on an ingredient to toggle its done state.
- After opening the action rail, tap the ingredient row to collapse the rail.

### Steps

- Swipe right on a step to toggle its done state.

### Bottom Action Bar

The floating action bar opens supporting panels.

- `Utensils`: Open Ingredients peek sheet.
- `Notes`: Open Notes peek sheet.
- `Leaf`: Open Nutrients peek sheet.
- `Chef hat`: Enter Cook mode.
- `Timer`: Open Timer peek sheet.

## 6. Peek Sheets

Peek sheets appear over the recipe screen.

- Tap outside the sheet to close it.

### Ingredients Peek Sheet

- Outside cook mode, this is a read-only ingredient list.
- During cook mode, swipe right on an ingredient to toggle its done state from the peek sheet too.

### Notes Peek Sheet

- Read-only notes panel.

### Nutrients Peek Sheet

- Read-only nutrients panel.

### Timer Peek Sheet

- Enter a minute value manually.
- Or tap a preset: `5m`, `10m`, `15m`, `20m`.
- Tap `Start timer` to begin.
- Tap `Stop` to stop an active timer.

## 7. Ingredient Editor Sheet

This sheet opens after swiping an ingredient left and tapping the pencil action.

- Edit the ingredient text.
- Tap `Save` to confirm.
- Press `Enter` to save.
- Tap `Cancel` or tap outside the sheet to close without saving.

## 8. Cook Mode

Cook mode is a full-screen, step-by-step reading mode.

- Swipe left on the step text to move to the next step.
- Swipe right on the step text to move to the previous step.
- Tap the left `Utensils` button to open ingredients.
- Tap the right `Timer` button to open the timer.
- Tap the center `Chef hat` button to leave cook mode.

## 9. Recipe Staging Screen

The staging screen is used for imported recipes and full recipe editing.

Imported recipe flow:

- Imported recipes usually open in preview mode first.
- Long press the preview card to enter edit mode.
- Tap `Done` to leave edit mode and return to preview.
- Tap `Accept` to save the recipe.
- Tap `Delete` to discard the staged draft.

Manual create flow:

- Blank manual recipes open directly in edit mode.
- Fill in the fields and tap `Accept` to save.

Saved recipe edit flow:

- Editing an existing saved recipe opens directly in edit mode.
- Tap `Save` to commit changes.
- Tap `Cancel` to leave without saving.

Inside edit mode:

- Edit title, description, prep time, cook time, ingredients, steps, notes, tags, categories, cuisines, and last cooked.
- Use `Add ingredient` and `Add step` to grow those lists.
- Use the trash buttons beside lines to remove individual ingredients or steps.

## 10. Status Overlays

The app uses full-screen status overlays for background work and import failures.

Loading states:

- App startup shows a splash/loading overlay.
- Recipe imports show a parsing/loading overlay while the URL is being processed.

Error states:

- Import failures can show `Retry`, `Create manually`, and `Close`, depending on the failure.
- Tap the action button you want. There are no gestures on these overlays.

## 11. System Photo Picker

The image picker is opened from recipe card edit mode in `List` or `Grid`.

- Long press a card to enter edit mode.
- Tap the image area.
- The system photo picker opens.
- Choose an image to update the recipe thumbnail.
- If you leave the picker without choosing an image, the picker request is simply canceled.
