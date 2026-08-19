import { redirect } from "next/navigation";

/**
 * Root domain redirect handler routing un-prefixed root traffic to the default locale prefix.
 */
export default function RootPage() {
  redirect("/en");
}
