import Image from "next/image";
import { Button } from "@/components/ui/button";

// Placeholder until T1.1 builds SCR-00 Landing. Strings move to messages/*.json in T0.6.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center gap-3 bg-navy-900 px-4 py-3">
        <Image src="/icons/servaddis-icon.svg" alt="" width={32} height={32} priority />
        <span className="text-lg font-bold text-white">
          Serv<span className="text-amber-500">አዲስ</span>
        </span>
      </header>
      <section className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-12">
        <h1 className="text-3xl font-bold">The hiring platform built only for hospitality.</h1>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg">I&apos;m hiring</Button>
          <Button size="lg" variant="outline">
            I&apos;m looking for work
          </Button>
        </div>
        <p className="text-sm text-text-secondary">Demo build · T0.1 scaffold</p>
      </section>
    </main>
  );
}
