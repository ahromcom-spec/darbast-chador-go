/** Count every linked order, including rejected and archived orders. */
export function canDeleteStatement(status: string, linkedOrderCount: number): boolean {
  return status === 'closed' && linkedOrderCount === 0;
}