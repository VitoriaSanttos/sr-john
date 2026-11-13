// =====================================================================
// Sr. John — Pix "copia e cola" (BR Code estático) e QR Code em SVG
// Padrão do Banco Central (Manual de Padrões para Iniciação do Pix).
// =====================================================================

// CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no campo 63
function pixCRC16(texto) {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// pixPayload({ chave, nome, cidade, valor, txid }) → texto do "Pix copia e cola"
function pixPayload({ chave, nome, cidade, valor, txid }) {
  const campo = (id, v) => id + String(v.length).padStart(2, '0') + v;
  const limpa = (s, max) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().trim().slice(0, max);
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', String(chave).trim());
  let p = campo('00', '01') + campo('26', conta) + campo('52', '0000') + campo('53', '986');
  if (valor > 0) p += campo('54', valor.toFixed(2));
  p += campo('58', 'BR') + campo('59', limpa(nome, 25) || 'LOJA') + campo('60', limpa(cidade, 15) || 'BRASIL');
  const id = String(txid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  p += campo('62', campo('05', id)) + '6304';
  return p + pixCRC16(p);
}

// qrSVG(texto) → <svg> nítido em qualquer tamanho (usa a biblioteca qrcode-generator)
function qrSVG(texto, { margem = 2, nivel = 'M', titulo = 'QR Code' } = {}) {
  const qr = qrcode(0, nivel);
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount(), t = n + margem * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + margem} ${r + margem}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges" role="img" aria-label="${titulo}"><rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#1b1411"/></svg>`;
}
