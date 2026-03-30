// articles.js

// Liste des articles (titre, URL, date, catégorie, icône)
const articles = [
  {
    title: "5 conseils pour mieux gérer le temps",
    url: "articles/5-conseils-pour-mieux-gérer-le-temps.html",
    date: "30 mars 2025",
    category: "Développement personnel",
    icon: "📝"
  },
  // Ajouter d'autres articles ici
  // { title: "Titre", url: "articles/fichier.html", date: "JJ MMM AAAA", category: "Catégorie", icon: "📌" }
];

function generateArticles() {
  const container = document.querySelector(".card-list");
  if (!container) return;

  container.innerHTML = ""; // vide avant d'ajouter

  articles.forEach(article => {
    const card = document.createElement("a");
    card.className = "card";
    card.href = article.url;

    card.innerHTML = `
      <span class="icon">${article.icon}</span>
      <h3>${article.title}</h3>
      <span class="type">${article.category} · ${article.date}</span>
    `;
    container.appendChild(card);
  });
}

// Exécuter après le chargement du DOM
document.addEventListener("DOMContentLoaded", generateArticles);
