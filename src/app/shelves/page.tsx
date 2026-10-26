import { redirect } from "next/navigation";

import { SHELF_IDS } from "@/lib/shelves";

/** `/shelves` has no content of its own; open the first shelf. */
export default function ShelvesIndexPage() {
  redirect(`/shelves/${SHELF_IDS[0]}`);
}
