/**
 * Tells Google Tag Manager that a form was sent, by pushing a `form_submit`
 * event onto the dataLayer. GTM's own "Form Submission" trigger can't see our
 * forms, because they post to HubSpot in the background without a page load,
 * so a GTM trigger on the custom event `form_submit` is how a conversion is
 * counted. Call it only after the submission succeeded.
 *
 * No personal data is sent: only which form it was and where.
 *   form_name  readable name (the form's headline, or a fallback)
 *   form_id    the HubSpot form GUID, when there is one
 *   form_type  'contact' (ContactForm) or 'content_gate' (ContentGate)
 *
 * Harmless without GTM: the push just sits on an array nothing reads.
 */
type FormSubmit = { form_name: string; form_id?: string; form_type: 'contact' | 'content_gate' };

export function trackFormSubmit(detail: FormSubmit) {
  const w = window as unknown as { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event: 'form_submit', ...detail, page_path: window.location.pathname });
}
