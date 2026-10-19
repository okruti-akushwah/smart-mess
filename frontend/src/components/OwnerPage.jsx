// Keep the native main landmark and the shared shell's sibling layout contract.
export default function OwnerPage({ className = '', children }) {
  return <main className={`dashboard owner-page ${className}`.trim()}>{children}</main>;
}
