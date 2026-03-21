import { createCommand } from "./commands.js";

const program = createCommand();
program.parse(process.argv);
