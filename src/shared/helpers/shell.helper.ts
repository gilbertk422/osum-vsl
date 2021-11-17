import {exec as execFn} from 'child_process';
import * as util from 'util';

/**
 * execute cmd + params
 * @param cmd string
 * @param params array
 */
export async function runShell(cmd, params) {
  const {spawn} = require('child_process');
  const child = spawn(cmd, params);

  let stdout = '';
  for await (const chunk of child.stdout) stdout += chunk;
  let stderr = '';
  for await (const chunk of child.stderr) stderr += chunk;

  const exitCode = await new Promise(resolve => {
    child.on('close', resolve);
  });

  if (exitCode) {
    throw new Error(`subprocess error exit ${exitCode}, ${stderr}`);
  }
  return stdout;
}

/**
 * run in a single thread
 * @param cmd string
 */
export async function exec(cmd: string) {
  const exec = util.promisify(execFn);

  async function main() {
    const {stdout, stderr} = await exec(cmd);
    console.log(`subprocess ${cmd} result`);
    console.log(`stdout:`, stdout);
    console.log(`stderr:`, stderr);
    return {stdout, stderr};
  }

  return await main();
}
