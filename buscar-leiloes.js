const https = require("https");
const http  = require("http");
const fs    = require("fs");
const path  = require("path");

const WIDGET_URL = process.env.WIDGET_URL || "http://124.198.128.183:3008/widget-desapega.html";
const OUTPUT     = path.join(__dirname, "leiloes-ativos.json");

// ─── Busca o HTML do widget ───────────────────────────────────────────────────

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

// ─── Parseia os leilões do HTML ───────────────────────────────────────────────

function parsearLeiloes(html) {
  const leiloes = [];

  // Remove tags HTML para trabalhar com texto limpo por bloco
  // Divide por blocos de leilão (cada leilão tem Lance Inicial)
  const blocos = html.split(/Lance Inicial:/i).slice(1);

  for (const bloco of blocos) {
    try {
      // Extrai título — texto antes do "Lance Inicial" no bloco anterior
      const idxBloco = html.indexOf(bloco) - "Lance Inicial:".length;
      const htmlAntes = html.substring(Math.max(0, idxBloco - 800), idxBloco);

      // Remove tags HTML
      const textoAntes = htmlAntes.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

      // Pega as últimas palavras como título (antes do "Lance Inicial")
      const tituloMatch = textoAntes.match(/([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][^.!?\n]{5,120})\s*$/);
      const titulo = tituloMatch
        ? tituloMatch[1].replace(/[🎯🔫🛍️🎮💻📱🎲]/g, "").trim()
        : null;

      // Extrai texto do bloco
      const textoBloco = bloco.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

      // Lance atual
      const lanceMatch = textoBloco.match(/Lance Atual:\s*R\$\s*([\d.,]+)/i);
      const lanceAtual = lanceMatch ? `R$ ${lanceMatch[1]}` : null;

      // Encerramento
      const encerramentoMatch = textoBloco.match(/Encerramento:\s*([\d/]+,?\s*[\d:]+)/i);
      const encerramento = encerramentoMatch
        ? encerramentoMatch[1].replace(",", " às").trim()
        : null;

      // Vendedor
      const vendedorMatch = textoBloco.match(/Vendedor:\s*([^-–\n]+)/i);
      const vendedor = vendedorMatch ? vendedorMatch[1].trim() : null;

      if (lanceAtual) {
        leiloes.push({ titulo, lanceAtual, encerramento, vendedor });
      }
    } catch (e) {
      // ignora bloco com erro
    }
  }

  return leiloes;
}

// ─── Principal ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🔍 Buscando leilões em ${WIDGET_URL}...`);

  try {
    const html    = await fetchHTML(WIDGET_URL);
    const leiloes = parsearLeiloes(html);

    const output = {
      atualizado_em: new Date().toISOString(),
      total: leiloes.length,
      leiloes,
    };

    fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));

    console.log(`✅ ${leiloes.length} leilão(ões) encontrado(s):`);
    leiloes.forEach(l => console.log(`   · ${l.titulo || "?"} → ${l.lanceAtual}`));

  } catch (err) {
    console.error("❌ Erro ao buscar widget:", err.message);

    // Salva JSON vazio para não quebrar o site
    const output = {
      atualizado_em: new Date().toISOString(),
      total: 0,
      leiloes: [],
    };
    fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
  }
}

main();
