/** The Japanese flag (日の丸): a red sun on white. */
export function JapanFlag({ w = 30 }: { w?: number }) {
  return (
    <svg width={w} height={w * 2 / 3} viewBox="0 0 30 20" role="img" aria-label="Japan" style={{ borderRadius: 3, boxShadow: '0 0 0 1px rgba(0,0,0,.12)', flex: 'none', display: 'block' }}>
      <rect width="30" height="20" fill="#fff" />
      <circle cx="15" cy="10" r="6" fill="#bc002d" />
    </svg>
  );
}
