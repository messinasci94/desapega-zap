const https = require("https");
const http  = require("http");
const fs    = require("fs");
const path  = require("path");

const WIDGET_URL = process.env.WIDGET_URL || "https://painel.desapegazap.com.br/widget-misto.html";
const OUTPUT     = path.join(__dirname, "leiloes-ativos.json");

function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib.get(url, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

async function main() {
  console.log(`🔍 Buscando: ${WIDGET_URL}`);

  try {
    const html = await fetchHTML(WIDGET_URL);

    // Limpa o HTML
    const texto = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

    // DEBUG — mostra o texto limpo
    console.log("\n📄 Texto limpo (primeiros 800 chars):");
    console.log(texto.substring(0, 800));

    const leiloes = [];

    // Divide por "Lance Inicial:"
    const partes = texto.split(/Lance\s+Inicial\s*:/i);
    console.log(`\n🔪 Splits encontrados: ${partes.length - 1}`);

    for (let i = 1; i < partes.length; i++) {
      const blocoAtual = partes[i];
      const blocoAntes = partes[i - 1];

      console.log(`\n--- Bloco ${i} ---`);
      console.log("ANTES:", blocoAntes.slice(-200));
      console.log("ATUAL:", blocoAtual.substring(0, 300));

      // Lance atual — aceita com ou sem traço antes
      const lanceMatch = blocoAtual.match(/(?:-\s*)?Lance\s+Atual\s*:\s*R\$\s*([\d.,]+)/i);

      // Encerramento
      const encMatch = blocoAtual.match(/Encerramento\s*:\s*(\d{2}\/\d{2}\/\d{4})[,\s]+(\d{2}:\d{2})/i);

      // Vendedor
      const vendMatch = blocoAtual.match(/Vendedor\s*:\s*([^-\n]{2,25})/i);

      // Título — última frase significativa antes do "Lance Inicial:"
      // Tenta pegar após emojis ou depois do nome do grupo
      const tituloMatch = blocoAntes.match(/(?:🥊|🔫|🛍️|🎯|➡️|⬆️|🔧|📦|🎮|💻|📱|🎲|🏹|⚔️|🪖)?\s*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9 +\-()]{2,60})\s*$/i);
      const titulo = tituloMatch ? tituloMatch[1].trim() : null;

      const lanceAtual = lanceMatch ? `R$ ${lanceMatch[1]}` : null;

      console.log("TÍTULO:", titulo);
      console.log("LANCE ATUAL:", lanceAtual);

      if (lanceAtual) {
        leiloes.push({
          titulo: titulo ? titulo.substring(0, 60) : "Item",
          lanceAtual,
          lanceInicial: `R$ ${partes[i].match(/^\s*R?\$?\s*([\d.,]+)/)?.[1] || "?"}`,
          encerramento: encMatch ? `${encMatch[1].substring(0,5)} às ${encMatch[2]}` : null,
          vendedor: vendMatch ? vendMatch[1].trim() : null,
        });
      }
    }

    const output = {
      atualizado_em: new Date().toISOString(),
      total: leiloes.length,
      leiloes,
    };

    fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
    console.log(`\n✅ ${leiloes.length} leilão(ões) salvos!`);
    leiloes.forEach(l => console.log(`  · ${l.titulo} → ${l.lanceAtual}`));

  } catch (err) {
    console.error("❌ Erro:", err.message);
    fs.writeFileSync(OUTPUT, JSON.stringify({ atualizado_em: new Date().toISOString(), total: 0, leiloes: [] }, null, 2));
  }
}

main();
