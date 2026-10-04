import { redirect } from "next/navigation";

// The order builder now lives on the landing page, in the "Build a Parchi" section.
export default function OrderPage() {
  redirect("/#build");
}
