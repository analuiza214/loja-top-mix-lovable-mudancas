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
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const apiToken = process.env.IRONPAY_API_TOKEN;
  const offerHash = process.env.IRONPAY_OFFER_HASH;
  const productHash = process.env.IRONPAY_PRODUCT_HASH;

  if (!apiToken || !offerHash || !productHash) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Gateway de pagamento não configurado." }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "JSON inválido." }) };
  }

  const { amount, name, email, phone, address, document, productName } = body;

  if (!amount || !name) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Campos obrigatórios não informados." }),
    };
  }

  const siteUrl = process.env.URL || process.env.DEPLOY_URL || "";
  const postbackUrl = siteUrl ? `${siteUrl}/.netlify/functions/pix-webhook` : undefined;

  // Iron Pay usa centavos — multiplica por 100
  const amountInCents = Math.round(Number(amount) * 100);

  const phoneDigits = (phone || "").replace(/\D/g, "");
  const documentDigits = (document || "").replace(/\D/g, "");

  const payload = {
    amount: amountInCents,
    offer_hash: offerHash,
    payment_method: "pix",
    customer: {
      name: String(name),
      email: String(email || ""),
      phone_number: phoneDigits || "00000000000",
      ...(documentDigits ? { document: documentDigits } : {}),
      ...(address
        ? {
            street_name: address.street || "",
            number: address.number || "S/N",
            complement: address.complement || "",
            neighborhood: address.neighborhood || "Centro",
            city: address.city || "",
            state: address.state || "",
            zip_code: address.zipCode || "",
          }
        : {}),
    },
    cart: [
      {
        product_hash: productHash,
        title:
          productName ||
          "Kit Álbum Copa Do Mundo 2026 Capa Mole + 250 Figurinhas Panini",
        cover: null,
        price: amountInCents,
        quantity: 1,
        operation_type: 1,
        tangible: true,
      },
    ],
    expire_in_days: 1,
    transaction_origin: "api",
    ...(postbackUrl ? { postback_url: postbackUrl } : {}),
  };

  try {
    const apiUrl = `https://api.ironpayapp.com.br/api/public/v1/transactions?api_token=${encodeURIComponent(apiToken)}`;
    const result = await httpsRequest("POST", apiUrl, payload, {});

    console.log("IronPay create status:", result.status);
    console.log("IronPay create body:", JSON.stringify(result.body));

    if (result.status < 200 || result.status >= 300) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Erro ao gerar PIX. Tente novamente.",
          details: result.body,
        }),
      };
    }

    const data = result.body;

    // Campos confirmados pela resposta real da Iron Pay:
    // { hash, payment_status, pix: { pix_qr_code, pix_url } }
    const transactionHash = data.hash || data.transaction_hash;
    const pix = data.pix || {};
    const pixCode = pix.pix_qr_code || pix.qr_code || pix.code || pix.copy_paste || null;
    const qrCodeBase64 = pix.qr_code_base64 || pix.base64 || null;
    // Iron Pay não retorna imagem do QR code — geramos a partir do código PIX
    const qrCodeImage = pixCode
      ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`
      : (pix.pix_url || pix.qr_code_url || null);

    if (!pixCode) {
      console.error(
        "IronPay — campo pix_qr_code não encontrado na resposta:",
        JSON.stringify(data)
      );
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Erro ao gerar PIX: código não encontrado na resposta.",
          details: data,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactionId: transactionHash,
        status: data.payment_status || "pending",
        pixCode,
        qrCodeBase64,
        qrCodeImage,
      }),
    };
  } catch (err) {
    console.error("Erro ao comunicar com IronPay:", err.message);
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Erro de comunicação com o gateway de pagamento.",
      }),
    };
  }
};
