const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const htmlPath = path.join(distDir, 'index.html');

if (!fs.existsSync(htmlPath)) {
  console.error('dist/index.html does not exist. Run npm run build first.');
  process.exit(1);
}

let html = fs.readFileSync(htmlPath, 'utf8');

// Replace CSS link with inline style
html = html.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (match, cssPath) => {
  const fullCssPath = path.join(distDir, cssPath.replace(/^\//, ''));
  if (fs.existsSync(fullCssPath)) {
    const cssContent = fs.readFileSync(fullCssPath, 'utf8');
    return `<style>\n${cssContent}\n</style>`;
  }
  return match;
});

// Replace JS script tag with inline script
html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (match, jsPath) => {
  const fullJsPath = path.join(distDir, jsPath.replace(/^\//, ''));
  if (fs.existsSync(fullJsPath)) {
    const jsContent = fs.readFileSync(fullJsPath, 'utf8');
    return `<script>\n${jsContent}\n</script>`;
  }
  return match;
});

const outputPath = path.join(__dirname, 'google_apps_script', 'Index.html');
fs.writeFileSync(outputPath, html, 'utf8');
console.log(`Successfully generated standalone ${outputPath} (${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB)`);
