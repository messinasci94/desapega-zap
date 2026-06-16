const https = require("https");
const http  = require("http");
const fs    = require("fs");
const path  = require("path");

// Base do painel (sem o /widget-misto.html no final).
// Ordem de prioridade:
//   1. WIDGET_BASE_URL  (secret novo, só o domínio)
//   2. WIDGET_URL        (secret antigo — remove /widget-misto.html e qualquer arquivo .html no fim)
//   3. padrão hardcoded
function resolverBaseUrl() {
  const raw =
    process.env.WIDGET_BASE_URL ||
    process.env.WIDGET_URL ||
    "https://painel.desapegazap.com.br";
  // Remove qualquer /algumacoisa.html no final e barras sobrando
  return raw.replace(/\/[^/]*\.html?$/i, "").replace(/\/+$/, "");
}

const BASE_URL = resolverBaseUrl();
const OUTPUT   = path.join(__dirname, "leiloes-ativos.json");

// Os dois perfis que o próprio widget consulta
const PERFIS = ["airsoft", "boardgames"];

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib.get(url, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode} em ${url}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`JSON inválido de ${url}: ${err.message}`));
        }
      });
    }).on("error", reject);
  });
}

function formatarMoeda(valor) {
  const num = parseFloat(valor) || 0;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function extrairTitulo(item) {
  const desc = item.description || "";
  const match = desc.match(/TITULO:?\s*(.*)/i);
  if (match) return match[1].replace(/\*/g, "").trim().substring(0, 60);
  return `Item ${item.code || ""}`.trim();
}

async function main() {
  const leiloes = [];

  for (const perfil of PERFIS) {
    const url = `${BASE_URL}/api/auctions/active?profile=${perfil}`;
    console.log(`🔍 Buscando perfil "${perfil}": ${url}`);

    try {
      const dados = await fetchJSON(url);

      if (!Array.isArray(dados)) {
        console.warn(`⚠️  Resposta de "${perfil}" não é um array. Ignorando.`);
        continue;
      }

      console.log(`   → ${dados.length} leilão(ões) encontrados`);

      for (const item of dados) {
        leiloes.push({
          titulo: extrairTitulo(item),
          lanceAtual: formatarMoeda(item.currentBid),
          lanceInicial: formatarMoeda(item.initialBid),
          encerramento: item.endTime
            ? new Date(item.endTime).toLocaleString("pt-BR")
            : null,
          vendedor: item.sellerName || "N/A",
          reputacao: item.sellerStars || null,
          tenant: item.tenantId === "boardgames" ? "Desapega.ZAP" : "Super Leilão Airsoft",
          mediaUrl: item.mediaUrl || null,
          mediaType: item.mediaType || null,
        });
      }
    } catch (err) {
      console.error(`❌ Erro ao buscar perfil "${perfil}": ${err.message}`);
      // Continua tentando o outro perfil mesmo se um falhar
    }
  }

  // Ordena igual o widget faz: quem encerra primeiro aparece primeiro
  leiloes.sort((a, b) => {
    if (!a.encerramento) return 1;
    if (!b.encerramento) return -1;
    return new Date(a.encerramento) - new Date(b.encerramento);
  });

  const output = {
    atualizado_em: new Date().toISOString(),
    total: leiloes.length,
    leiloes,
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
  console.log(`\n✅ ${leiloes.length} leilão(ões) salvos!`);
  leiloes.forEach(l => console.log(`  · [${l.tenant}] ${l.titulo} → ${l.lanceAtual}`));
}

main().catch(err => {
  console.error("❌ Erro fatal:", err.message);
  // Mesmo em erro fatal, grava um JSON válido (lista vazia) pra não quebrar o front-end
  fs.writeFileSync(OUTPUT, JSON.stringify({ atualizado_em: new Date().toISOString(), total: 0, leiloes: [] }, null, 2));
  process.exit(1);
});
