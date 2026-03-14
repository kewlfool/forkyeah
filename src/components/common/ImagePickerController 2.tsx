import { useEffect, useRef, type ChangeEvent } from 'react';

interface ImagePickerControllerProps {
  requestRecipeId: string | null;
  onPick: (recipeId: string, file: File) => void | Promise<void>;
  onCancel: () => void;
}

export const ImagePickerController = ({
  requestRecipeId,
  onPick,
  onCancel
}: ImagePickerControllerProps): JSX.Element => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!requestRecipeId) {
      return;
    }

    requestAnimationFrame(() => {
      inputRef.current?.click();
    });

    const handleFocus = () => {
      window.setTimeout(() => {
        onCancel();
      }, 0);
    };

    window.addEventListener('focus', handleFocus, { once: true });
    return () => window.removeEventListener('focus', handleFocus);
  }, [onCancel, requestRecipeId]);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    const targetRecipeId = requestRecipeId;

    try {
      if (!file || !targetRecipeId) {
        return;
      }

      await onPick(targetRecipeId, file);
    } finally {
      event.target.value = '';
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="recipe-card-image-input"
      onChange={handleChange}
    />
  );
};
