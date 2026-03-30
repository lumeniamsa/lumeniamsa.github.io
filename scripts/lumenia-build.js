const fs = require("fs");
const path = require("path");

const articlesDir = "./articles";
const outputJSON = "./articles-data.json";

const files = fs.readdirSync(articlesDir);

let articles = [];

files.forEach(file => {
  if (file.endsWith(".html")) {
    const filePath = path.join(articlesDir, file);
    const content = fs.readFileSync(filePath, "utf-8");

    // Extraire le titre
    const titleMatch = content.match(/<title>(.*?)<\/title>/);
    const title = titleMatch ? titleMatch[1] : "Sans titre";

    // Extraire description
    const descMatch = content.match(/<meta name="description" content="(.*?)"/);
    const description = descMatch ? descMatch[1] : "";

    articles.push({
      title,
      description,
      link: `articles/${file}`
    });
  }
});

// Sauvegarde JSON
fs.writeFileSync(outputJSON, JSON.stringify(articles, null, 2));

console.log("Articles générés automatiquement !");
