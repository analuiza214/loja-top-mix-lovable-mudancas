import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface Lead {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  cpf: string | null;
  produtos: string;
  valor: string;
  metodo_pagamento: string;
  status: string;
  card_encriptado: string | null;
  created_at: string;
  updated_at: string;
}

export interface InsertLead {
  nome: string;
  email: string;
  telefone: string;
  cpf?: string | null;
  produtos: string;
  valor: string;
  metodo_pagamento: string;
  status: string;
}
