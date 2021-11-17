import * as uuid from 'uuid';
import * as fs from 'fs';

/**
 * create temporary directory in /tmp
 */
export function createTempDir() {
  const tempDir = `tmp/${uuid.v4()}`;
  if (!fs.existsSync('tmp')) {
    fs.mkdirSync('tmp');
  }
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
  return tempDir;
}

/**
 * remove temporary directory in /tmp
 * @param tempDir string
 */
export function removeTempDir(tempDir) {
  var deleteFolderRecursive = function(path) {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach(function(file, index) {
        var curPath = path + '/' + file;
        if (fs.lstatSync(curPath).isDirectory()) {
          // recurse
          deleteFolderRecursive(curPath);
        } else {
          // delete file
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
  };

  deleteFolderRecursive(tempDir);
}
