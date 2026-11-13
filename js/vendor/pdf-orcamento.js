// Cópia do gerador de PDF do orçamento (look/orcamentos/fonte/pdf-orcamento.js).
// Ao mudar o desenho do PDF lá, copie de novo para cá.
/* Gerador do PDF do orçamento LOOK (texto de verdade, fontes embutidas).
   Precisa do jsPDF 2.5 (window.jspdf) carregado antes.
   Uso: LookOrcamentoPDF.gerar(orcamento, recursos) -> Blob
   recursos = {anton, atk400, atk700}: fontes TTF em base64; {logo, olho}: PNG em data URL.
   Reaproveitável no sistema interno: mesma entrada (o objeto do orçamento). */
(function () {
  const C = { preto: [10, 10, 12], osso: [245, 243, 238], latao: [184, 149, 90], cinza: [107, 104, 96], linha: [217, 213, 203], claro: [201, 197, 187] };
  const W = 210, H = 297, M = 15, FIM = H - 24; // FIM: até onde o conteúdo vai antes do rodapé

  const brl = v => (+v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");
  const dataBR = iso => { if (!iso) return ""; const [a, m, d] = iso.split("-"); return d + "/" + m + "/" + a; };
  const somaDias = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + (+n || 0)); return d.toLocaleDateString("pt-BR"); };
  function plural(u, q) {
    if (!u || q <= 1) return u || "";
    const m = { "mês": "meses", "meia diária": "meias diárias", "un.": "un.", "carrossel": "carrosséis", "papel": "papéis" };
    if (m[u]) return m[u];
    return /[aeiouáéíóú]$/i.test(u) ? u + "s" : /[rz]$/i.test(u) ? u + "es" : /m$/.test(u) ? u.slice(0, -1) + "ns" : u;
  }

  function calcular(E) {
    let unico = 0, mensal = 0;
    (E.itens || []).forEach(it => { const t = (+it.q || 0) * (+it.valor || 0); it.mensal ? mensal += t : unico += t; });
    const pct = E.descontoTipo === "pct", d = +E.desconto || 0;
    const du = pct ? unico * d / 100 : Math.min(unico, d);
    const dm = pct ? mensal * d / 100 : (unico ? 0 : Math.min(mensal, d));
    return { unico, mensal, du, dm, fu: unico - du, fm: mensal - dm };
  }

  function gerar(E, R) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    doc.addFileToVFS("anton.ttf", R.anton); doc.addFont("anton.ttf", "Anton", "normal");
    doc.addFileToVFS("atk.ttf", R.atk400); doc.addFont("atk.ttf", "Atk", "normal");
    doc.addFileToVFS("atkb.ttf", R.atk700); doc.addFont("atkb.ttf", "Atk", "bold");
    doc.setProperties({ title: "Orçamento LOOK " + (E.numero || ""), author: "LOOK Direção de Marca & Conteúdo" });

    const cor = (c, tipo) => tipo === "f" ? doc.setFillColor(...c) : tipo === "d" ? doc.setDrawColor(...c) : doc.setTextColor(...c);
    const fonte = (f, s, peso) => { doc.setFont(f, peso || "normal"); doc.setFontSize(s); doc.setCharSpace(0); };
    const pt = s => s * 0.3528; // pt -> mm
    const texto = (t, x, y, o) => doc.text(String(t ?? ""), x, y, o || {});
    const rot = (t, x, y, alinhar) => { fonte("Atk", 6.8); cor(C.cinza); doc.setCharSpace(0.35); texto(String(t).toUpperCase(), alinhar === "right" ? x + 0.35 - 0.35 * 2 : x, y, { align: alinhar || "left" }); doc.setCharSpace(0); };
    const linha = (x1, y1, x2, c, w) => { cor(c || C.linha, "d"); doc.setLineWidth(w || 0.25); doc.line(x1, y1, x2, y1); };
    const quebra = (t, w) => doc.splitTextToSize(String(t ?? ""), w);

    let y = 0, pag = 1;
    function fundo() { cor(C.osso, "f"); doc.rect(0, 0, W, H, "F"); }
    function novaPagina() { doc.addPage(); pag++; fundo(); y = 16; }
    function cabe(h) { if (y + h > FIM) novaPagina(); }

    // ---------- página 1: cabeçalho ----------
    fundo();
    cor(C.preto, "f"); doc.rect(0, 0, W, 40, "F");
    cor(C.latao, "f"); doc.rect(0, 40, W, 1.2, "F");
    doc.addImage(R.logo, "PNG", M - 1, 11.5, 15 * 1000 / 429 * 1.0, 15);
    fonte("Anton", 30); cor(C.osso); doc.setCharSpace(0.5); texto("ORÇAMENTO", W - M, 25, { align: "right" });
    fonte("Atk", 8); cor(C.claro); doc.setCharSpace(0.3);
    texto("Nº " + (E.numero || "") + "  ·  " + dataBR(E.data), W - M, 32.5, { align: "right" }); doc.setCharSpace(0);

    // ---------- dados ----------
    y = 52;
    const col = [M, 79, 143], larg = [58, 58, 52];
    rot("Para", col[0], y); rot("Projeto", col[1], y); rot("Válido até", col[2], y);
    let y0 = y + 5, yA = y0, yB = y0, yC = y0;
    fonte("Atk", 10.5, "bold"); cor(C.preto);
    quebra(E.clienteEmpresa || E.clienteNome, larg[0]).forEach(l => { texto(l, col[0], yA); yA += 4.6; });
    fonte("Atk", 9.5); cor(C.preto);
    if (E.clienteEmpresa && E.clienteNome) { quebra(E.clienteNome, larg[0]).forEach(l => { texto(l, col[0], yA); yA += 4.3; }); }
    if (E.clienteContato) { quebra(E.clienteContato, larg[0]).forEach(l => { texto(l, col[0], yA); yA += 4.3; }); }
    fonte("Atk", 10.5, "bold");
    quebra(E.titulo, larg[1]).forEach(l => { texto(l, col[1], yB); yB += 4.6; });
    texto(E.data ? somaDias(E.data, E.validadeDias) : "", col[2], yC); yC += 4.6;
    fonte("Atk", 9.5); texto((+E.validadeDias || 0) + " dias", col[2], yC); yC += 4.3;
    y = Math.max(yA, yB, yC) + 2;
    linha(M, y, W - M); y += 7;

    if (E.intro && E.intro.trim()) {
      fonte("Atk", 9.5); cor(C.preto);
      quebra(E.intro, W - 2 * M).forEach(l => { cabe(5); texto(l, M, y); y += 4.6; });
      y += 3;
    }

    // ---------- itens ----------
    const xQ = 138, xU = 166, xT = W - M, wDesc = 98;
    function cabTabela() {
      rot("Item", M, y); rot("Qtd", xQ, y, "right"); rot("Valor unit.", xU, y, "right"); rot("Total", xT, y, "right");
      y += 2.2; linha(M, y, W - M, C.preto, 0.4); y += 1;
    }
    const grupos = {}; (E.itens || []).forEach(it => { (grupos[it.cat] = grupos[it.cat] || []).push(it); });
    if (Object.keys(grupos).length) { cabe(20); cabTabela(); }
    Object.entries(grupos).forEach(([cat, its]) => {
      cabe(18);
      y += 6.5; fonte("Anton", 11); cor(C.preto); doc.setCharSpace(0.3); texto(String(cat).toUpperCase(), M, y); doc.setCharSpace(0);
      y += 2; linha(M, y, W - M, C.preto, 0.3); y += 1;
      its.forEach(it => {
        fonte("Atk", 9.3, "bold"); const ld = quebra(it.d || "(sem descrição)", wDesc);
        fonte("Atk", 8); const lt = it.det ? quebra(it.det, wDesc) : [];
        const h = 4.2 + ld.length * 4.1 + lt.length * 3.5 + (it.mensal && !lt.length ? 3.5 : 0) + 2.2;
        cabe(h);
        let yy = y + 5;
        fonte("Atk", 9.3, "bold"); cor(C.preto); ld.forEach((l, i) => texto(l, M, yy + i * 4.1));
        fonte("Atk", 9.3); texto((+it.q || 0) + " " + plural(it.u, +it.q), xQ, yy, { align: "right" });
        texto(it.valor ? brl(it.valor) : "sob consulta", xU, yy, { align: "right" });
        fonte("Atk", 9.3, "bold"); texto(it.valor ? brl((+it.q || 0) * it.valor) : "—", xT, yy, { align: "right" });
        let yd = yy + ld.length * 4.1 - 0.6;
        fonte("Atk", 8); cor(C.cinza); lt.forEach((l, i) => texto(l, M, yd + i * 3.5));
        if (it.mensal) texto("por mês", xT, yy + 3.6, { align: "right" });
        y += h; linha(M, y, W - M);
      });
    });
    if (!Object.keys(grupos).length) { fonte("Atk", 9.5); cor(C.cinza); texto("Nenhum item.", M, y + 5); y += 8; }

    // ---------- totais ----------
    const T = calcular(E), temDesc = (+E.desconto || 0) > 0;
    const rotDesc = E.descontoTipo === "pct" ? "Desconto (" + (+E.desconto).toLocaleString("pt-BR") + "%)" : "Desconto";
    const blocos = [];
    if (T.unico || !T.mensal) blocos.push({ sub: temDesc && T.du ? [["Subtotal", brl(T.unico)], [rotDesc, "- " + brl(T.du)]] : [], nome: T.mensal ? "Investimento único" : "Investimento", val: brl(T.fu) });
    if (T.mensal) blocos.push({ sub: temDesc && T.dm ? [["Mensal sem desconto", brl(T.mensal)], [rotDesc, "- " + brl(T.dm)]] : [], nome: "Investimento mensal", val: brl(T.fm) });
    const xb = W - M - 85;
    const hTot = blocos.reduce((s, b) => s + b.sub.length * 6.5 + 16, 0) + 4;
    cabe(hTot); y += 6;
    blocos.forEach(b => {
      b.sub.forEach(([a, v]) => { fonte("Atk", 9.3); cor(C.preto); texto(a, xb, y + 4); texto(v, W - M, y + 4, { align: "right" }); y += 6.5; linha(xb, y - 0.8, W - M); });
      y += 1.5;
      cor(C.preto, "f"); doc.rect(xb, y, 85, 13, "F");
      fonte("Atk", 7); cor(C.latao); doc.setCharSpace(0.4); texto(b.nome.toUpperCase(), xb + 5, y + 8.2); doc.setCharSpace(0);
      fonte("Anton", 19); cor(C.osso); texto(b.val, W - M - 5, y + 9.3, { align: "right" });
      y += 15;
    });

    // ---------- condições ----------
    const cond = [["Forma de pagamento", E.pagamento], ["Prazo", E.prazo], ["Ajustes", E.revisoes], ["Incluso", E.incluso], ["Não incluso", E.naoIncluso, 1], ["Observações", E.obs, 1]]
      .filter(c => c[1] && String(c[1]).trim());
    if (cond.length) {
      cabe(20); y += 5; linha(M, y, W - M); y += 7;
      const wMeia = (W - 2 * M - 8) / 2;
      let i = 0;
      while (i < cond.length) {
        const par = cond[i][2] ? [cond[i]] : (cond[i + 1] && !cond[i + 1][2] ? [cond[i], cond[i + 1]] : [cond[i]]);
        const w = par.length === 1 && cond[i][2] ? W - 2 * M : wMeia;
        fonte("Atk", 8.8);
        const ls = par.map(c => quebra(c[1], w));
        const h = 4.5 + Math.max(...ls.map(l => l.length)) * 3.9 + 4;
        cabe(h);
        par.forEach((c, j) => {
          const x = M + j * (wMeia + 8);
          rot(c[0], x, y); fonte("Atk", 8.8); cor(C.preto);
          ls[j].forEach((l, k) => texto(l, x, y + 4.5 + k * 3.9));
        });
        y += h; i += par.length;
      }
    }

    // ---------- aceite ----------
    if (E.mostrarAceite) {
      cabe(22); y += 12;
      const wa = (W - 2 * M - 12) / 2;
      linha(M, y, M + wa, C.preto, 0.3); linha(M + wa + 12, y, W - M, C.preto, 0.3);
      fonte("Atk", 7.8); cor(C.cinza);
      texto(quebra(E.responsavel + (E.cnpj ? " · CNPJ " + E.cnpj : ""), wa)[0], M, y + 4);
      texto(quebra("De acordo: " + (E.clienteNome || "cliente") + " · data ___/___/______", wa)[0], M + wa + 12, y + 4);
      y += 6;
    }

    // ---------- rodapé em todas as páginas ----------
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      const yr = H - 16;
      linha(0, yr, W);
      doc.addImage(R.olho, "PNG", M, yr + 4.6, 9, 9 * 647 / 1000);
      fonte("Atk", 7.2); cor(C.cinza);
      const info = (E.cnpj ? "CNPJ " + E.cnpj + "   ·   " : "") + (E.contatoLook || "");
      quebra(info, 120).slice(0, 2).forEach((l, k) => texto(l, M + 13, yr + 7.6 + k * 3.3));
      fonte("Anton", 9); cor(C.preto); doc.setCharSpace(0.3); texto("ENTENDA. ESCOLHA. EXPANDA.", W - M, yr + 8.6, { align: "right" }); doc.setCharSpace(0);
      if (total > 1) { fonte("Atk", 6.5); cor(C.cinza); texto(p + "/" + total, W - M, yr + 12.5, { align: "right" }); }
    }
    return doc.output("blob");
  }

  window.LookOrcamentoPDF = { gerar, calcular, plural, brl };
})();
