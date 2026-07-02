'use client';

import { PublicNav, PublicFooter } from '@/components/layout/PublicChrome';

const SECTIONS = [
  {
    title: 'Account approval',
    body: 'Every trade account is reviewed by our admin team before it can place orders. Approval assigns a buyer tier, a credit limit and a payment term (prepaid, Net 30 or Net 60) to the account.',
  },
  {
    title: 'Minimum order quantities',
    body: 'Each product carries its own MOQ, shown on the product page. Orders below the MOQ for a line item are not accepted — quantity-break pricing applies once you cross set thresholds.',
  },
  {
    title: 'Credit limits',
    body: 'Accounts on Net 30/Net 60 terms have a credit limit. An order is only approved if the buyer\'s outstanding balance plus the new order stays within that limit; if a limit is lowered below current exposure, new orders are held until the balance clears.',
  },
  {
    title: 'Payment terms',
    body: 'Invoices are issued on order approval with a due date based on your account\'s payment term. Partial payments are accepted and tracked against the invoice balance; an invoice is marked paid only once the balance reaches exactly zero.',
  },
  {
    title: 'Returns & damaged stock',
    body: 'Return requests can be raised from a delivered order within the return window shown on the order. Approved returns are inspected on receipt and either restocked or written off, with any credit applied directly to your account.',
  },
  {
    title: 'Price changes',
    body: 'Prices may change between the time you view a product and when you complete checkout. If a price changes before an order is submitted, you\'ll see the difference and can accept it or adjust your cart before continuing.',
  },
];

export default function TradeTermsPage() {
  return (
    <main className="relative w-full bg-black text-white">
      <PublicNav />

      <section className="relative z-10 px-4 pb-24 pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow text-emerald-300/90">Support</p>
          <h1 className="mt-3 font-serif-display text-4xl font-medium text-white md:text-5xl">Trade terms</h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-white/70">
            The rules that govern buying on Orchids as a trade account — MOQs, credit terms, payment
            handling and returns.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-3xl space-y-4">
          {SECTIONS.map((s) => (
            <div key={s.title} className="glass-nav rounded-2xl p-6 text-left">
              <h2 className="font-serif-display text-xl font-medium text-white">{s.title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">{s.body}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-3xl text-center text-xs text-white/40">
          These terms apply to all trade accounts and may be updated from time to time. Contact the trade
          desk with any questions about a specific order or account.
        </p>
      </section>

      <PublicFooter />
    </main>
  );
}
