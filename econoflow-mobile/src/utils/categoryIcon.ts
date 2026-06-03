export function getCategoryIcon(name: string): string {
  const n = name.toLowerCase();

  // ── Income-specific ──────────────────────────────────────────────────────
  if (/salary|salário|ordenado|vencimento|remuner|wage|payroll|pagamento/.test(n)) return 'cash-check';
  if (/freelanc|honorár|contrato.serv|consulting|consultoria/.test(n))             return 'laptop';
  if (/dividend|dividendo/.test(n))                                                 return 'chart-line';
  if (/pension|pensão|aposentad|previdência|reforma\b|annuity/.test(n))             return 'human-cane';
  if (/\bbonus\b|\bbônus\b|gratific|prize\b|prêmio|prémio|award/.test(n))          return 'star-circle-outline';
  if (/commission|comissão/.test(n))                                                return 'percent';
  if (/refund|reembolso|estorno|devolução|cashback/.test(n))                        return 'cash-refund';
  if (/subsídio|auxílio|bolsa\b|allowance|welfare|benefit\b|grant\b/.test(n))      return 'bank-outline';
  if (/\binterest\b|juros\b|yield\b/.test(n))                                       return 'bank';
  if (/side.?job|bico\b|part.?time|gig\b|extra\b/.test(n))                         return 'briefcase-outline';
  if (/transfer|transferência/.test(n))                                             return 'bank-transfer';
  if (/royalt/.test(n))                                                              return 'music-note-outline';
  if (/inherit|herança|legado/.test(n))                                             return 'account-arrow-right-outline';
  if (/rent.*(receiv|income|receb)|aluguel.*(receiv|receb)|arrendamento/.test(n))  return 'home-account';

  // ── Expense / category patterns ──────────────────────────────────────────
  if (/restaur|dining|eat out|café|cafe|bar|cantina|jantar|almoço/.test(n)) return 'silverware-fork-knife';
  if (/food|grocer|supermarket|market|alimenta|supermercado|comida|mercearia/.test(n)) return 'food-fork-drink';
  if (/coffee|café da manhã|breakfast|snack|lanche/.test(n)) return 'coffee';
  if (/fuel|gas|gasolina|petrol|diesel/.test(n)) return 'gas-station';
  if (/car|auto|vehicle|carro|viatura|automóvel/.test(n)) return 'car';
  if (/bus|train|metro|subway|transit|transport|transporte/.test(n)) return 'train';
  if (/hous|home|rent|mortgage|aluguel|renda|habitação|casa|condomínio/.test(n)) return 'home';
  if (/health|medical|pharmac|doctor|hospital|saúde|médico|farmácia|clinic|dental/.test(n)) return 'medical-bag';
  if (/gym|fitness|sport|desport|academia/.test(n)) return 'dumbbell';
  if (/entertain|leisure|lazer|cinema|movie|theater/.test(n)) return 'theater';
  if (/game|jogo/.test(n)) return 'gamepad-variant';
  if (/stream|netflix|spotify|subscri|assina/.test(n)) return 'television-play';
  if (/cloth|fashion|roupa|vestuár|apparel|shoes|sapato/.test(n)) return 'tshirt-crew';
  if (/electric|water|internet|phone|telef|água|luz|utilities|energia/.test(n)) return 'lightning-bolt';
  if (/educat|school|universit|educação|escola|curso|livro|book/.test(n)) return 'school';
  if (/travel|viagem|vacation|férias|holiday|trip|flight|voo/.test(n)) return 'airplane';
  if (/hotel|accommodation|hospedagem|hostel/.test(n)) return 'bed';
  if (/insur|seguro/.test(n)) return 'shield-check';
  if (/saving|poupança|invest|reserva/.test(n)) return 'piggy-bank-outline';
  if (/shop|compras|mall/.test(n)) return 'shopping';
  if (/pet|animal|dog|cat|cão|gato/.test(n)) return 'paw';
  if (/beauty|beleza|hair|cabelo|spa|salão|nail|manicure/.test(n)) return 'face-woman-outline';
  if (/baby|bebé|criança|child|kid|infantil/.test(n)) return 'baby-face-outline';
  if (/gift|presente|donation|donativo|charity/.test(n)) return 'gift-outline';
  if (/tax|imposto|multa|fine/.test(n)) return 'file-document-outline';
  if (/electronic|gadget|tech|laptop|phone|computador/.test(n)) return 'devices';

  // Default categories (EN + PT)
  if (/fixed.cost|custos?.fix|recurring|recorr|essential|essencial/.test(n)) return 'repeat-variant';
  if (/comfort|conforto|lifestyle|bem.estar|comodidade/.test(n)) return 'sofa';
  if (/enjoy|fun|divers|prazer|satisf|pleasure|leisure|lazer/.test(n)) return 'party-popper';
  if (/financial.freed|liberdade.fin|wealth|riqueza|independ/.test(n)) return 'trending-up';
  if (/self.improv|auto.desenv|crescimento|personal.growth|desenvolvimento|aprendiz|habilid/.test(n)) return 'arm-flex-outline';

  return 'shape-outline';
}
