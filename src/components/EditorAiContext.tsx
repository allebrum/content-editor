import { createContext, useContext } from 'react';
import type { AiConfig } from '../schema/types';

export const EditorAiContext = createContext<AiConfig | undefined>(undefined);

export const useEditorAi = () => useContext(EditorAiContext);
