#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const { version } = require('../package.json');

const program = new Command();

program
    .name('thecore')
    .description('Headless CLI for scaffolding Thecore 3 Rails applications and ATOMs')
    .version(version);

program.on('command:*', () => {
    process.stderr.write(`error: unknown subcommand '${program.args[0]}'\n`);
    process.stderr.write(`Run 'thecore --help' for available subcommands.\n`);
    process.exit(1);
});

program.parse(process.argv);
