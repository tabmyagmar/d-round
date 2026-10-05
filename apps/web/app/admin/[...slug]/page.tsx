import { notFound } from "next/navigation";

/**
 * Any /admin URL without a page renders `app/admin/not-found.tsx` inside the shell instead of the
 * bare root 404. Static and `[id]` segments are matched before this catch-all.
 */
const AdminUnknownPage = () => notFound();

export default AdminUnknownPage;
