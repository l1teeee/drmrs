export function formatWhatsappDisplay(digits: string): string {
  const match = /^52(\d{3})(\d{3})(\d{4})$/.exec(digits);
  return match && match[0] === digits ? `+52 ${match[1]} ${match[2]} ${match[3]}` : digits;
}

export function whatsappChatUrl(digits: string): string {
  return `https://wa.me/${digits}`;
}
