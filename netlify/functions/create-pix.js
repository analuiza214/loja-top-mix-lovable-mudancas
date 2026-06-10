const https = require("https");

function httpsRequest(method, url, data, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = data ? JSON.stringify(data) : null;
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const clientId = process.env.MISTICPAY_CLIENT_ID;
  const clientSecret = process.env.MISTICPAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Gateway não configurado no servidor (Check Netlify env vars)." }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "JSON inválido." }) };
  }

  const { amount, name, cpf, transactionId, productName } = body;

  const payload = {
    amount: Number(amount),
    payerName: String(name),
    payerDocument: String(cpf || "").replace(/\D/g, ""),
    transactionId: String(transactionId || `order_${Date.now()}`),
    description: productName || "Compra na Loja",
  };

  try {
    const apiUrl = "https://api.misticpay.com/api/transactions/create";
    
    const result = await httpsRequest("POST", apiUrl, payload, {
      "ci": clientId,
      "cs": clientSecret
    });

    if (result.status < 200 || result.status >= 300) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          error: "Erro na MisticPay: " + (result.body.message || "Erro desconhecido"),
          details: result.body
        }),
      };
    }

    const data = result.body.data || result.body;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        transactionId: data.transactionId || data.id,
        pixCode: data.copyPaste || data.pixCode,
        qrCodeBase64: data.qrCodeBase64,
        qrCodeImage: data.qrcodeUrl || data.qrCodeUrl,
      }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: "Erro de comunicação com o gateway." }),
    };
  }
};
