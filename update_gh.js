const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const token = execSync('& "C:\\Program Files\\GitHub CLI\\gh.exe" auth token', { shell: 'powershell.exe' }).toString().trim();
const repoName = 'warrenpong';
const owner = 'soreilly2785-maker';

function ghRequest(endpoint, method, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: endpoint,
      method: method,
      headers: {
        'User-Agent': 'WarrenPong-Uploader',
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {})
      }
    }, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(resData);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
          else reject(new Error(json.message || `HTTP ${res.statusCode}: ${resData}`));
        } catch (e) {
          resolve(resData);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach(file => {
    if (file === 'node_modules' || file === '.git' || file === 'functions') return;
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

(async () => {
  const ref = await ghRequest(`/repos/${owner}/${repoName}/git/refs/heads/main`, 'GET');
  const parentCommitSha = ref.object.sha;
  const commit = await ghRequest(`/repos/${owner}/${repoName}/git/commits/${parentCommitSha}`, 'GET');
  const baseTreeSha = commit.tree.sha;

  const rootDir = process.cwd();
  const allFiles = getAllFiles(rootDir);
  const treeEntries = [];

  for (const filePath of allFiles) {
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath);
    const isBinary = filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.mp3');

    const blob = await ghRequest(`/repos/${owner}/${repoName}/git/blobs`, 'POST', {
      content: content.toString(isBinary ? 'base64' : 'utf8'),
      encoding: isBinary ? 'base64' : 'utf-8'
    });

    treeEntries.push({
      path: relativePath,
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    });
  }

  const newTree = await ghRequest(`/repos/${owner}/${repoName}/git/trees`, 'POST', {
    base_tree: baseTreeSha,
    tree: treeEntries
  });

  const newCommit = await ghRequest(`/repos/${owner}/${repoName}/git/commits`, 'POST', {
    message: 'Implement baguette curved paddles, spin physics, 3x Fireball curve amp, EMP fix, and responsive string control',
    tree: newTree.sha,
    parents: [parentCommitSha]
  });

  await ghRequest(`/repos/${owner}/${repoName}/git/refs/heads/main`, 'PATCH', {
    sha: newCommit.sha,
    force: true
  });

  console.log('GitHub updated successfully with v2.8 physics, spin & balance!');
})();
