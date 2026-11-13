// =====================================================================
// Sr. John — CONFIGURAÇÃO DA LOJA
// É só aqui que se muda WhatsApp, Pix, link de pagamento e entrega.
// Vale para o link da bio, o cardápio/pedidos e a página de QR codes.
// =====================================================================
window.LOJA = {
  nome: 'Sr. John Chocolates & Café',

  // WhatsApp que recebe os pedidos: DDI + DDD + número, só dígitos
  whatsapp: '5516992412566', // (16) 99241-2566

  // Pix "pagar agora" (QR Code e copia e cola com o valor do pedido).
  // Enquanto a chave estiver vazia, a opção "Pix agora" não aparece
  // (o cliente ainda pode escolher Pix na retirada/entrega/caixa).
  // Chave: CPF/CNPJ só números, e-mail, celular no formato +5516999999999
  // ou chave aleatória.
  pix: {
    chave: '',
    nome: 'SR JOHN CHOCOLATES',   // até 25 letras, sem acento
    cidade: 'MORRO AGUDO',        // até 15 letras, sem acento
  },

  // Cartão online: link de pagamento do Mercado Pago, InfinitePay,
  // PagSeguro etc. Vazio = a opção "Cartão online" não aparece.
  linkPagamento: '',

  // Taxa de entrega em reais (ex.: 5 ou 7.5). null = "a combinar".
  taxaEntrega: null,

  // Modalidades aceitas
  modalidades: { retirada: true, entrega: true, mesa: true },
};
