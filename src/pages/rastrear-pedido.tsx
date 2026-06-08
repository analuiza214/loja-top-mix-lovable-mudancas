import { useState } from "react";
import { Link } from "wouter";
import { Search, Package, Truck, CheckCircle, Clock, ShieldCheck, ChevronRight, ArrowLeft } from "lucide-react";

export default function RastrearPedido() {
  const [codigo, setCodigo] = useState("");
  const [buscou, setBuscou] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleRastrear(e: React.FormEvent) {
    e.preventDefault();
    if (!codigo.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setBuscou(true);
    }, 1200);
  }

  const etapas = [
    { icone: CheckCircle, label: "Pedido Confirmado", data: "23/05/2026 — 14:32", ok: true },
    { icone: Package, label: "Em Preparação", data: "24/05/2026 — 09:15", ok: true },
    { icone: Truck, label: "Enviado / Em Trânsito", data: "25/05/2026 — 08:00", ok: true },
    { icone: Clock, label: "Saiu para Entrega", data: "Previsão: hoje", ok: false },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header da página */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-4">
            <ArrowLeft className="h-4 w-4" /> Voltar à Loja
          </Link>
          <h1 className="text-2xl font-black text-gray-900">Rastrear Pedido</h1>
          <p className="text-sm text-gray-500 mt-1">Digite o código do seu pedido para ver o status da entrega.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">

        {/* Formulário */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <form onSubmit={handleRastrear} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={codigo}
                onChange={e => setCodigo(e.target.value)}
                placeholder="Ex: TM-2026-00847 ou código dos Correios"
                className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl font-black text-sm text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #15803d, #22c55e)" }}
            >
              {loading ? "Buscando..." : "RASTREAR"}
            </button>
          </form>
        </div>

        {/* Resultado */}
        {buscou && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Pedido</p>
                <p className="font-black text-lg text-gray-900">{codigo}</p>
              </div>
              <span className="text-xs font-black px-3 py-1.5 rounded-full bg-green-100 text-green-700">
                ✓ Em Trânsito
              </span>
            </div>

            <div className="space-y-0">
              {etapas.map((etapa, i) => {
                const Icon = etapa.icone;
                return (
                  <div key={i} className="flex gap-4 relative">
                    <div className="flex flex-col items-center">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 ${etapa.ok ? "bg-green-500" : "bg-gray-200"}`}>
                        <Icon className={`h-4 w-4 ${etapa.ok ? "text-white" : "text-gray-400"}`} />
                      </div>
                      {i < etapas.length - 1 && (
                        <div className={`w-0.5 flex-1 my-1 ${etapa.ok ? "bg-green-300" : "bg-gray-200"}`} style={{ minHeight: 28 }} />
                      )}
                    </div>
                    <div className="pb-5">
                      <p className={`text-sm font-bold ${etapa.ok ? "text-gray-900" : "text-gray-400"}`}>{etapa.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{etapa.data}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
              <strong>Previsão de entrega:</strong> até 28/05/2026. Você receberá um SMS quando o pedido sair para entrega.
            </div>
          </div>
        )}

        {/* Dicas */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-black text-gray-900 mb-4">Onde encontro meu código?</h2>
          <ul className="space-y-3 text-sm text-gray-600">
            {[
              "No e-mail de confirmação enviado após a compra",
              'No aplicativo ou site do Mercado Livre, em "Minhas Compras"',
              "No SMS enviado quando o pedido foi postado",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <ChevronRight className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="text-center text-sm text-gray-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-green-500" />
          Não encontrou? <Link href="/fale-conosco" className="text-yellow-600 font-bold hover:underline">Entre em contato</Link>
        </div>
      </div>
    </div>
  );
}
