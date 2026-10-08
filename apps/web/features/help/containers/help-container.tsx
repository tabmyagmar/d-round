import { HelpGuideTable } from "@/features/help/components/help-guide-table";
import { HELP_GUIDES } from "@/features/help/utils/help-guides";

/** 操作方法: the guide books to download. Static, so it renders on the server. */
export const HelpContainer = () => <HelpGuideTable guides={HELP_GUIDES} />;
