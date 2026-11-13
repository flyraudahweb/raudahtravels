import { Phone } from "lucide-react";

const contactNumbers = ["08036264607", "08034803504"];

export function MobileContactBar() {
  return (
    <div
      role="group"
      aria-label="Call Raudah Travels"
      className="flex h-10 items-center justify-center divide-x divide-white/20 bg-[#1C1F66] text-xs font-medium text-white md:hidden"
    >
      {contactNumbers.map((number) => (
        <a
          key={number}
          href={`tel:${number}`}
          className="flex h-full items-center gap-1.5 whitespace-nowrap px-3 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
        >
          <Phone aria-hidden="true" className="size-3.5 shrink-0 text-[#FF865F]" />
          {number}
        </a>
      ))}
    </div>
  );
}
