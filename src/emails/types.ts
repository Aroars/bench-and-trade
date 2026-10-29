/** The facts a template needs. Built from the database rows, never from the form. */

export type EmailEvent = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  locationName: string;
  locationAddress: string;
};

export type EmailRegistration = {
  id: string;
  eventId: string;
  status: string;
  parentName: string;
  parentEmail: string;
  amountCents: number | null;
  studentNames: string[];
};

export type EmailContext = {
  registration: EmailRegistration;
  event: EmailEvent;
  /** Only set on waitlist emails. */
  unsubscribeUrl?: string;
  /** Only set on the new-class email. */
  signupUrl?: string;
};

export type BuiltEmail = {
  subject: string;
  html: string;
  text: string;
};
