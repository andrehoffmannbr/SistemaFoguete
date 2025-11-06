export const PROPOSAL_ALLOWED_STATUS = ['pending', 'sent', 'accepted', 'rejected', 'confirmed', 'canceled'] as const;
export type ProposalStatus = typeof PROPOSAL_ALLOWED_STATUS[number];

export function normalizeConfirmStatus(desired?: string): ProposalStatus {
  // Para confirmação de orçamento, usar 'confirmed' se permitido, senão 'accepted'
  if (desired === 'confirmed' && PROPOSAL_ALLOWED_STATUS.includes('confirmed' as any)) {
    return 'confirmed';
  }
  // Fallback para qualquer outro valor
  return 'confirmed';
}