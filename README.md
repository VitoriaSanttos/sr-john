# ☕ Sr. John Chocolates & Café — link da bio, cardápio e pedidos

Site do **Sr. John Chocolates & Café** (Morro Agudo/SP), feito pela DuoTech:
link da bio do Instagram, cardápio online com fotos, pedidos pelo WhatsApp
(retirada, entrega e mesa), Pix com QR Code e QR codes para as mesas.

HTML + CSS + JavaScript puro, **sem build** e sem servidor. Hospedagem: Cloudflare (pasta `public/`).

**No ar:** https://sr-john.duotechsistemas.workers.dev/ · cardápio: https://sr-john.duotechsistemas.workers.dev/cardapio/ · QR codes: https://sr-john.duotechsistemas.workers.dev/qrcodes/

## Estrutura

```
public/                      ← o site (só isto vai para o ar)
  index.html                 ← link da bio (página inicial)
  cardapio/index.html        ← cardápio: itens, preços, fotos (bloco CARDAPIO)
  cardapio/pedido.js         ← carrinho, finalizar, envio pelo WhatsApp
  cardapio/pedido.css        ← visual do carrinho
  qrcodes/index.html         ← QR codes para imprimir (geral + mesas)
  js/config.js               ← WhatsApp, Pix, link de pagamento, taxa de entrega
  js/pix.js                  ← Pix copia e cola / QR Code (padrão Banco Central)
  js/vendor/qrcode-generator.js ← gerador de QR (MIT, Kazuhiko Arase)
  img/logo.png               ← logo (provisório, recortado do Instagram)
  img/fotos/*.jpg            ← fotos dos pratos (provisórias, ~100 px)
docs/proposta/               ← proposta comercial (HTML + PDF), não vai para o ar
testes/fluxo-pedido.js       ← teste do fluxo de pedido no navegador
wrangler.jsonc               ← configuração da Cloudflare
```

## Como funciona o pedido
1. O cliente toca no **+** do item (ou no tamanho) → sabor/opção, quantidade, observação.
2. **Ver pedido** → **Continuar** → Retirada, Entrega ou Na mesa → nome/endereço → pagamento.
3. **Enviar pedido pelo WhatsApp** abre a conversa da loja com o pedido escrito
   (número do pedido, itens, total, pagamento). O cliente só toca em enviar.
4. **Pix agora** mostra o QR Code Pix com o valor exato + copia e cola.

Mesa: o QR da mesa abre `cardapio/?mesa=5` (ou `cardapio/#mesa-5`) e o pedido sai como **Mesa 5**.

## Configurar — `public/js/config.js`
| Campo | O que é |
|---|---|
| `whatsapp` | Número que recebe os pedidos: `5516992412566` = (16) 99241-2566 |
| `pix.chave` | Chave Pix da loja. Vazio = opção "Pix agora" escondida |
| `linkPagamento` | Link de pagamento com cartão (Mercado Pago, InfinitePay…). Vazio = escondido |
| `taxaEntrega` | Valor em reais (ex.: `6`) ou `null` = "a combinar" |
| `modalidades` | Liga/desliga retirada, entrega e mesa |
| `demo` | `true` só na demonstração: marca a mensagem como teste |

## Mudar preço, nome ou descrição
`public/cardapio/index.html`, bloco `CARDAPIO`. `p: 12.9` = R$ 12,90.
- `escolha: { t: 'Sabor', o: ['A', 'B'] }` → o cliente tem que escolher um.
- `pergunta: 'Quais 2 queijos?'` → o cliente tem que responder.
- `f: 'brownie'` → foto `img/fotos/brownie.jpg`.

## Trocar as fotos e o logo
JPG de pelo menos 800 × 800 px, **com o mesmo nome** do arquivo em `public/img/fotos/`.
Com 400 px ou mais, o toque para ampliar liga sozinho. Logo: `public/img/logo.png` (quadrado).

## Publicar na Cloudflare (uma vez, ~10 min, grátis)
1. **dash.cloudflare.com** → **Workers & Pages** → **Create** → **Import a repository**.
2. Autorize e selecione este repositório.
3. Preencha:

   | Campo | Valor |
   |---|---|
   | Project name | `sr-john` (igual ao `"name"` do `wrangler.jsonc`) |
   | Production branch | `main` |
   | Build command | *(vazio)* |
   | Deploy command | `npx wrangler deploy` |

4. **Deploy** → aparece o endereço `workers.dev`.
5. Domínio: **sr-john → Settings → Domains & Routes → Add → Custom domain** →
   `srjohn.duotechsistem.com.br` (ou o domínio do cliente).

Depois disso, **todo envio para a `main` publica sozinho**.

## Depois de publicar
- Abra `…/qrcodes/` no site publicado: o endereço é preenchido sozinho → escolha as mesas → **Imprimir**.
- Troque o link da bio do Instagram (hoje aponta para o Canva) pelo endereço do site.

## Limites (sem servidor)
- O pedido chega como mensagem no WhatsApp; não fica salvo num painel.
- O Pix é conferido pelo comprovante (sem confirmação automática).
