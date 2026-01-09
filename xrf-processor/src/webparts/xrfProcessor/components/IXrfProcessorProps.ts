import { SPFI } from "@pnp/sp";

export interface IXrfProcessorProps {
  sp: SPFI;
  description: string;
  environmentMessage: string;
  hasTeamsContext: boolean;
  userDisplayName: string;
}
