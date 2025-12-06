import {auth} from "@/lib/auth";

export type HonoEnv = {Variables: {session?: typeof auth.$Infer.Session}; Bindings: Env};
