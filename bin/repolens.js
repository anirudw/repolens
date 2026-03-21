#!/usr/bin/env node

import { createCommand } from "../dist/cli/commands.js";

const program = createCommand();
program.parse(process.argv);
