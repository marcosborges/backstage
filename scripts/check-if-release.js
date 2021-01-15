#!/usr/bin/env node
/* eslint-disable import/no-extraneous-dependencies */
/*
 * Copyright 2020 Spotify AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// This script is used to determine whether a particular commit has changes
// that should lead to a release. It is run as part of the main master build
// to determine whether the release flow should be run as well.
//
// It has the following output which can be used later in GitHub actions:
//
// needs_release = 'true' | 'false'

const { execFile: execFileCb } = require('child_process');
const { resolve: resolvePath } = require('path');
const { promises: fs } = require('fs');
const { promisify } = require('util');

const execFile = promisify(execFileCb);

async function runPlain(cmd, ...args) {
  try {
    const { stdout } = await execFile(cmd, args, { shell: true });
    return stdout.trim();
  } catch (error) {
    if (error.stderr) {
      process.stderr.write(error.stderr);
    }
    if (!error.code) {
      throw error;
    }
    throw new Error(
      `Command '${[cmd, ...args].join(' ')}' failed with code ${error.code}`,
    );
  }
}

async function main() {
  const parentRef = '619ef5978c3fbfa7c9d6a65c835e1e87dbcec55e';
  process.cwd(resolvePath(__dirname, '..'));

  const diff = await runPlain(
    'git',
    'diff',
    '--name-only',
    parentRef,
    '{packages,plugins}/*/package.json',
  );
  console.log('DEBUG: diff =', diff);
  const packageList = diff.split(/^(.*)$/gm).filter(s => s.trim());

  const packageVersions = await Promise.all(
    packageList.map(async path => {
      const { name, version: oldVersion } = JSON.parse(
        await fs.readFile(path, 'utf8'),
      );
      const { version: newVersion } = JSON.parse(
        await runPlain('git', 'show', `${parentRef}:${path}`),
      );
      return { name, oldVersion, newVersion };
    }),
  );
  console.log('DEBUG: packageVersions =', packageVersions);

  const newVersions = packageVersions.filter(
    ({ oldVersion, newVersion }) => oldVersion !== newVersion,
  );

  if (newVersions.length === 0) {
    console.log('No package version bumps found, no release needed');
    console.log(`::set-output name=needs_release::false`);
    return;
  }

  console.log('Package version bumps found, a new release is needed');
  const maxLength = Math.max(...newVersions.map(_ => _.name.length));
  for (const { name, oldVersion, newVersion } of newVersions) {
    console.log(
      `  ${name.padEnd(maxLength, ' ')} ${oldVersion} -> ${newVersion}`,
    );
  }
  console.log(`::set-output name=needs_release::true`);
}

main().catch(error => {
  console.error(error.stack);
  process.exit(1);
});
