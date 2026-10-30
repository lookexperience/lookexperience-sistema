import { $, ICONES, esc } from '../util.js';

// Abre uma janela por cima da tela. Devolve o elemento e uma função para fechar.
export function abrirModal({ titulo, corpo, rodape = '', largo = false }) {
  const fundo = document.createElement('div');
  fundo.className = 'fundo-modal';
  fundo.innerHTML = `
    <div class="modal ${largo ? 'largo' : ''}" role="dialog" aria-modal="true">
      <div class="modal-topo"><h2>${titulo}</h2><button class="botao sutil" data-fechar title="Fechar">${ICONES.fechar}</button></div>
      <div class="modal-corpo">${corpo}</div>
      ${rodape ? `<div class="modal-rodape">${rodape}</div>` : ''}
    </div>`;
  const fechar = () => { fundo.remove(); document.removeEventListener('keydown', aoTeclar); };
  const aoTeclar = (e) => { if (e.key === 'Escape') fechar(); };
  fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) fechar(); });
  $('[data-fechar]', fundo).onclick = fechar;
  document.addEventListener('keydown', aoTeclar);
  document.body.append(fundo);
  return { el: fundo, fechar };
}

export const opcoes = (lista, atual, vazio) =>
  (vazio !== undefined ? `<option value="">${vazio}</option>` : '')
  + lista.map((i) => `<option value="${esc(i.chave)}" ${i.chave === atual ? 'selected' : ''}>${esc(i.nome)}</option>`).join('');
