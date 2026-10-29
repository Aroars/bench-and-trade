/**
 * Every word a parent reads in a Bench & Trade email lives here.
 * Edit the strings. Layout and sending live in src/emails and src/lib/email.
 *
 * Curly tokens are filled in when the email is built:
 *   {parentName}   the parent's name from the form
 *   {kidNames}     "Ada" or "Ada and Sam" or "Ada, Sam, and Lee"
 *   {hasHave}      "has" for one kid, "have" for more
 *   {isAre}        "is" for one kid, "are" for more
 *   {className}    the short class name, for example "Sawdust & Slice"
 *   {classTitle}   the full title from the events table
 *   {dateLabel}    "Saturday, November 14, 2026"
 *   {timeLabel}    "10:00 AM to 12:00 PM MST"
 *   {venueName}    "Casanova Pizzeria"
 *   {address}      "2431 W Fairview Ave, Boise, ID 83702"
 *   {instructor}   the instructor name from src/config/business.ts
 *   {amount}       "$80" for the family total
 *   {businessName} "Bench & Trade"
 *   {contactEmail} the business email
 *   {contactPhone} the business phone
 *   {daysOut}      "5 days" or "tomorrow" in reminders
 *   {signupUrl}    link to the sign-up page for a new class
 *   {unsubscribeUrl} the opt-out link, only in waitlist emails
 */

export const emailCopy = {
  /** Shown at the top of every email in the yellow band. */
  header: {
    wordmark: "Bench & Trade",
    tagline: "Real tools. Real trades.",
  },

  /** Every email ends with these lines. */
  footer: {
    signoff: "See you at the bench,",
    signature: "{instructor} and the {businessName} crew",
    contactLine:
      "Questions? Reply to this email, write to {contactEmail}, or call {contactPhone}.",
    unsubscribeLine: "Do not want emails about new classes?",
    unsubscribeLink: "Stop waitlist emails",
    unsubscribeDone: "You are off the waitlist email list. You will not hear about new classes from us.",
    legal: "{businessName}, {address}. You received this because you signed up on benchandtrade.com.",
  },

  /** Sent by the Stripe webhook once the card payment is confirmed. */
  confirmationPaid: {
    subject: "You're signed up: {className}, {dateLabel}",
    preview: "Payment went through. {kidNames} {hasHave} a spot.",
    heading: "You are signed up.",
    greeting: "Hi {parentName},",
    body: [
      "Payment went through for {className} on {dateLabel}, {timeLabel}. {kidNames} {hasHave} a spot.",
      "The class meets on the fenced patio at {venueName}, {address}. Parents stay for this one, and you are welcome to watch.",
      "We will email what to wear and what to bring a few days before class, and again the day before.",
    ],
    detailsHeading: "The details",
    amountLine: "Paid: {amount}",
  },

  /** Sent when Stripe is off and the spot is held for a payment link. */
  confirmationPending: {
    subject: "Your spot is held: {className}, {dateLabel}",
    preview: "Nothing charged yet. We will email a payment link before class.",
    heading: "Your spot is held.",
    greeting: "Hi {parentName},",
    body: [
      "We saved a spot for {kidNames} in {className} on {dateLabel}, {timeLabel}.",
      "Nothing has been charged. We will email you a payment link before class. Your spot stays held until then.",
      "The class meets on the fenced patio at {venueName}, {address}. Parents stay for this one.",
    ],
    detailsHeading: "The details",
    amountLine: "Due later: {amount}",
  },

  /** Sent when a sign-up lands on the waitlist because the class is full. */
  waitlist: {
    subject: "You're on the waitlist for {className}",
    preview: "The class is full. We will email you when a new class opens.",
    heading: "You are on the waitlist.",
    greeting: "Hi {parentName},",
    body: [
      "{className} on {dateLabel} is full, so we did not charge a card and {kidNames} {isAre} on the waitlist.",
      "If a spot opens for this date, we will reach out. When a new class opens, we will email you first so you can grab a spot before we post it.",
    ],
  },

  /** Reminders. The 5-day and day-before versions share a layout. */
  reminder: {
    subject5d: "{className} is in 5 days",
    subject1d: "{className} is tomorrow",
    preview5d: "What to wear, where to park, and when to show up.",
    preview1d: "See you tomorrow at {venueName}.",
    heading5d: "Class is in 5 days.",
    heading1d: "Class is tomorrow.",
    greeting: "Hi {parentName},",
    /** The warm note. It goes right under the greeting. */
    excitement:
      "We cannot wait to have {kidNames} at the bench. We have the boards cut, the sandpaper stacked, and the pizza oven booked. This is the part of the week we look forward to most.",
    body: [
      "Here is everything for {dateLabel}, {timeLabel}, at {venueName}, {address}.",
      "Please arrive about ten minutes early so we can sign kids in and get safety glasses fitted before the tool demo.",
    ],
    detailsHeading: "The details",
    wearHeading: "What to wear",
    bringHeading: "What to bring",
    instructorLine: "Your instructor is {instructor}.",
    closing1d:
      "If anything changes tonight or in the morning, reply to this email or call {contactPhone}.",
    closing5d:
      "If a plan changes and you cannot make it, let us know and we will offer the spot to the waitlist.",
  },

  /** Sent by the admin "notify the waitlist" button when a new class opens. */
  waitlistNewClass: {
    subject: "A new class just opened: {className}",
    preview: "You asked us to tell you first. Spots are limited.",
    heading: "A new class is open.",
    greeting: "Hi {parentName},",
    body: [
      "You are on our waitlist, so you are hearing about this before we post it anywhere else.",
      "{classTitle} meets {dateLabel}, {timeLabel}, at {venueName}, {address}.",
      "Spots go in sign-up order. If you want one, sign up now.",
    ],
    button: "Sign up",
    detailsHeading: "The details",
  },

  /** Labels for the details block. */
  labels: {
    class: "Class",
    date: "Date",
    time: "Time",
    where: "Where",
    kids: "Kids",
    instructor: "Instructor",
  },
} as const;
