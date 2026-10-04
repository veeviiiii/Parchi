import { redirect } from "next/navigation";

// The order builder now lives at /build.
export default function OrderPage() {
  redirect("/build");
}
