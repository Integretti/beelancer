export default function HoneycombBackground() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-50"
      style={{
        opacity: 0.09,
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='56' height='56' viewBox='0 0 56 56' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M28 0l24.25 14v28L28 56 3.75 42V14z' fill='none' stroke='%23fbbf24' stroke-width='1'/%3E%3C/svg%3E")`,
        backgroundSize: '56px 56px',
      }}
      aria-hidden="true"
    />
  );
}
