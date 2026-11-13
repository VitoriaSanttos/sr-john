// Teste do fluxo completo: bio → cardápio → pedido → link do WhatsApp → confirmação.
// Uso (na raiz do repositório): node testes/fluxo-pedido.js public site
// Precisa do Playwright com o Chromium (npm i -D playwright && npx playwright install chromium).
const { chromium } = require('playwright');
const path = require('path'); const http = require('http'); const fs = require('fs');
const root = path.resolve(process.argv[2]); const embrulhar = process.argv[3] === 'artifact';
const types = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  let p = path.join(root, u); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    if (embrulhar && p === path.join(root, 'index.html')) d = Buffer.from('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + d + '</body></html>');
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'text/plain' }); res.end(d);
  });
}).listen(0, async () => {
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch(); const errs = []; const whats = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(/wa\.me/, (r) => { whats.push(r.request().url()); r.fulfill({ body: 'ok', contentType: 'text/plain' }); });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  pg.on('response', (r) => r.status() >= 400 && errs.push(r.status() + ' ' + r.url()));
  await pg.goto(base + (embrulhar ? 'index.html' : ''), { waitUntil: 'networkidle' });
  if (embrulhar) console.log('faixa:', await pg.textContent('.demo-faixa'));
  await pg.click('a.link.destaque'); await pg.waitForLoadState('networkidle');
  console.log('abriu:', pg.url().replace(base, '/'));
  await pg.addStyleTag({ content: '*{animation:none!important}' });
  await pg.click('button.add[data-add="cafes-0-0"]'); await pg.click('#fi-add');
  await pg.click('#barra-pedido'); await pg.click('#fp-continuar');
  // sem nome: o link NÃO pode abrir o WhatsApp
  await pg.click('#fp-enviar'); await pg.waitForTimeout(300);
  console.log('bloqueou sem dados:', whats.length === 0, 'erros visíveis:', await pg.$$eval('#folha-pedido .erro:not([hidden])', (l) => l.length));
  await pg.fill('input[name="nome"]', 'Teste');
  const temPix = await pg.$('label.escolha:has-text("Pix agora")');
  await pg.click(temPix ? 'label.escolha:has-text("Pix agora")' : 'label.escolha:has-text("Cartão de crédito")');
  const [popup] = await Promise.all([ctx.waitForEvent('page'), pg.click('#fp-enviar')]);
  await pg.waitForTimeout(400);
  console.log('abriu WhatsApp em nova aba:', !!popup, 'pedidos capturados:', whats.length);
  console.log('mensagem:\n' + decodeURIComponent(whats[0].split('text=')[1]));
  console.log('tela enviado:', await pg.isVisible('.ok'), 'pix visível:', await pg.isVisible('.pix-qr svg'));
  await pg.click('#fp-novo');
  await pg.click('a.voltar'); await pg.waitForLoadState('networkidle');
  console.log('voltou para:', pg.url().replace(base, '/'), 'bio ok:', await pg.isVisible('a.link.destaque'));
  // mesa por hash
  await pg.goto(base + 'cardapio/index.html#mesa-7', { waitUntil: 'networkidle' });
  console.log('mesa por #:', await pg.textContent('.mesa-aviso').catch(() => 'nenhum'));
  console.log('erros:', errs);
  await b.close(); srv.close();
});
