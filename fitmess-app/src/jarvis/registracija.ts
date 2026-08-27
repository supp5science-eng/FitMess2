/**
 * The one place tools and screen components are switched on.
 *
 * Tool modules register themselves as a side effect of being imported, so
 * something has to import them — and that something is deliberately a single
 * file rather than each screen importing what it happens to need. A tool that
 * exists but is never imported is worse than one that does not exist: it looks
 * present in the source, is absent from every prompt, and Jarvis answers "to
 * još ne umem" about a feature that is sitting right there in the tree.
 *
 * Adding a capability to Jarvis is therefore two lines: write the tool, import
 * it here.
 */

import { registrujKomponentu } from "./alat";
import { KarticaDana } from "./komponente/KarticaDana";
import { KarticaVode } from "./komponente/KarticaVode";

import "./alati/dan";
import "./alati/voda";

registrujKomponentu("KarticaDana", KarticaDana as never);
registrujKomponentu("KarticaVode", KarticaVode as never);
