import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Github, MessageSquare, Send, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Open mailto with prefilled content as a simple contact fallback
    const subject = encodeURIComponent(`StreamVault contact from ${form.name}`);
    const body = encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`);
    window.location.href = `mailto:support@streamvault.app?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 pb-24">
      <h1 className="font-heading font-bold text-3xl sm:text-4xl text-foreground mb-3">
        Contact Us
      </h1>
      <p className="text-muted-foreground text-sm mb-10">
        Have a question, feature request, or spotted a bug? We'd love to hear from you.
      </p>

      {/* Contact methods */}
      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        <a
          href="mailto:support@streamvault.app"
          className="flex items-center gap-3 bg-card border border-border rounded-xl px-5 py-4 hover:border-primary/50 transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Email</p>
            <p className="text-xs text-muted-foreground">support@streamvault.app</p>
          </div>
        </a>

        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-card border border-border rounded-xl px-5 py-4 hover:border-primary/50 transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Github className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">GitHub</p>
            <p className="text-xs text-muted-foreground">Report issues & request features</p>
          </div>
        </a>
      </div>

      {/* Contact form */}
      {submitted ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
          <p className="font-heading font-semibold text-lg text-foreground">Message sent!</p>
          <p className="text-muted-foreground text-sm">Thanks for reaching out. We'll get back to you soon.</p>
          <Link to="/" className="text-primary text-sm hover:underline">Back to home</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-2xl p-6">
          <h2 className="font-heading font-semibold text-base text-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> Send a message
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Name</label>
              <Input
                required
                placeholder="Your name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Email</label>
              <Input
                required
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="bg-secondary border-border"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Message</label>
            <textarea
              required
              rows={5}
              placeholder="How can we help?"
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              className="w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>
          <Button type="submit" className="w-full gap-2">
            <Send className="w-4 h-4" /> Send Message
          </Button>
        </form>
      )}
    </div>
  );
}