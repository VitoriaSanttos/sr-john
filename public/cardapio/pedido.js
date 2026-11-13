// =====================================================================
// Sr. John — PEDIDOS PELO CARDÁPIO
// ---------------------------------------------------------------------
// 1. O cliente toca no "+" de um item (ou num tamanho) → escolhe opção,
//    sabor, quantidade e observação → vai para o pedido.
// 2. "Ver pedido" → confere os itens → "Continuar" → retirada, entrega
//    ou mesa, nome, endereço, pagamento.
// 3. "Enviar pelo WhatsApp" → abre a conversa com a loja com o pedido
//    pronto. Se escolheu Pix agora, mostra o QR Code com o valor.
//
// Mesa: o QR code da mesa abre o cardápio com ?mesa=5 e o pedido já sai
// marcado como "Mesa 5".
// Configuração (WhatsApp, Pix, link de pagamento, taxa): ../js/config.js
// =====================================================================
(() => {
  const L = window.LOJA || {};
  const MOD = L.modalidades || { retirada: true, entrega: true, mesa: true };
  const $ = (s, r = document) => r.querySelector(s);
  const CHAVE_PEDIDO = 'srjohn-pedido-v1';
  const CHAVE_CLIENTE = 'srjohn-cliente-v1';
  const VALIDADE = 12 * 3600 * 1000; // carrinho esquecido some depois de 12 h

  const ler = (k, padrao) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? padrao : v; } catch (e) { return padrao; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  // ------------------------------------------------------------ índice dos itens
  const ITENS = {};
  CARDAPIO.forEach((s) => s.grupos.forEach((g) => g.itens.forEach((it) => {
    let base = it.np || it.n;
    if (!it.np && g.px && !sem(it.n).startsWith(sem(g.px))) base = `${g.px} · ${it.n}`;
    ITENS[it.id] = { it, g, base, foto: it.f || g.f };
  })));

  // ------------------------------------------------------------ estado
  let pedido = ler(CHAVE_PEDIDO, null);
  if (!pedido || !Array.isArray(pedido.linhas) || Date.now() - pedido.t > VALIDADE) pedido = { t: Date.now(), linhas: [] };
  pedido.linhas = pedido.linhas.filter((l) => ITENS[l.id]); // item que saiu do cardápio
  const cliente = ler(CHAVE_CLIENTE, {});

  // mesa vinda do QR code (?mesa=5) — vale para esta visita
  let mesa = null;
  try {
    const h = location.hash.match(/^#mesa-(\d{1,3})$/);
    const m = new URLSearchParams(location.search).get('mesa') || (h && h[1]);
    if (m && /^\d{1,3}$/.test(m)) sessionStorage.setItem('srjohn-mesa', m);
    mesa = sessionStorage.getItem('srjohn-mesa');
  } catch (e) {}
  if (!MOD.mesa) mesa = null;

  const salvar = () => { pedido.t = Date.now(); gravar(CHAVE_PEDIDO, pedido); atualizarBarra(); atualizarSelos(); };
  const precoUnit = (l) => { const { it } = ITENS[l.id]; return l.op != null ? it.opcoes[l.op][1] : it.p; };
  const rotulo = (l) => {
    const { it, base } = ITENS[l.id];
    let r = base;
    if (l.op != null) r += ` (${it.opcoes[l.op][0]})`;
    if (l.es) r += ` — ${l.es}`;
    return r;
  };
  const qtdTotal = () => pedido.linhas.reduce((a, l) => a + l.q, 0);
  const subtotal = () => pedido.linhas.reduce((a, l) => a + l.q * precoUnit(l), 0);
  const taxa = () => (typeof L.taxaEntrega === 'number' ? L.taxaEntrega : null);

  // ------------------------------------------------------------ peças fixas da tela
  document.body.insertAdjacentHTML('beforeend', `
    <button class="barra-pedido" id="barra-pedido" type="button" hidden>
      <span class="bp-qtd" id="bp-qtd">0</span>
      <span class="bp-txt">Ver pedido</span>
      <b class="bp-total" id="bp-total">R$ 0,00</b>
    </button>
    <div class="aviso" id="aviso" role="status" aria-live="polite"></div>
    <dialog class="folha" id="folha-item" aria-labelledby="fi-titulo"></dialog>
    <dialog class="folha" id="folha-pedido" aria-labelledby="fp-titulo"></dialog>`);
  const barra = $('#barra-pedido');
  const folhaItem = $('#folha-item');
  const folhaPedido = $('#folha-pedido');

  if (mesa) {
    $('header.topo').insertAdjacentHTML('afterend',
      `<div class="wrap"><div class="mesa-aviso"><b>Mesa ${esc(mesa)}</b> · escolha os itens e envie o pedido pelo WhatsApp</div></div>`);
  }

  let avisoT;
  function avisar(txt) {
    const a = $('#aviso');
    a.textContent = txt; a.classList.add('ver');
    clearTimeout(avisoT); avisoT = setTimeout(() => a.classList.remove('ver'), 1800);
  }

  function atualizarBarra() {
    const q = qtdTotal();
    barra.hidden = q === 0;
    document.body.classList.toggle('tem-pedido', q > 0);
    $('#bp-qtd').textContent = q;
    $('#bp-total').textContent = real(subtotal());
  }

  // número no "+" dos itens que já estão no pedido
  function atualizarSelos() {
    const porItem = {};
    pedido.linhas.forEach((l) => { porItem[l.id] = (porItem[l.id] || 0) + l.q; });
    document.querySelectorAll('button.add[data-add]').forEach((b) => {
      const q = porItem[b.dataset.add];
      if (q) b.dataset.qtd = q; else delete b.dataset.qtd;
    });
  }
  window.atualizarSelos = atualizarSelos;

  // fechar folha tocando fora / no X
  [folhaItem, folhaPedido].forEach((d) => d.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('[data-fechar]')) d.close();
  }));

  // ------------------------------------------------------------ escolher item
  main.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    abrirItem(b.dataset.add, b.dataset.op != null ? Number(b.dataset.op) : null);
  });

  function abrirItem(id, opInicial) {
    const { it, base, foto } = ITENS[id];
    const opcoes = it.opcoes || null;
    const st = { op: opcoes ? (opInicial != null ? opInicial : 0) : null, q: 1 };
    folhaItem.innerHTML = `
      <div class="folha-cab">
        ${foto ? `<img class="fi-foto" src="${FOTOS}${esc(foto)}.jpg" alt="" onerror="this.remove()">` : ''}
        <h2 id="fi-titulo">${esc(base)}</h2>
        <button class="x" type="button" data-fechar aria-label="Fechar">×</button>
      </div>
      <form class="folha-miolo" id="fi-form" novalidate>
        ${it.d ? `<p class="fi-desc">${esc(it.d)}</p>` : ''}
        ${opcoes ? `<fieldset class="escolhas"><legend>${/ml$/.test(opcoes[0][0]) ? 'Tamanho' : 'Opção'}</legend>
          ${opcoes.map(([o, v], i) => `<label class="escolha"><input type="radio" name="op" value="${i}" ${i === st.op ? 'checked' : ''}><span>${esc(o)}</span><b>${real(v)}</b></label>`).join('')}
        </fieldset>` : ''}
        ${it.escolha ? `<fieldset class="escolhas" id="fi-es"><legend>${esc(it.escolha.t)} <em>obrigatório</em></legend>
          ${it.escolha.o.map((o) => `<label class="escolha"><input type="radio" name="es" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('')}
          <p class="erro" hidden>Escolha uma opção.</p>
        </fieldset>` : ''}
        ${it.pergunta ? `<label class="campo" id="fi-perg"><span>${esc(it.pergunta)} <em>obrigatório</em></span>
          <input name="resp" type="text" maxlength="80" autocomplete="off"><p class="erro" hidden>Responda para continuar.</p></label>` : ''}
        <label class="campo"><span>Alguma observação?</span>
          <textarea name="obs" rows="2" maxlength="140" placeholder="Ex.: sem açúcar, bem quente…"></textarea></label>
      </form>
      <div class="folha-rodape">
        <div class="stepper" aria-label="Quantidade">
          <button type="button" data-q="-1" aria-label="Diminuir">−</button><output id="fi-q">1</output><button type="button" data-q="1" aria-label="Aumentar">+</button>
        </div>
        <button class="btn-primario" type="button" id="fi-add">Adicionar <b id="fi-total"></b></button>
      </div>`;
    const form = $('#fi-form', folhaItem);
    const pintar = () => {
      const unit = opcoes ? opcoes[st.op][1] : it.p;
      $('#fi-q', folhaItem).textContent = st.q;
      $('#fi-total', folhaItem).textContent = real(unit * st.q);
    };
    form.addEventListener('change', (e) => { if (e.target.name === 'op') { st.op = Number(e.target.value); pintar(); } });
    folhaItem.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
      st.q = Math.min(50, Math.max(1, st.q + Number(b.dataset.q))); pintar();
    }));
    form.addEventListener('submit', (e) => e.preventDefault());
    $('#fi-add', folhaItem).addEventListener('click', () => {
      const es = form.es ? (form.querySelector('input[name="es"]:checked') || {}).value : null;
      const resp = form.resp ? form.resp.value.trim() : null;
      let ok = true;
      if (it.escolha && !es) { $('#fi-es .erro', folhaItem).hidden = false; ok = false; }
      if (it.pergunta && !resp) { $('#fi-perg .erro', folhaItem).hidden = false; ok = false; }
      if (!ok) { (folhaItem.querySelector('.erro:not([hidden])') || {}).scrollIntoView?.({ block: 'center' }); return; }
      const obs = form.obs.value.trim();
      const nova = { id, op: st.op, es: es || null, resp: resp || null, obs: obs || null, q: st.q };
      const igual = pedido.linhas.find((l) => l.id === nova.id && l.op === nova.op && l.es === nova.es && l.resp === nova.resp && l.obs === nova.obs);
      if (igual) igual.q = Math.min(50, igual.q + nova.q); else pedido.linhas.push(nova);
      salvar();
      folhaItem.close();
      avisar(`${st.q}× ${rotulo(nova)} no pedido`);
    });
    pintar();
    folhaItem.showModal();
    // foco no primeiro campo obrigatório que falta, sem abrir teclado à toa
    (folhaItem.querySelector('#fi-es input') || $('#fi-add', folhaItem)).focus({ preventScroll: true });
  }

  // ------------------------------------------------------------ pedido: itens
  barra.addEventListener('click', () => verCarrinho());

  function verCarrinho() {
    if (!pedido.linhas.length) { folhaPedido.close(); return; }
    folhaPedido.innerHTML = `
      <div class="folha-cab"><h2 id="fp-titulo">Seu pedido</h2><button class="x" type="button" data-fechar aria-label="Fechar">×</button></div>
      <div class="folha-miolo">
        ${mesa ? `<div class="mesa-aviso">Mesa ${esc(mesa)}</div>` : ''}
        <ul class="linhas">
          ${pedido.linhas.map((l, i) => `<li class="linha">
            <div class="ln-txt"><b>${esc(rotulo(l))}</b>
              ${[l.resp, l.obs].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join('')}
              <em>${real(precoUnit(l))} cada</em></div>
            <div class="ln-dir">
              <b class="ln-total">${real(precoUnit(l) * l.q)}</b>
              <div class="stepper peq">
                <button type="button" data-linha="${i}" data-d="-1" aria-label="${l.q === 1 ? 'Remover' : 'Diminuir'}">${l.q === 1 ? '🗑' : '−'}</button><output>${l.q}</output><button type="button" data-linha="${i}" data-d="1" aria-label="Aumentar">+</button>
              </div>
            </div></li>`).join('')}
        </ul>
        <button class="btn-link" type="button" data-fechar>+ Adicionar mais itens</button>
      </div>
      <div class="folha-rodape col">
        <div class="tot"><span>Subtotal</span><b>${real(subtotal())}</b></div>
        <button class="btn-primario largo" type="button" id="fp-continuar">Continuar</button>
      </div>`;
    folhaPedido.querySelectorAll('[data-linha]').forEach((b) => b.addEventListener('click', () => {
      const l = pedido.linhas[Number(b.dataset.linha)];
      l.q += Number(b.dataset.d);
      if (l.q <= 0) pedido.linhas.splice(Number(b.dataset.linha), 1);
      l.q = Math.min(50, l.q);
      salvar(); verCarrinho();
    }));
    $('#fp-continuar', folhaPedido).addEventListener('click', finalizar);
    if (!folhaPedido.open) folhaPedido.showModal();
  }

  // ------------------------------------------------------------ pedido: finalizar
  function finalizar() {
    const mods = [['retirada', 'Retirada'], ['entrega', 'Entrega'], ['mesa', 'Na mesa']].filter(([m]) => MOD[m]);
    const modIni = mesa ? 'mesa' : (cliente.mod && MOD[cliente.mod] && cliente.mod !== 'mesa' ? cliente.mod : mods[0][0]);
    const temPixOnline = !!(L.pix && L.pix.chave);
    const temLink = !!L.linkPagamento;
    folhaPedido.innerHTML = `
      <div class="folha-cab">
        <button class="x voltar-x" type="button" id="fp-voltar" aria-label="Voltar aos itens">←</button>
        <h2 id="fp-titulo">Finalizar pedido</h2>
        <button class="x" type="button" data-fechar aria-label="Fechar">×</button>
      </div>
      <form class="folha-miolo" id="fp-form" novalidate>
        <fieldset class="segmento" role="radiogroup" aria-label="Como você quer receber">
          ${mods.map(([m, t]) => `<label><input type="radio" name="mod" value="${m}" ${m === modIni ? 'checked' : ''}><span>${t}</span></label>`).join('')}
        </fieldset>

        <label class="campo"><span>Seu nome <em>obrigatório</em></span>
          <input name="nome" type="text" autocomplete="name" maxlength="60" value="${esc(cliente.nome || '')}"><p class="erro" hidden>Diga seu nome.</p></label>

        <div data-so="entrega">
          <label class="campo"><span>Endereço com número <em>obrigatório</em></span>
            <input name="end" type="text" autocomplete="street-address" maxlength="120" placeholder="Rua, número, bairro" value="${esc(cliente.end || '')}"><p class="erro" hidden>Informe o endereço.</p></label>
          <label class="campo"><span>Complemento / ponto de referência</span>
            <input name="ref" type="text" maxlength="100" value="${esc(cliente.ref || '')}"></label>
          <p class="nota">${taxa() != null ? `Taxa de entrega: <b>${real(taxa())}</b>` : 'A taxa de entrega é combinada pelo WhatsApp.'}</p>
        </div>

        <div data-so="mesa">
          <label class="campo"><span>Número da mesa <em>obrigatório</em></span>
            <input name="mesa" type="text" inputmode="numeric" maxlength="3" value="${esc(mesa || '')}"><p class="erro" hidden>Informe a mesa.</p></label>
        </div>

        <div data-so="retirada">
          <p class="nota">Retire no balcão: Rua Francisco Marcolino Junqueira, 559 · Morro Agudo. A loja avisa pelo WhatsApp quando estiver pronto.</p>
        </div>

        <fieldset class="escolhas" id="fp-pag"><legend>Pagamento <em>obrigatório</em></legend>
          ${temPixOnline || temLink ? `<p class="sub-leg">Pagar agora</p>
            ${temPixOnline ? `<label class="escolha"><input type="radio" name="pag" value="pix-online"><span>Pix agora <small>QR Code com o valor do pedido</small></span></label>` : ''}
            ${temLink ? `<label class="escolha"><input type="radio" name="pag" value="link"><span>Cartão online <small>link de pagamento</small></span></label>` : ''}
            <p class="sub-leg" id="fp-pag-local">Pagar na retirada</p>` : '<p class="sub-leg" id="fp-pag-local">Pagar na retirada</p>'}
          <label class="escolha"><input type="radio" name="pag" value="pix"><span>Pix</span></label>
          <label class="escolha"><input type="radio" name="pag" value="cartao"><span>Cartão de crédito ou débito</span></label>
          <label class="escolha"><input type="radio" name="pag" value="dinheiro"><span>Dinheiro</span></label>
          <label class="campo" data-so-pag="dinheiro"><span>Troco para quanto?</span>
            <input name="troco" type="text" inputmode="decimal" maxlength="10" placeholder="Ex.: 50 (deixe vazio se não precisar)"></label>
          <p class="erro" hidden>Escolha como vai pagar.</p>
        </fieldset>

        <label class="campo"><span>Observações do pedido</span>
          <textarea name="obs" rows="2" maxlength="200" placeholder="Ex.: sem talheres, tocar o interfone…"></textarea></label>
      </form>
      <div class="folha-rodape col">
        <div class="tot"><span>Subtotal</span><b>${real(subtotal())}</b></div>
        <div class="tot" id="fp-linha-entrega"><span>Entrega</span><b>${taxa() != null ? real(taxa()) : 'a combinar'}</b></div>
        <div class="tot grande"><span>Total</span><b id="fp-total"></b></div>
        <a class="btn-primario largo whats" id="fp-enviar" href="#" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2s.2-1.1.2-1.2-.2-.2-.5-.3z"/></svg>
          Enviar pedido pelo WhatsApp</a>
      </div>`;
    const form = $('#fp-form', folhaPedido);
    const mod = () => form.querySelector('input[name="mod"]:checked').value;
    const total = () => subtotal() + (mod() === 'entrega' && taxa() != null ? taxa() : 0);
    const pintar = () => {
      const m = mod();
      folhaPedido.querySelectorAll('[data-so]').forEach((el) => { el.hidden = el.dataset.so !== m; });
      $('#fp-linha-entrega', folhaPedido).hidden = m !== 'entrega';
      $('#fp-pag-local', folhaPedido).textContent = { retirada: 'Pagar na retirada', entrega: 'Pagar na entrega', mesa: 'Pagar no caixa' }[m];
      const pag = (form.querySelector('input[name="pag"]:checked') || {}).value;
      folhaPedido.querySelectorAll('[data-so-pag]').forEach((el) => { el.hidden = el.dataset.soPag !== pag; });
      $('#fp-total', folhaPedido).textContent = real(total()) + (m === 'entrega' && taxa() == null ? ' + entrega' : '');
    };
    form.addEventListener('change', (e) => {
      if (e.target.name === 'pag') $('#fp-pag .erro', folhaPedido).hidden = true;
      pintar();
    });
    form.addEventListener('input', (e) => { const er = e.target.closest('.campo')?.querySelector('.erro'); if (er) er.hidden = true; });
    form.addEventListener('submit', (e) => e.preventDefault());
    $('#fp-voltar', folhaPedido).addEventListener('click', verCarrinho);
    const cod = codigo(); // número do pedido (o mesmo se a pessoa voltar e corrigir algo)
    $('#fp-enviar', folhaPedido).addEventListener('click', (e) => enviar(e, form, mod(), total(), cod));
    pintar();
  }

  // ------------------------------------------------------------ montar e enviar a mensagem
  const codigo = () => {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const r = crypto.getRandomValues(new Uint8Array(4));
    return Array.from(r, (x) => a[x % a.length]).join('');
  };
  const PAG_TXT = {
    'pix-online': 'Pix agora (QR Code do cardápio) — vou enviar o comprovante',
    link: 'Cartão online (link de pagamento)',
    pix: 'Pix', cartao: 'Cartão', dinheiro: 'Dinheiro',
  };

  function enviar(evento, form, mod, total, cod) {
    const v = (n) => (form[n] ? form[n].value.trim() : '');
    const erro = (n) => { const el = form[n].closest('.campo').querySelector('.erro'); el.hidden = false; return false; };
    let ok = true;
    if (!v('nome')) ok = erro('nome');
    if (mod === 'entrega' && !v('end')) ok = erro('end');
    if (mod === 'mesa' && !/^\d{1,3}$/.test(v('mesa'))) ok = erro('mesa');
    const pag = (form.querySelector('input[name="pag"]:checked') || {}).value;
    if (!pag) { $('#fp-pag .erro', folhaPedido).hidden = false; ok = false; }
    if (!ok) { evento.preventDefault(); folhaPedido.querySelector('.erro:not([hidden])').closest('.campo, fieldset').scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }

    // lembra os dados do cliente para a próxima vez
    Object.assign(cliente, { nome: v('nome'), mod, end: v('end') || cliente.end, ref: v('ref') || cliente.ref });
    gravar(CHAVE_CLIENTE, cliente);

    const ondePagar = { retirada: 'na retirada', entrega: 'na entrega', mesa: 'no caixa' }[mod];
    let pagTxt = PAG_TXT[pag];
    if (['pix', 'cartao', 'dinheiro'].includes(pag)) pagTxt += ` ${ondePagar}`;
    if (pag === 'dinheiro' && v('troco')) pagTxt += ` (troco para R$ ${v('troco').replace(/^R\$\s*/i, '')})`;

    const m = [];
    if (L.demo) m.push('🧪 *PEDIDO DE DEMONSTRAÇÃO (teste)*');
    m.push(`*NOVO PEDIDO · Sr. John* #${cod}`);
    m.push('');
    if (mod === 'retirada') m.push('🛍 *Retirada no balcão*');
    if (mod === 'entrega') m.push('🛵 *Entrega*');
    if (mod === 'mesa') m.push(`🪑 *Mesa ${v('mesa')}*`);
    m.push(`Nome: ${v('nome')}`);
    if (mod === 'entrega') {
      m.push(`Endereço: ${v('end')}`);
      if (v('ref')) m.push(`Referência: ${v('ref')}`);
    }
    m.push('');
    m.push('*Itens*');
    pedido.linhas.forEach((l) => {
      m.push(`${l.q}x ${rotulo(l)} — ${real(precoUnit(l) * l.q)}`);
      [l.resp, l.obs].filter(Boolean).forEach((x) => m.push(`   ↳ ${x}`));
    });
    m.push('');
    m.push(`Subtotal: ${real(subtotal())}`);
    if (mod === 'entrega') m.push(`Entrega: ${taxa() != null ? real(taxa()) : 'a combinar'}`);
    m.push(`*Total: ${real(total)}${mod === 'entrega' && taxa() == null ? ' + entrega' : ''}*`);
    m.push('');
    m.push(`💳 Pagamento: ${pagTxt}`);
    if (v('obs')) m.push(`📝 Obs.: ${v('obs')}`);

    const url = `https://wa.me/${L.whatsapp}?text=${encodeURIComponent(m.join('\n'))}`;
    // o próprio botão é um link: o navegador abre o WhatsApp numa nova aba
    // (funciona mesmo onde pop-up é bloqueado). Depois a folha mostra a confirmação.
    evento.currentTarget.href = url;
    setTimeout(() => enviado({ cod, pag, total, url, valorFechado: !(mod === 'entrega' && taxa() == null) }), 0);
  }

  // ------------------------------------------------------------ pedido enviado
  function enviado({ cod, pag, total, url, valorFechado }) {
    let pix = '';
    if (pag === 'pix-online') {
      const payload = pixPayload({ chave: L.pix.chave, nome: L.pix.nome, cidade: L.pix.cidade, valor: valorFechado ? total : 0, txid: 'SRJ' + cod });
      pix = `<div class="pix">
        <h3>Pague com Pix${L.demo ? ' <small>(exemplo)</small>' : ''}</h3>
        <p>${valorFechado ? `Valor: <b>${real(total)}</b>` : 'Confirme o valor com a loja (falta a taxa de entrega) e digite no app do banco.'}</p>
        <div class="pix-qr">${qrSVG(payload, { titulo: 'QR Code Pix' })}</div>
        <button class="btn-secundario largo" type="button" id="fp-copiar">Copiar Pix copia e cola</button>
        <textarea class="pix-codigo" readonly rows="3" aria-label="Pix copia e cola">${esc(payload)}</textarea>
        <p class="nota">${L.demo ? 'Demonstração: chave Pix de exemplo do Banco Central. Na versão final entra a chave da loja.' : 'Depois de pagar, mande o comprovante na conversa do WhatsApp.'}</p>
      </div>`;
    }
    folhaPedido.innerHTML = `
      <div class="folha-cab"><h2 id="fp-titulo">Pedido #${esc(cod)}</h2><button class="x" type="button" data-fechar aria-label="Fechar">×</button></div>
      <div class="folha-miolo">
        <div class="ok">
          <div class="ok-ic" aria-hidden="true">✓</div>
          <p><b>Falta só um toque!</b><br>Abrimos o WhatsApp com o seu pedido pronto. Toque em <b>enviar</b> na conversa para a loja receber.</p>
          <a class="btn-secundario largo" href="${esc(url)}" target="_blank" rel="noopener">Abrir o WhatsApp de novo</a>
        </div>
        ${pix}
        ${pag === 'link' ? `<div class="pix"><h3>Pague com cartão</h3><p>Valor do pedido: <b>${real(total)}</b>${valorFechado ? '' : ' + entrega'}</p>
          <a class="btn-primario largo" href="${esc(L.linkPagamento)}" target="_blank" rel="noopener">Pagar com cartão</a></div>` : ''}
      </div>
      <div class="folha-rodape col">
        <button class="btn-link" type="button" id="fp-novo">Fazer um novo pedido</button>
      </div>`;
    const copiar = $('#fp-copiar', folhaPedido);
    if (copiar) copiar.addEventListener('click', async () => {
      const ta = $('.pix-codigo', folhaPedido);
      try { await navigator.clipboard.writeText(ta.value); } catch (e) { ta.select(); document.execCommand('copy'); }
      copiar.textContent = 'Copiado ✓';
    });
    $('#fp-novo', folhaPedido).addEventListener('click', () => {
      pedido = { t: Date.now(), linhas: [] }; salvar(); folhaPedido.close(); scrollTo({ top: 0 });
    });
  }

  atualizarBarra();
  atualizarSelos();
})();
