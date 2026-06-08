const https = require("https");

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    https.get(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: {
          Accept: "application/json",
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, body: raw });
          }
        });
      }
    ).on("error", reject);
  });
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const transactionId =
    event.queryStringParameters && event.queryStringParameters.transactionId;
  if (!transactionId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "transactionId obrigatório" }),
    };
  }

  const apiToken = process.env.IRONPAY_API_TOKEN;
  if (!apiToken) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Gateway não configurado" }),
    };
  }

  try {
    // Iron Pay: GET /transactions/{hash}?api_token=TOKEN
    const apiUrl = `https://api.ironpayapp.com.br/api/public/v1/transactions/${encodeURIComponent(transactionId)}?api_token=${encodeURIComponent(apiToken)}`;
    const result = await httpsGet(apiUrl);

    const data = result.body;

    // Iron Pay usa o campo "payment_status" (confirmado pela resposta real)
    // Valores: "waiting_payment" = aguardando | "paid" = pago | "canceled" / "refunded"
    const rawStatus = (data.payment_status || data.status || "").toLowerCase();

    const isPaid = rawStatus === "paid";
    const isExpired = rawStatus === "canceled" || rawStatus === "refunded";

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        transactionId,
        status: rawStatus,
        isPaid,
        isExpired,
        payedAt: data.paid_at || null,
      }),
    };
  } catch (err) {
    console.error("Erro ao consultar IronPay:", err.message);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: "Erro ao consultar status do pagamento." }),
    };
  }
};
