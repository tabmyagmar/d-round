import { LoadingState } from "@repo/ui/components/composed/loading-state";

/** Shown inside the shell while an /admin page (and its PageGuard) renders on the server. */
const AdminLoading = () => <LoadingState message="読み込み中..." />;

export default AdminLoading;
