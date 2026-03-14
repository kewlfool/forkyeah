import { motion } from 'framer-motion';
import { PlusButton } from '../common/PlusButton';

interface RecipeEmptyStateProps {
  onImport: () => void;
}

export const RecipeEmptyState = ({ onImport }: RecipeEmptyStateProps): JSX.Element => {
  return (
    <motion.section
      className="empty-state screen-layer"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
    >
      <PlusButton label="Import recipe" onClick={onImport} />
      <p className="muted">Import from PDF, a link, or create manually.</p>
    </motion.section>
  );
};
