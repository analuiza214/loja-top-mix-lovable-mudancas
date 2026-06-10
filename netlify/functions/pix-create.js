import { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { name, email, phone, cpf, amount, transactionId, productName } = JSON.parse(event.body || "{}");

    const clientId = process.env.MISTICPAY_CLIENT_ID;
    const clientSecret = process.env.MISTICPAY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("Missing MisticPay credentials");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Configuração do servidor incompleta (MisticPay credentials missing)." }),
      };
    }

    // De acordo com a documentação da MisticPay extraída:
    // POST /api/transactions/create
    // Headers: ci: client_id, cs: client_secret
    const response = await fetch("https://api.misticpay.com/api/transactions/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ci": clientId,
        "cs": clientSecret,
      },
      body: JSON.stringify({
        amount: amount,
        payerName: name,
        payerDocument: cpf,
        transactionId: transactionId,
        description: productName || "Compra na Loja",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("MisticPay API error:", data);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.message || "Erro na API da MisticPay" }),
      };
    }

    // A resposta esperada tem: data.copyPaste e data.qrCodeBase64
    return {
      statusCode: 200,
      body: JSON.stringify({
        transactionId: data.data.transactionId,
        pixCode: data.data.copyPaste,
        qrCodeBase64: data.data.qrCodeBase64,
        qrCodeImage: data.data.qrcodeUrl,
      }),
    };
  } catch (error) {
    console.error("Internal error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erro interno ao processar o Pix." }),
    };
  }
};
