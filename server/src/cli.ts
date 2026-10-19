import { config } from "./config.ts";
import { Store } from "./db.ts";

const store = new Store(config.dataDir);
const [command, ...args] = process.argv.slice(2);

const usage = `Utilisation :
  npm run admin -- create-key "<nom>"
  npm run admin -- list-keys
  npm run admin -- revoke-key <id>`;

if (command === "create-key" && args[0]) {
    const key = store.createAdminKey(args.join(" "));
    console.log(`Clé admin créée pour « ${args.join(" ")} » (affichée une seule fois) :\n${key}`);
} else if (command === "list-keys") {
    for (const row of store.listAdminKeys()) {
        const status = row.revoked_at ? `révoquée le ${new Date(row.revoked_at).toLocaleString("fr-FR")}` : "active";
        console.log(`#${row.id}  ${row.label}  créée le ${new Date(row.created_at).toLocaleString("fr-FR")}  ${status}`);
    }
} else if (command === "revoke-key" && args[0]) {
    console.log(store.revokeAdminKey(Number(args[0])) ? "Clé révoquée." : "Aucune clé active avec cet identifiant.");
} else {
    console.log(usage);
    process.exitCode = 1;
}
