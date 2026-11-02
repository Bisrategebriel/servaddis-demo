// Stand-in for the payment gateway's hosted page (SCR-E12): deliberately not the app shell, and
// a neutral look that doesn't imitate any real provider's branding (doc 04 SCR-E11/E12/E13).
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="main"
      className="flex min-h-dvh flex-1 items-start justify-center bg-gray-100 px-4 py-10"
    >
      {children}
    </main>
  );
}
