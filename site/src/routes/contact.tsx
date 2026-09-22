import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import { pageMeta } from "@/lib/page-meta";
import { SITE } from "@/lib/plans";
import { useDesk } from "@/lib/use-desk";

const field =
  "mt-2 w-full rounded-control border border-line bg-surface px-3 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/30";

export const Route = createFileRoute("/contact")({
  head: () => pageMeta("Contact", "Write to MapleSpike. The note stays in this browser."),
  component: ContactPage,
});

function ContactPage() {
  const { desk, update } = useDesk();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update({ ...desk, contact: { name: name.trim(), email: email.trim(), message: message.trim() } });
    setDone(true);
  }

  return (
    <Shell>
      <PageHeader
        kicker="Contact"
        title="Write the desk."
        lede="Sales and support for a cluster seat go through MapleSpike. This form keeps a copy on this device. It is not delivered."
      />
      <form onSubmit={onSubmit} className="mx-auto grid max-w-lg gap-4 px-5 py-12 sm:px-8">
        <div>
          <label htmlFor="contact-name" className="text-sm font-medium">Name</label>
          <input id="contact-name" required value={name} onChange={(event) => setName(event.target.value)} className={`${field} h-11`} />
        </div>
        <div>
          <label htmlFor="contact-email" className="text-sm font-medium">Email</label>
          <input id="contact-email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={`${field} h-11`} />
        </div>
        <div>
          <label htmlFor="contact-message" className="text-sm font-medium">Message</label>
          <textarea id="contact-message" required rows={5} value={message} onChange={(event) => setMessage(event.target.value)} className={`${field} p-3`} />
        </div>
        <Button type="submit" size="lg" className="w-fit">Save message</Button>
        {done ? <p className="text-sm text-muted" role="status">Saved on this browser. It was not sent.</p> : null}
        <p className="text-sm text-muted">
          The public site is{" "}
          <a className="underline decoration-line-strong underline-offset-4" href={SITE.url}>
            quill.maplespike.ca
          </a>
          .
        </p>
      </form>
    </Shell>
  );
}
