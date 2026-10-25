import { z } from "zod";
import { business } from "@/config/business";

const toppingValues = business.toppings.map((topping) => topping.value) as [
  (typeof business.toppings)[number]["value"],
  ...(typeof business.toppings)[number]["value"][],
];

const phone = z
  .string()
  .trim()
  .max(40)
  .refine((value) => value.replace(/\D/g, "").length >= 10, {
    message: "Enter a phone number with an area code.",
  });

export const signupSchema = z.object({
  idempotencyKey: z.string().uuid(),
  parentName: z.string().trim().min(2, "Enter the parent name.").max(120),
  parentEmail: z.string().trim().email("Enter a valid email.").max(200),
  parentPhone: phone,
  emergencyName: z
    .string()
    .trim()
    .min(2, "Enter an emergency contact name.")
    .max(120),
  emergencyPhone: phone,
  emergencyRelationship: z
    .string()
    .trim()
    .min(2, "Enter how you know the emergency contact.")
    .max(80),
  heardAbout: z.enum(business.heardAbout, {
    errorMap: () => ({ message: "Tell us how you heard about the class." }),
  }),
  updatesOptIn: z.boolean(),
  photoRelease: z.boolean({
    required_error: "Choose yes or no for photos.",
  }),
  waiverAccepted: z.literal(true, {
    errorMap: () => ({ message: "The waiver is required." }),
  }),
  allergenAck: z.literal(true, {
    errorMap: () => ({ message: "The kitchen allergen note is required." }),
  }),
  students: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Enter each child's name.").max(120),
        age: z
          .number()
          .int()
          .min(business.pilot.minAge)
          .max(business.pilot.maxAge),
        allergiesNotes: z.string().trim().max(2000),
        topping: z.enum(toppingValues),
      }),
    )
    .min(1, "Add at least one child.")
    .max(business.pilot.maxKidsPerSignup),
});

export type SignupInput = z.infer<typeof signupSchema>;

export function signupErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = message.match(/signup:([a-z_]+)/)?.[1];
  switch (code) {
    case "waiver_required":
      return "The waiver is required.";
    case "allergen_required":
      return "The kitchen allergen note is required.";
    case "photo_required":
      return "Choose yes or no for photos.";
    case "parent_name":
      return "Enter the parent name.";
    case "parent_email":
      return "Enter a valid email.";
    case "parent_phone":
    case "emergency":
      return "Check the phone numbers and emergency contact.";
    case "heard_about":
      return "Tell us how you heard about the class.";
    case "students":
      return "Add at least one child, and no more than six.";
    case "student_name":
      return "Enter each child's name.";
    case "student_age":
      return `This class is for ages ${business.pilot.minAge} to ${business.pilot.maxAge}.`;
    case "topping":
      return "Choose a pizza topping for each child.";
    case "config_mismatch":
      return "The class price in the database does not match the site. Sign-up is paused until that is fixed.";
    case "event_missing":
      return "This class is not in the database yet. Run the migration, then try again.";
    default:
      if (/password authentication|ECONNREFUSED|ENOTFOUND|fetch failed/i.test(message)) {
        return "The database is not connected. Check the server environment variables.";
      }
      return "We could not save the sign-up. Try again.";
  }
}
