import { describe, expect, it } from 'vitest';
import { classifyWithRules, validateAISuggestion } from '../functions/_shared/classifier';

describe('clasificador del backend', () => {
  it('identifica climatización y declara su origen por reglas', () => {
    const result = classifyWithRules('El aire acondicionado del laboratorio de cómputo no enciende y hace calor.');
    expect(result).toMatchObject({ category: 'Climatización', priority: 'Media', source: 'rules' });
    expect(result.notice).toContain('no utiliza inteligencia artificial');
  });
  it('eleva una fuga de gas a crítica independientemente de la categoría', () => {
    expect(classifyWithRules('Hay una fuga de gas junto a la tubería.').priority).toBe('Crítica');
    expect(classifyWithRules('Salen chispas del enchufe del aula.').priority).toBe('Alta');
  });
  it('acepta acentos y no inventa una categoría para texto ambiguo', () => {
    expect(classifyWithRules('La conexión de internet falla en el aula.').category).toBe('Internet y redes');
    expect(classifyWithRules('Se requiere revisar un problema del campus.').category).toBe('Otros');
  });
  it('rechaza categorías, prioridades y recomendaciones inválidas de IA', () => {
    const valid = { category: 'Limpieza', priority: 'Baja', responsible_area: 'Servicios generales', recommendation: 'Solicitar limpieza del aula.' };
    expect(validateAISuggestion(valid)).toEqual(valid);
    expect(validateAISuggestion({ ...valid, priority: 'Urgent' })).toBeNull();
    expect(validateAISuggestion({ ...valid, category: 'Inventada' })).toBeNull();
    expect(validateAISuggestion({ ...valid, recommendation: '' })).toBeNull();
    expect(validateAISuggestion(null)).toBeNull();
  });
});
