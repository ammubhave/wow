import {env} from "cloudflare:workers";
import {drizzle} from "drizzle-orm/d1";

import {relations} from "./relations";
export const db = drizzle(env.DB, {relations});
