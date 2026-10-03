// /discover was the new home's prototype address; it is the home now.
import { permanentRedirect } from "next/navigation";

export default function Page() {
  permanentRedirect("/");
}
