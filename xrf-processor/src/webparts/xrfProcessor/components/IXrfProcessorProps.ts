import { SPFI } from "@pnp/sp";

export interface IXrfProcessorProps {
  sp: SPFI;
  description: string;
  isDarkTheme: boolean;
  environmentMessage: string;
  hasTeamsContext: boolean;
  userDisplayName: string;
}
