export function maskDestination(value: string | null): string | null {
  if (!value) return value;
  
  // UPI ID: username@bank
  if (value.includes('@')) {
    const [user, domain] = value.split('@');
    if (!domain) return value;
    const maskedUser = user.length > 2 ? user.slice(0, 1) + '***' : '*'.repeat(user.length);
    return `${maskedUser}@${domain}`;
  }
  
  // Normal bank account or phone: keep last 4
  if (value.length > 4) {
    return '******' + value.slice(-4);
  }
  
  return '******';
}
