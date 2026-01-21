
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface SaveResult<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export function useEntitySaver() {
  const [loading, setLoading] = useState(false);

  const save = async <T extends Record<string, any>>(
    table: string,
    payload: T
  ): Promise<SaveResult<T>> => {
    setLoading(true);
    
    try {
      // Remove propriedades que são virtuais (normalizadas no frontend) ou tratadas via JSONB/Relacionamentos
      const { created_at, updated_at, vehicles, operating_days, blocked_dates, ...cleanPayload } = payload as any;

      let result;

      // Verificação mais robusta de ID para diferenciar INSERT de UPDATE
      const hasRealId = cleanPayload.id && 
                        typeof cleanPayload.id === 'string' && 
                        cleanPayload.id.length >= 32 && // UUIDs tem 36 chars
                        !cleanPayload.id.includes('new') && 
                        !cleanPayload.id.includes('temp');

      if (hasRealId) {
        result = await supabase
          .from(table)
          .update(cleanPayload)
          .eq('id', cleanPayload.id)
          .select()
          .single();
      } else {
        const { id, ...insertPayload } = cleanPayload;
        result = await supabase
          .from(table)
          .insert(insertPayload)
          .select()
          .single();
      }

      if (result.error) throw result.error;
      return { data: result.data, error: null, success: true };
    } catch (err: any) {
      const errorMessage = err?.message || err?.details || JSON.stringify(err);
      console.error(`[EntitySaver] Erro ao salvar na tabela ${table}:`, errorMessage);
      return { data: null, error: errorMessage, success: false };
    } finally {
      setLoading(false);
    }
  };

  return { save, loading };
}
