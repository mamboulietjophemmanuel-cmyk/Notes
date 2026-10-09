import { MarkdownDocument, MediaAsset, ProjectFolder } from '../types/note';
import architectureImg from '../assets/images/note_architecture_diagram_1791547431027.jpg';
import opticsImg from '../assets/images/note_optics_simulation_1791547444311.jpg';

export const INITIAL_PROJECTS: ProjectFolder[] = [
  {
    id: 'proj-science',
    name: 'Recherche & Physique',
    description: 'Notes de laboratoire, équations optiques et simulations',
  },
  {
    id: 'proj-arch',
    name: 'Architecture Système',
    description: 'Cahiers des charges techniques et topologie distribuée',
  },
  {
    id: 'proj-docs',
    name: 'Documentation & Guides',
    description: 'Manuels Markdown, formules LaTeX et raccourcis Windows',
  },
];

export const INITIAL_ASSETS: Record<string, MediaAsset> = {
  'asset-optics-prism': {
    id: 'asset-optics-prism',
    name: 'spectre_dispersion_prisme.jpg',
    dataUrl: opticsImg,
    mimeType: 'image/jpeg',
    sizeBytes: 248320,
    createdAt: '2026-10-09T08:30:00Z',
  },
  'asset-arch-desk': {
    id: 'asset-arch-desk',
    name: 'plan_architecture_poste.jpg',
    dataUrl: architectureImg,
    mimeType: 'image/jpeg',
    sizeBytes: 312400,
    createdAt: '2026-10-09T09:15:00Z',
  },
};

export const INITIAL_DOCUMENTS: MarkdownDocument[] = [
  {
    id: 'doc-optics',
    filename: 'Optique & Dispersion.md',
    projectId: 'proj-science',
    pinnedInSidebar: true,
    updatedAt: 'Aujourd’hui · 11:42',
    content: `# Réfraction et dispersion chromatique dans un prisme

Ce document synthétise les mesures de déviation angulaire d'un faisceau polychromatique traversant un prisme en verre crown ($n_d = 1{,}522$) d'angle au sommet $A = 60^\\circ$.

![Simulation de dispersion par prisme|100%](asset://asset-optics-prism)

## 1. Relations fondamentales du prisme

D'après la loi de Snell-Descartes aux deux dioptres air-verre, les angles d'incidence $(i, i')$ et de réfraction $(r, r')$ vérifient le système suivant :

$$\\sin(i) = n(\\lambda)\\sin(r) \\quad \\text{et} \\quad \\sin(i') = n(\\lambda)\\sin(r')$$

Avec les relations géométriques internes au triangle de section principale :

$$A = r + r' \\quad \\text{et} \\quad D(\\lambda) = i + i' - A$$

Au minimum de déviation $D_m$, le trajet lumineux est symétrique ($r = r' = A/2$), ce qui conduit à l'expression directe de l'indice de réfraction en fonction de la longueur d'onde $\\lambda$ :

$$n(\\lambda) = \\frac{\\sin\\left(\\frac{A + D_m(\\lambda)}{2}\\right)}{\\sin\\left(\\frac{A}{2}\\right)}$$

## 2. Relevé expérimental par longueur d'onde

La loi empirique de Cauchy modélise la variation de l'indice sur le spectre visible selon $n(\\lambda) = A_0 + \\frac{B_0}{\\lambda^2}$ :

| Raie spectrale | Longueur d'onde (nm) | Indice mesuré n(λ) | Angle de réfraction r₁ | Déviation minimale Dm |
| :--- | :---: | :---: | :---: | :---: |
| Rouge (Raie C) | 656.3 | 1.5142 | 27.72° | 38.31° |
| Jaune (Doublet D) | 589.3 | 1.5170 | 27.66° | 38.56° |
| Vert (Raie e) | 546.1 | 1.5194 | 27.61° | 38.78° |
| Bleu (Raie F) | 486.1 | 1.5243 | 27.51° | 39.22° |
| Violet (Raie h) | 404.7 | 1.5348 | 27.31° | 40.18° |

> Le nombre d'Abbe caractérisant la constringence du matériau est évalué par $\\nu_d = \\frac{n_d - 1}{n_F - n_C} = 64{,}1$, confirmant une faible dispersion résiduelle adaptée aux doublets achromatiques.

## 3. Protocole de vérification optique

- [x] Étalonner le goniomètre au réticule auto-collimateur
- [x] Mesurer l'angle au sommet $A = 60{,}00^\\circ \\pm 0{,}02^\\circ$
- [x] Enregistrer la déviation minimale sur les 5 raies de référence
- [ ] Calculer les coefficients de régression de Sellmeier
- [ ] Exporter le rapport final au format Markdown (\`.md\`)
`,
  },
  {
    id: 'doc-architecture',
    filename: 'Architecture Système.md',
    projectId: 'proj-arch',
    pinnedInSidebar: true,
    updatedAt: 'Aujourd’hui · 10:18',
    content: `# Spécifications du moteur de synchronisation locale

Ce cahier technique décrit le pipeline d'indexation de fichiers Markdown (\`.md\`) sur poste de travail Windows avec prise en charge temps réel des onglets multiples et du glisser-déposer d'actifs graphiques.

![Poste de travail et plans d'architecture|100%](asset://asset-arch-desk)

## 1. Modèle de latence et débit d'écriture

Le sous-système d'entrée/sortie applique une file d'attente M/M/1 avec amortissement d'écriture (*debounced atomic write*). Le temps moyen de séjour $W$ dans la file en fonction du taux d'arrivée $\\lambda$ et de la cadence de traitement $\\mu$ suit la loi de Little :

$$W = \\frac{1}{\\mu - \\lambda} \\quad \\text{avec} \\quad \\rho = \\frac{\\lambda}{\\mu} < 1$$

## 2. Comparatif des performances par opération

| Opération fichier | Taille moyenne | Temps médian (p50) | Percentile p99 | Empreinte mémoire |
| :--- | :---: | :---: | :---: | :---: |
| Ouverture d'onglet .md | 48 Ko | 1.8 ms | 4.2 ms | 1.4 Mo |
| Analyse syntaxique + KaTeX | 120 Ko | 4.5 ms | 9.8 ms | 3.1 Mo |
| Dépôt d'image (Drag & Drop) | 850 Ko | 6.2 ms | 14.0 ms | 4.8 Mo |
| Exportation projet complet | 2.4 Mo | 11.4 ms | 22.5 ms | 6.2 Mo |

## 3. Extrait de configuration du parseur

\`\`\`json
{
  "workspace": "Windows-Libadwaita-Notes",
  "encoding": "UTF-8",
  "markdown": {
    "gfmTables": true,
    "katexMath": true,
    "dragAndDropImages": true
  }
}
\`\`\`

## 4. Liste de contrôle de déploiement

- [x] Synchronisation automatique avec le thème Windows (Clair / Sombre)
- [x] Gestion multi-onglets de type \`AdwTabBar\` avec aperçu en grille
- [x] Glisser-déposer natif d'images et de fichiers \`.md\`
- [ ] Validation des jeux d'essai sur grands corpus (> 500 notes)
`,
  },
  {
    id: 'doc-guide',
    filename: 'Guide Markdown & Raccourcis.md',
    projectId: 'proj-docs',
    pinnedInSidebar: false,
    updatedAt: 'Hier · 18:05',
    content: `# Guide rapide : Syntaxe Markdown & Raccourcis Windows

Bienvenue dans **AdwNotes**, un environnement de prise de notes inspiré du langage de design **GNOME Libadwaita** et optimisé pour **Windows**.

## 1. Raccourcis clavier Windows

| Raccourci | Action dans l'application | Zone |
| :--- | :--- | :--- |
| \`Ctrl + N\` | Créer et ouvrir un nouveau document \`.md\` dans un onglet | Onglets |
| \`Ctrl + O\` | Ouvrir un ou plusieurs fichiers \`.md\` depuis Windows | Fichier |
| \`Ctrl + S\` | Télécharger / Enregistrer le fichier \`.md\` actif | Fichier |
| \`Ctrl + \\\` | Afficher ou masquer le panneau latéral des projets | Fenêtre |
| \`Ctrl + B\` | Mettre la sélection en **gras** | Éditeur |
| \`Ctrl + I\` | Mettre la sélection en *italique* | Éditeur |

## 2. Formules mathématiques (LaTeX / KaTeX)

Vous pouvez insérer des formules en ligne entourées d'un symbole dollar comme $\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}$, ou des blocs d'équations centrés avec un double dollar \`$$\` :

$$\\mathcal{F}\\{f(t)\\}(\\omega) = \\int_{-\\infty}^{+\\infty} f(t)\\, e^{-i\\omega t}\\, \\mathrm{d}t$$

Utilisez le bouton **Formule** dans la barre d'outils pour ouvrir l'assistant d'équations avec aperçu en direct.

## 3. Glisser-déposer d'images et de fichiers \`.md\`

- **Images (\`.png\`, \`.jpg\`, \`.webp\`, \`.svg\`)** : Faites glisser une image depuis l'Explorateur Windows directement dans la zone d'édition (ou collez-la avec \`Ctrl + V\`). Vous pouvez ajuster sa largeur facilement avec la syntaxe \`![Légende|75%](asset://id)\` ou en cliquant sur l'image dans l'aperçu.
- **Documents Markdown (\`.md\`)** : Déposez un ou plusieurs fichiers \`.md\` n'importe où sur la fenêtre pour les ouvrir instantanément dans de nouveaux onglets.
`,
  },
  {
    id: 'doc-api-notes',
    filename: 'Protocole Cryptographique.md',
    projectId: 'proj-arch',
    pinnedInSidebar: false,
    updatedAt: '07 oct. · 16:30',
    content: `# Échange de clés Diffie-Hellman sur courbe elliptique (ECDH)

Notes de conception pour le chiffrement de bout en bout des carnets de notes partagés.

## 1. Paramètres du groupe cyclique

Sur la courbe $\\text{Curve25519}$ définie sur le corps premier $\\mathbb{F}_p$ avec $p = 2^{255} - 19$, l'équation de Montgomery s'écrit :

$$B y^2 = x^3 + A x^2 + x \\pmod p \\quad \\text{avec} \\quad A = 486662$$

## 2. Matrice des primitives retenues

| Usage cryptographique | Algorithme | Taille de clé | Sécurité post-quantique |
| :--- | :--- | :---: | :---: |
| Échange de clé éphémère | X25519 + ML-KEM-768 | 256 bits / 1184 octets | Hybride Oui |
| Chiffrement authentifié | ChaCha20-Poly1305 | 256 bits | Robuste (Grover 128 bits) |
| Dérivation de clé | HKDF-SHA256 | 256 bits | Robuste |
`,
  },
];
