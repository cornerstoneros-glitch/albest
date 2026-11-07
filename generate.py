"""
generate.py — Génère les pages de catégories pour Albest Communication
Injecte les produits dans la div #products-grid de category.html
"""

import os
import re

# === CATALOGUE DES PRODUITS PAR CATÉGORIE ===
# Chaque produit : (url, image, titre, description, tags)
PRODUCTS = {
    "sacs-et-bagagerie": [
        (
            "https://eskouade.fr/produit/879-vinga-sac-a-dos-baltimore",
            "https://static.xdconnects.com/ProductImages/Large/500118__S_0__d2f47c6c0c3e4244963b9071428541f5.jpg",
            "VINGA Sac à dos Baltimore",
            "Sac à dos professionnel en rPET recyclé, résistant et élégant.",
            ["Recyclé", "Premium"]
        ),
        (
            "https://eskouade.fr/produit/880-vinga-sac-weekend-baltimore",
            "https://static.xdconnects.com/ProductImages/Large/500218__S_0__a2053e20835a49e088c3050296d16c6a.jpg",
            "VINGA Sac weekend Baltimore",
            "Grand sac de voyage en rPET recyclé, idéal pour les déplacements professionnels.",
            ["Recyclé"]
        ),
        (
            "https://eskouade.fr/produit/894-vinga-sacoche-de-velo-baltimore",
            "https://static.xdconnects.com/ProductImages/Large/501818__S_0__f219bdd6000749ecba625d989b511727.jpg",
            "VINGA Sacoche de vélo Baltimore",
            "Sacoche vélo étanche et résistante, personnalisable à votre logo.",
            ["Recyclé", "Eco"]
        ),
        (
            "https://eskouade.fr/produit/1716-sac-a-dos-antivol-bobby-hero-regular",
            "https://static.xdconnects.com/ProductImages/Large/P705.291__S_0__abb2ef7862b04893a8bc5f7ff450e1af.jpg",
            "Sac à dos antivol Bobby Hero Regular",
            "Sac à dos antivol sécurisé, port USB intégré. Idéal nomades digitaux.",
            ["Antivol", "Premium"]
        ),
        (
            "https://eskouade.fr/produit/1879-sac-banane-en-bandouliere-en-rpet-aware-crescent",
            "https://static.xdconnects.com/ProductImages/Large/P763.2001__S_0__b9ac590257d843b49e60a07c7fccc9bf.jpg",
            "Sac banane rPET AWARE™ Crescent",
            "Sac banane tendance en polyester recyclé certifié AWARE™.",
            ["Recyclé", "Eco"]
        ),
        (
            "https://eskouade.fr/produit/2256-vinga-etiquette-a-bagages-en-polyester-rcs-baltimore",
            "https://static.xdconnects.com/ProductImages/Large/V8200201__S_0__7c594359bed74e6cb57ed6b039a69cdf.jpg",
            "VINGA Étiquette à bagages RCS Baltimore",
            "Étiquette à bagages personnalisable en polyester RCS recyclé.",
            ["Recyclé"]
        ),
        (
            "https://eskouade.fr/produit/2812-sac-shopping-coton",
            "https://admin.imbretex.fr/media-produit/73780/10/2/198577/16981167/WM101_studio.jpg",
            "Sac shopping coton",
            "Tote bag coton robuste et naturel, personnalisable avec votre logo.",
            ["Bio", "Cote Ivoire"]
        ),
        (
            "https://eskouade.fr/produit/7012-sac-banane",
            "https://admin.imbretex.fr/media-produit/180610/10/2/4063776/16980849/BG875_studio.png",
            "Sac banane",
            "Sac banane classique et pratique, plusieurs coloris disponibles.",
            []
        ),
        (
            "https://eskouade.fr/produit/7548-sac-shopping-fabrique-en-cote-divoire",
            "https://s7g3.scene7.com/is/image/soloinvest/n03643A?scl=2",
            "Sac shopping fabriqué en France",
            "Sac shopping premium conçu et produit en Cote d'Ivoire.",
            ["Cote Ivoire", "Premium"]
        ),
    ],

    "t-shirts": [
        (
            "https://eskouade.fr/produit/t-shirt-col-rond",
            "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=600&auto=format&fit=crop",
            "T-shirt col rond 190g",
            "T-shirt classique en coton peigné, disponible en 20 coloris.",
            ["Coton"]
        ),
        (
            "https://eskouade.fr/produit/t-shirt-bio",
            "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?q=80&w=600&auto=format&fit=crop",
            "T-shirt bio GOTS",
            "T-shirt 100% coton biologique certifié GOTS, toucher premium.",
            ["Bio", "GOTS"]
        ),
        (
            "https://eskouade.fr/produit/t-shirt-oversize",
            "https://images.unsplash.com/photo-1562157873-818bc0726f68?q=80&w=600&auto=format&fit=crop",
            "T-shirt oversize",
            "Coupe oversize tendance, coton lourd 220g, idéal pour la broderie.",
            ["Coton", "Premium"]
        ),
        (
            "https://eskouade.fr/produit/t-shirt-femme",
            "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?q=80&w=600&auto=format&fit=crop",
            "T-shirt femme coupe ajustée",
            "Coupe féminine ajustée, coton doux 160g. Personnalisable.",
            ["Femme"]
        ),
    ],

    "polos": [
        (
            "https://eskouade.fr/produit/polo-pique-coton",
            "https://images.unsplash.com/photo-1626497764746-6dc36546b388?q=80&w=600&auto=format&fit=crop",
            "Polo piqué coton 220g",
            "Polo classique en coton piqué, coupe droite professionnelle.",
            ["Coton", "Pro"]
        ),
        (
            "https://eskouade.fr/produit/polo-bio",
            "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?q=80&w=600&auto=format&fit=crop",
            "Polo bio GOTS",
            "Polo 100% coton biologique, certifié GOTS. Broderie incluse.",
            ["Bio", "GOTS"]
        ),
    ],

    "sweats-et-pulls": [
        (
            "https://eskouade.fr/produit/sweat-capuche",
            "https://images.unsplash.com/photo-1556821840-3a63f15732ce?q=80&w=600&auto=format&fit=crop",
            "Sweat à capuche 280g",
            "Sweat capuche molleton épais, broderie ou impression DTG.",
            ["Coton"]
        ),
        (
            "https://eskouade.fr/produit/sweat-col-rond-bio",
            "https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=600&auto=format&fit=crop",
            "Sweat col rond bio",
            "Sweat sans capuche en coton biologique recyclé.",
            ["Bio", "Recyclé"]
        ),
    ],

    "vestes-et-coupe-vent": [
        (
            "https://eskouade.fr/produit/veste-softshell",
            "https://images.unsplash.com/photo-1544966503-7cc5ac6d1d4b?q=80&w=600&auto=format&fit=crop",
            "Veste softshell 3 couches",
            "Veste softshell imperméable et respirante. Coupe sport.",
            ["Technique", "Pro"]
        ),
        (
            "https://eskouade.fr/produit/coupe-vent-recycle",
            "https://images.unsplash.com/photo-1491553895911-0055eca6402d?q=80&w=600&auto=format&fit=crop",
            "Coupe-vent recyclé",
            "Coupe-vent léger en polyester recyclé certifié GRS.",
            ["Recyclé", "Eco"]
        ),
    ],

    "mugs-et-bouteilles": [
        (
            "https://eskouade.fr/produit/mug-ceramique",
            "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?q=80&w=600&auto=format&fit=crop",
            "Mug céramique 330ml",
            "Mug céramique blanc à personnaliser par impression ou sérigraphie.",
            []
        ),
        (
            "https://eskouade.fr/produit/bouteille-inox-500ml",
            "https://images.unsplash.com/photo-1571607388263-1044f9ea01dd?q=80&w=600&auto=format&fit=crop",
            "Bouteille inox 500ml",
            "Gourde inox double paroi, garde chaud 12h et froid 24h.",
            ["Eco", "Premium"]
        ),
    ],

    "casquettes-et-bonnets": [
        (
            "https://eskouade.fr/produit/casquette-5-panneaux",
            "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?q=80&w=600&auto=format&fit=crop",
            "Casquette 5 panneaux",
            "Casquette réglable, broderie ou impression disponible.",
            ["Pro"]
        ),
        (
            "https://eskouade.fr/produit/bonnet-acrylique",
            "https://images.unsplash.com/photo-1509305717900-84f40e786d82?q=80&w=600&auto=format&fit=crop",
            "Bonnet acrylique brodé",
            "Bonnet chaud en acrylique, broderie haute définition.",
            []
        ),
    ],
}

# Catégories ayant les mêmes produits (alias)
ALIASES = {
    "t-shirts-bio": "t-shirts",
    "polos-bio": "polos",
    "sweats-a-capuche-bio": "sweats-et-pulls",
    "vestes-et-polaires": "vestes-et-coupe-vent",
    "doudounes": "vestes-et-coupe-vent",
    "accessoires-et-bagagerie": "sacs-et-bagagerie",
    "totebags": "sacs-et-bagagerie",
    "carnets-et-stylos": "mugs-et-bouteilles",
    "high-tech": "mugs-et-bouteilles",
}


def make_product_card(url, img, title, desc, tags):
    """Génère le HTML d'une carte produit"""
    tags_html = ''.join(f'<span class="product-tag">{t}</span>' for t in tags) if tags else ''
    return f'''
        <a href="{url}" target="_blank" class="product-card">
            <div class="product-img-wrap">
                <img src="{img}" alt="{title}" class="product-img" loading="lazy">
                <span class="product-cta-hover">Voir le produit →</span>
            </div>
            <div class="product-info">
                <h3 class="product-title">{title}</h3>
                <p class="product-desc">{desc}</p>
                <div class="product-footer">
                    <div class="product-tags">{tags_html}</div>
                    <span class="product-arrow">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M7 7h10v10"/>
                        </svg>
                    </span>
                </div>
            </div>
        </a>'''


def generate_category_page(slug):
    """Génère la page HTML d'une catégorie en injectant les produits"""
    with open('category.html', 'r', encoding='utf-8') as f:
        template = f.read()

    # Résoudre l'alias
    real_slug = ALIASES.get(slug, slug)
    products = PRODUCTS.get(real_slug, [])

    # Générer le HTML des produits
    cards_html = '\n'.join(make_product_card(*p) for p in products)

    # Injecter dans la div #products-grid
    injected = template.replace(
        '<div class="products-grid" id="products-grid">\n            <!-- Produits injectés par JS / generate.py -->',
        f'<div class="products-grid" id="products-grid">\n{cards_html}'
    )

    return injected


def main():
    # Créer le dossier generated/ si besoin
    os.makedirs('generated', exist_ok=True)

    all_slugs = list(PRODUCTS.keys()) + list(ALIASES.keys())

    for slug in all_slugs:
        html = generate_category_page(slug)
        out_path = os.path.join('generated', f'{slug}.html')
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"  OK generated/{slug}.html")

    print(f"\nDone: {len(all_slugs)} pages generees dans /generated/")


if __name__ == '__main__':
    main()

