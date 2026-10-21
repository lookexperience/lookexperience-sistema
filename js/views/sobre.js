import { HISTORICO, VERSAO } from '../versao.js';
import { esc, dataCurta } from '../util.js';

export async function render(el, ctx) {
  el.innerHTML = `
    <div class="cabecalho"><div><div class="sobre">Sobre o sistema</div><h1>Versão ${VERSAO}</h1></div></div>
    <div class="painel" style="margin-bottom:18px"><p class="mudo" style="margin:0">Sistema interno da LOOK Direção de Marca &amp; Conteúdo.
      Funcionando em modo <b>${ctx.db().modo === 'demo' ? 'demonstração (dados só neste navegador)' : 'online'}</b>.
      Toda atualização é feita no código, testada numa cópia e registrada aqui.</p></div>
    ${HISTORICO.map((v) => `<div class="painel" style="margin-bottom:14px">
      <h2>${esc(v.versao)} · ${esc(v.titulo)}</h2><div class="fraco">${dataCurta(v.data)} de ${v.data.slice(0, 4)}</div>
      <ul>${v.itens.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}`;
}
