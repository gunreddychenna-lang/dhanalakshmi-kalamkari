// ⚙️ EXACT PRICE & MRP CONFIGURATION
let currentSortStrategy = 'highest_price_first'; // 'highest_price_first', 'lowest_price_first'
const FEATURED_FABRIC_FIRST = 'kanchipuram';
const TARGET_FEATURED_PRICE = 26500;

// 👉 SET YOUR DISCOUNT PERCENTAGE HERE (e.g., 10 for 10% OFF, 15 for 15% OFF, 0 for no discount)
const GLOBAL_DISCOUNT_PERCENTAGE = 10; 
const USD_EXCHANGE_RATE = 86.5; // Approx USD per INR

const CATALOG_API_URL = 'https://script.google.com/macros/s/AKfycbwxh2A4nVND1Bdv7FJBRRisONf3dC87cFtEynYjvwE03Agywoi4WtLk4ntlru3L4yKIXQ/exec';
const ANALYTICS_API_URL = 'https://script.google.com/macros/s/AKfycbyN2Kzp3kxYP0uQjf6RU4yZ9KtL_WmV2gn3TVdj3a-e_EIEN5nWDvyrNOOiPfzBGAvc/exec'; 

// Unified primary sales phone number across website & buttons
const CONTACT_PHONE_NUMBER = '918688025096'; // +91 8688025096

const CACHE_KEY = 'kalamkari_products_cache_v11_sales_boost';
const CACHE_TIME_KEY = 'kalamkari_cache_timestamp_v11_sales_boost';
const CACHE_EXPIRY_MS = 3 * 60 * 1000; // 3 minutes

const DEFAULT_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960"%3E%3Crect width="720" height="960" fill="%23F8EEDC"/%3E%3Ctext x="50%25" y="48%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="%234A0202"%3EImage+Not+Available%3C/text%3E%3C/svg%3E';

const DEPARTMENTS = [
    { key: 'saree', label: 'Kalamkari Sarees', singular: 'Kalamkari Saree' },
    { key: 'dupatta', label: 'Kalamkari Dupattas', singular: 'Kalamkari Dupatta' }
];

let allProducts = [];
let filteredProducts = [];
let wishlist = JSON.parse(localStorage.getItem('kalamkariWishlist')) || [];
let recentlyViewed = JSON.parse(localStorage.getItem('kalamkariRecentlyViewed')) || [];
let currentProduct = null;
let currentDepartment = getInitialDepartment();
let isInitialLoad = true; 
let sessionPushedStates = 0;

let activeTimeSpentMs = 0;
let lastActiveStartTime = Date.now();
let isTabVisible = !document.hidden;

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (isTabVisible) {
            activeTimeSpentMs += (Date.now() - lastActiveStartTime);
            isTabVisible = false;
        }
    } else {
        if (!isTabVisible) {
            lastActiveStartTime = Date.now();
            isTabVisible = true;
        }
    }
});

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3200);
}

function renderSkeletonCards(container = elements.productGrid, count = 6) {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-card';
        skeleton.innerHTML = `
            <div class="skeleton-box skeleton-image"></div>
            <div class="skeleton-box skeleton-title"></div>
            <div class="skeleton-box skeleton-description"></div>
            <div class="skeleton-box skeleton-price"></div>
            <div class="skeleton-btn-row">
                <div class="skeleton-box skeleton-btn"></div>
                <div class="skeleton-box skeleton-btn"></div>
            </div>
        `;
        container.appendChild(skeleton);
    }
}

// EXTRACT GOOGLE DRIVE FILE ID
function getGoogleDriveId(product) {
    if (!product) return null;
    
    if (product.imageId && typeof product.imageId === 'string') {
        const cleanedId = product.imageId.trim();
        if (/^[a-zA-Z0-9_-]{25,50}$/.test(cleanedId)) return cleanedId;
    }
    
    const rawUrl = (product.imageLink || product.thumbnail || product.rawImageLink || '').trim();
    if (!rawUrl) return null;

    if (/^[a-zA-Z0-9_-]{25,50}$/.test(rawUrl)) {
        return rawUrl;
    }

    const match = rawUrl.match(/(?:id=|file\/d\/|\/d\/|document\/d\/)([a-zA-Z0-9_-]{25,50})/);
    if (match && match[1]) {
        return match[1];
    }
    
    return null;
}

function getProductImageUrl(product, width = 450) {
    if (!product) return DEFAULT_IMAGE;
    
    const fileId = getGoogleDriveId(product);
    if (fileId) {
        return `https://lh3.googleusercontent.com/d/${fileId}=w${width}`;
    }
    
    const rawUrl = (product.imageLink || product.thumbnail || product.rawImageLink || '').trim();
    if (!rawUrl) return DEFAULT_IMAGE;
    
    return rawUrl;
}

function setupImageFallback(imgElement, product, width = 450) {
    const fileId = getGoogleDriveId(product);
    if (!fileId) return;

    imgElement.onerror = () => {
        if (!imgElement.dataset.fallbackAttempted) {
            imgElement.dataset.fallbackAttempted = "1";
            imgElement.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
        } else if (imgElement.dataset.fallbackAttempted === "1") {
            imgElement.dataset.fallbackAttempted = "2";
            imgElement.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
        } else {
            imgElement.dataset.fallbackAttempted = "failed";
            imgElement.src = DEFAULT_IMAGE;
        }
    };
}

function updateGoogleImageSchemaAndMeta(product) {
    if (!product) return;
    const pageTitle = `${product.title} (Code: ${product.code}) — Srikalahasti Pen Kalamkari Saree | Dhanalakshmi Kalamkari`;
    const pageDesc = `Buy authentic hand-painted ${product.fabric} Kalamkari artwork (${product.title}) with natural organic mineral dyes. Code: ${product.code}. Offer Price: ₹${new Intl.NumberFormat('en-IN').format(product.price)}. Direct from Dhanalakshmi Kalamkari master artisans in Srikalahasti.`;
    const imageUrl = getProductImageUrl(product, 1200);
    const productUrl = `https://www.dhanalakshmi-kalamkari.com/#dhanalakshmi-kalamkari-srikalahasthi-pen-kalamkari-${product.code}`;

    document.title = pageTitle;
    
    let metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', pageDesc);

    const ogTitle = document.getElementById('og-title');
    if (ogTitle) ogTitle.setAttribute('content', pageTitle);
    const ogDesc = document.getElementById('og-desc');
    if (ogDesc) ogDesc.setAttribute('content', pageDesc);
    const ogImage = document.getElementById('og-image');
    if (ogImage) ogImage.setAttribute('content', imageUrl);
    const ogUrl = document.getElementById('og-url');
    if (ogUrl) ogUrl.setAttribute('content', productUrl);
}

function sortProductsByPrice(products, strategy = currentSortStrategy) {
    const strat = String(strategy || '').toUpperCase();

    return [...products].sort((a, b) => {
        const priceA = Number(a.price) || Number(a.mrp) || 0;
        const priceB = Number(b.price) || Number(b.mrp) || 0;

        if (strat === 'LOWEST_PRICE_FIRST' || strat === 'PRICE_LOW_TO_HIGH') {
            return priceA - priceB;
        } else {
            // Defaults to Highest Price First
            return priceB - priceA;
        }
    });
}

function getInitialDepartment() {
    const params = new URLSearchParams(window.location.search);
    return normalizeDepartment(params.get('department')) || 'saree';
}

function normalizeDepartment(value) {
    const normalized = String(value || '').toLowerCase().replace(/[^a-z]/g, '');
    if (normalized.includes('dupatta') || normalized.includes('duppata') || normalized.includes('duppatta')) return 'dupatta';
    if (normalized.includes('saree') || normalized.includes('sari')) return 'saree';
    return '';
}

function getDepartmentConfig(departmentKey = currentDepartment) {
    return DEPARTMENTS.find(department => department.key === departmentKey) || DEPARTMENTS[0];
}

function getDepartmentProducts(departmentKey = currentDepartment) {
    return allProducts.filter(product => product.departmentKey === departmentKey);
}

function inferDepartmentFromText(...values) {
    const combined = values.filter(Boolean).map(value => String(value)).join(' ');
    return normalizeDepartment(combined);
}

function navigateToState(department, fabric, hash = '', push = true) {
    const url = new URL(window.location.href);
    if (department) url.searchParams.set('department', department);
    else url.searchParams.delete('department');
    
    if (fabric && fabric !== 'all') url.searchParams.set('fabric', fabric);
    else url.searchParams.delete('fabric');
    
    url.hash = hash;
    if (push) window.history.pushState({ department, fabric, hash }, '', url);
    else window.history.replaceState({ department, fabric, hash }, '', url);
}

function updateDepartmentUI() {
    const activeDepartment = getDepartmentConfig();
    document.querySelectorAll('.collection-card, .department-btn').forEach(element => {
        if (element.id === 'wishlist-trigger') return;
        const departmentKey = normalizeDepartment(element.dataset.department);
        element.classList.toggle('active', departmentKey === currentDepartment);
    });

    if (elements.searchInput) {
        elements.searchInput.placeholder = `Search ${activeDepartment.label.toLowerCase()} by code (e.g. KS01), fabric or design...`;
    }
}

function setDepartment(department, { pushState = true } = {}) {
    currentDepartment = normalizeDepartment(department) || 'saree';
    if (elements.searchInput) elements.searchInput.value = '';
    updateDepartmentUI();
    renderFilterButtons();
    if (pushState) navigateToState(currentDepartment, 'all', '', true);
    filterAndSearchProducts();
}

const views = {
    catalogue: document.getElementById('catalogue-view'),
    details: document.getElementById('product-details-view'),
    wishlist: document.getElementById('wishlist-view')
};

const elements = {
    productGrid: document.getElementById('product-grid'),
    wishlistGrid: document.getElementById('wishlist-grid'),
    spinner: document.getElementById('loading-spinner'),
    searchInput: document.getElementById('search-input'),
    sortSelect: document.getElementById('sort-select'),
    filtersContainer: document.getElementById('category-filters'),
    wishlistCount: document.getElementById('wishlist-count'),
    viewWishlistBtn: document.getElementById('wishlist-trigger'),
    backToCatalogueBtn: document.getElementById('back-to-catalogue'),
    backFromWishlistBtn: document.getElementById('back-from-wishlist'),
    emptyWishlistMsg: document.getElementById('wishlist-empty'),
    
    detailCode: document.getElementById('detail-code'),
    detailImage: document.getElementById('detail-image'),
    detailImageSection: document.querySelector('.product-image-section'),
    overlay: document.getElementById('image-overlay'),
    overlayImage: document.getElementById('overlay-image'),
    overlayClose: document.getElementById('overlay-close'),
    detailTitle: document.getElementById('detail-title'),
    detailDescription: document.getElementById('detail-description'),
    detailPrice: document.getElementById('detail-price'),
    detailMrp: document.getElementById('detail-mrp'),
    detailUsdPrice: document.getElementById('detail-usd-price'),
    
    addToWishlistBtn: document.getElementById('wishlist-btn'),
    wishlistBtnText: document.getElementById('wishlist-btn-text'),
    wishlistBtnIcon: document.getElementById('wishlist-btn-icon'),
    videoCallBtn: document.getElementById('video-call-btn'),
    detailBuyBtn: document.getElementById('detail-buy-btn'),
    mobileStickyVideoBtn: document.getElementById('mobile-sticky-video-btn'),
    mobileStickyBuyBtn: document.getElementById('mobile-sticky-buy-btn'),
    mobileStickyBar: document.getElementById('mobile-sticky-buy-bar')
};

function scrollToDepartment(smooth = true) {
    if (isInitialLoad) return;
    const target = document.querySelector('.sticky-nav-container') || document.querySelector('.department-bar-container');
    if (target) {
        window.scrollTo({ top: target.offsetTop, behavior: smooth ? 'smooth' : 'auto' });
    }
}

function goBack() {
    if (sessionPushedStates > 0) {
        sessionPushedStates--;
        window.history.back();
    } else {
        const params = new URLSearchParams(window.location.search);
        const initialDept = normalizeDepartment(params.get('department')) || currentDepartment;
        const initialFabric = params.get('fabric') || 'all';
        navigateToState(initialDept, initialFabric, '', false);
        handlePopState();
    }
}

async function init() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    updateWishlistCount();
    setupEventListeners();

    await fetchProducts();

    const params = new URLSearchParams(window.location.search);
    const initialDept = normalizeDepartment(params.get('department')) || currentDepartment;
    const initialFabric = params.get('fabric') || 'all';
    const hash = window.location.hash;

    navigateToState(initialDept, initialFabric, hash, false);
    handlePopState(); 
    isInitialLoad = false;
}

function generateCleanKalamkariTitle(customTitle, fabric, departmentKey, code) {
    let baseFabric = (fabric || 'Silk').trim();
    
    baseFabric = baseFabric
        .replace(/\s+(sarees|saree|saris|sari|dupattas|dupatta)\s*$/i, '')
        .replace(/^pure\s+/i, '')
        .trim();
        
    if (baseFabric.toLowerCase().includes('silk')) {
        baseFabric = baseFabric.replace(/\s+silk\s*$/i, '').trim();
    }
    
    const deptSingular = departmentKey === 'dupatta' ? 'Dupatta' : 'Saree';
    const fabricName = baseFabric ? baseFabric : 'Silk';
    
    return `Pure ${fabricName} Silk Srikalahasthi Pen Kalamkari ${deptSingular}`;
}

// ⚡ FETCH PRODUCTS
async function fetchProducts() {
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
    const isCacheFresh = cachedData && cachedTime && (Date.now() - Number(cachedTime) < CACHE_EXPIRY_MS);

    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            if (Array.isArray(parsed) && parsed.length > 0) {
                allProducts = parsed;
                allProducts = sortProductsByPrice(allProducts, currentSortStrategy);
                if (!getDepartmentProducts(currentDepartment).length && allProducts.length) {
                    currentDepartment = allProducts[0].departmentKey || 'saree';
                }
                filteredProducts = sortProductsByPrice(getDepartmentProducts(), currentSortStrategy);

                updateDepartmentUI();
                renderFilterButtons();
                filterAndSearchProducts();

                if (isCacheFresh) {
                    return;
                }
            }
        } catch (e) {
            localStorage.removeItem(CACHE_KEY);
        }
    }

    renderSkeletonCards(elements.productGrid, 6);
    await fetchProductsFromAPI();
}

async function fetchProductsFromAPI() {
    try {
        const response = await fetch(CATALOG_API_URL);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const rawData = await response.json();
        const data = Array.isArray(rawData) ? rawData : (rawData.value || rawData.data || rawData.records || []);
        
        const getFieldValue = (item, keys) => {
            const normalize = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const normalizedEntries = Object.entries(item).map(([itemKey, value]) => [normalize(itemKey), value]);

            for (const key of keys) {
                const normalizedKey = normalize(key);
                let value = item[key];

                if (value === undefined || value === null) {
                    const matchedEntry = normalizedEntries.find(([itemKey]) => itemKey === normalizedKey);
                    if (matchedEntry) value = matchedEntry[1];
                }

                if (value !== undefined && value !== null && String(value).trim() !== '') {
                    return String(value).trim();
                }
            }
            return '';
        };

        const freshProducts = data.map(item => {
            function parsePrice(val) {
                if (!val) return 0;
                const cleaned = String(val).replace(/[^0-9.]/g, '');
                const n = Number(cleaned);
                return isNaN(n) ? 0 : n;
            }

            const code = String(getFieldValue(item, ['code', 'style code', 'stylecode', 'item code'])).trim();
            const fabric = String(getFieldValue(item, ['fabric']) || 'Pure Silk').trim();
            const category = String(getFieldValue(item, ['category']) || 'Uncategorized').trim();
            const department = String(getFieldValue(item, ['department', 'dept', 'collection'])).trim();
            const departmentKey = normalizeDepartment(department) || inferDepartmentFromText(fabric, category, code) || 'saree';
            
            const imageLink = String(getFieldValue(item, ['image link', 'drive link', 'image', 'url'])).trim();
            const thumbnail = String(getFieldValue(item, ['thumbnail', 'thumbnail link'])).trim() || imageLink;
            const imageId = String(getFieldValue(item, ['image id', 'file id', 'fileid'])).trim();

            let rawQty = item.qty !== undefined && item.qty !== '' ? item.qty : (item.Qty !== undefined && item.Qty !== '' ? item.Qty : '');
            let qty = rawQty !== '' ? Number(rawQty) : 1;
            if (isNaN(qty)) qty = 1;

            let rawSheetPrice = parsePrice(getFieldValue(item, [
                'price', 'selling price', 'sellingprice', 'rate', 'amount', 
                'mrp', 'm.r.p', 'm.r.p.', 'mrpprice', 'original price'
            ]));

            if (!rawSheetPrice) {
                const priceMatch = (category + " " + fabric).match(/\b\d{4,6}\b/);
                if (priceMatch) rawSheetPrice = Number(priceMatch[0]);
            }

            let finalMrp = rawSheetPrice;
            let finalPrice = rawSheetPrice;

            if (GLOBAL_DISCOUNT_PERCENTAGE > 0 && GLOBAL_DISCOUNT_PERCENTAGE < 100 && rawSheetPrice > 0) {
                finalMrp = rawSheetPrice;
                finalPrice = Math.round(rawSheetPrice * (1 - GLOBAL_DISCOUNT_PERCENTAGE / 100));
            }

            const description = String(getFieldValue(item, ['description', 'product description', 'desc'])).trim();
            const rawCustomTitle = String(getFieldValue(item, ['product name', 'saree name', 'dupatta name', 'item name', 'name', 'title'])).trim();
            const title = generateCleanKalamkariTitle(rawCustomTitle, fabric, departmentKey, code);

            return {
                code, 
                title, 
                rawCustomTitle, 
                fabric, 
                category, 
                department, 
                departmentKey,
                price: finalPrice || 0, 
                mrp: finalMrp || 0,
                qty, 
                imageLink, 
                thumbnail, 
                imageId, 
                description
            };
        }).filter(item => item.code);

        if (freshProducts.length > 0) {
            allProducts = freshProducts;
            localStorage.setItem(CACHE_KEY, JSON.stringify(allProducts));
            localStorage.setItem(CACHE_TIME_KEY, String(Date.now()));

            allProducts = sortProductsByPrice(allProducts, currentSortStrategy);
            if (!getDepartmentProducts(currentDepartment).length && allProducts.length) {
                currentDepartment = allProducts[0].departmentKey || 'saree';
            }
            filteredProducts = sortProductsByPrice(getDepartmentProducts(), currentSortStrategy);

            if (elements.spinner) elements.spinner.style.display = 'none';
            updateDepartmentUI();
            renderFilterButtons();
            filterAndSearchProducts();
        }
    } catch (error) {
        console.error("Error loading products:", error);
    }
}

// 🛍️ RENDER PRODUCTS
function renderProducts(products, container, isHorizontal = false) {
    if (!container) return;
    container.innerHTML = '';
    
    if (products.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-royal-gold); padding: 3rem 0; font-family: var(--font-heritage); font-size: 1.1rem;">No authentic hand-painted Kalamkari artworks found matching your criteria.</p>';
        return;
    }
    
    products.forEach((product, index) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.dataset.code = product.code;
        if (product.qty <= 0) card.classList.add('sold-out');

        const keywordSlug = `#dhanalakshmi-kalamkari-srikalahasthi-pen-kalamkari-${product.code}`;

        card.onclick = () => {
            if (isHorizontal) {
                const url = new URL(window.location.href);
                url.hash = keywordSlug;
                window.history.replaceState({ isDepartmentSelection: true }, '', url);
                handlePopState();
            } else {
                sessionPushedStates++;
                window.location.hash = keywordSlug;
            }
        };

        const displayPrice = product.price;
        const displayMrp = product.mrp;
        const hasDiscount = displayMrp > displayPrice && displayPrice > 0;
        const discountPct = hasDiscount ? Math.round(((displayMrp - displayPrice) / displayMrp) * 100) : 0;

        const formattedPrice = new Intl.NumberFormat('en-IN').format(displayPrice);
        const formattedMrp = new Intl.NumberFormat('en-IN').format(displayMrp);
        const usdApprox = displayPrice > 0 ? Math.round(displayPrice / USD_EXCHANGE_RATE) : null;

        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'product-image-wrapper';

        const img = document.createElement('img');
        img.alt = `Dhanalakshmi Kalamkari ${product.title} Code ${product.code} (${product.fabric})`; 
        img.title = `Dhanalakshmi Kalamkari Srikalahasti — ${product.title}`;
        img.decoding = 'async';
        
        if (index < 2 && !isHorizontal) {
            img.loading = 'eager';
            img.setAttribute('fetchpriority', 'high');
        } else {
            img.loading = 'lazy';
        }

        img.onload = () => {
            img.classList.add('loaded');
        };

        const primaryUrl = getProductImageUrl(product, 450);
        img.src = primaryUrl;

        setupImageFallback(img, product, 450);
        imageWrapper.appendChild(img);

        // 1-OF-1 EXCLUSIVITY BADGE
        const exclusivityTag = document.createElement('span');
        exclusivityTag.className = 'card-exclusive-badge';
        exclusivityTag.textContent = '1-of-1 Original';
        imageWrapper.appendChild(exclusivityTag);

        if (hasDiscount && discountPct > 0) {
            const discountBadge = document.createElement('span');
            discountBadge.className = 'card-discount-badge';
            discountBadge.textContent = `${discountPct}% OFF`;
            imageWrapper.appendChild(discountBadge);
        }

        if (product.qty <= 0) {
            const badge = document.createElement('span');
            badge.className = 'sold-out-badge';
            badge.textContent = 'SOLD OUT';
            imageWrapper.appendChild(badge);
        }

        const isInWishlist = wishlist.some(item => item.code === product.code);
        const quickActions = document.createElement('div');
        quickActions.className = 'card-quick-actions';

        const cardWishlistBtn = document.createElement('button');
        cardWishlistBtn.className = `card-action-btn card-wishlist-btn ${isInWishlist ? 'active' : ''}`;
        cardWishlistBtn.innerHTML = isInWishlist ? '♥' : '♡';
        cardWishlistBtn.title = 'Add to Kalamkari Gallery Vault';
        
        cardWishlistBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(product);
        };

        quickActions.appendChild(cardWishlistBtn);
        imageWrapper.appendChild(quickActions);

        const info = document.createElement('div');
        info.className = 'product-info';
        const shortDescription = product.description ? `${String(product.description).trim().slice(0, 95)}${product.description.length > 95 ? '...' : ''}` : '';
        
        info.innerHTML = `
            <div class="product-code-tag">CODE: ${product.code}</div>
            <h3 class="product-title">${product.title}</h3>
            ${shortDescription ? `<p class="product-card-description">${shortDescription}</p>` : ''}
            <div class="product-price-row">
                ${hasDiscount ? `<span class="mrp-price">₹${formattedMrp}</span>` : ''}
                <span class="product-price">${displayPrice > 0 ? '₹' + formattedPrice : 'Price on Request'}</span>
                ${usdApprox ? `<span class="usd-badge">(~$${usdApprox} USD)</span>` : ''}
            </div>
            <div class="card-trust-pill">🌿 100% Hand-Drawn • Natural Dyes</div>
            <div class="card-actions-row">
                <button class="card-video-btn" title="Book Live Video Inspection">📹 VIDEO CALL</button>
                <button class="card-buy-btn" title="Order directly on WhatsApp">💬 BUY NOW</button>
            </div>
        `;

        const cardBuyBtn = info.querySelector('.card-buy-btn');
        const cardVideoBtn = info.querySelector('.card-video-btn');

        if (cardBuyBtn) {
            cardBuyBtn.onclick = (e) => {
                e.stopPropagation();
                buyNow(product);
            };
        }

        if (cardVideoBtn) {
            cardVideoBtn.onclick = (e) => {
                e.stopPropagation();
                bookVideoCall(product);
            };
        }

        card.appendChild(imageWrapper);
        card.appendChild(info);
        container.appendChild(card);
    });
}

function syncAllCardWishlistButtons() {
    document.querySelectorAll('.product-card').forEach(card => {
        const code = card.dataset.code;
        const wishlistBtn = card.querySelector('.card-wishlist-btn');
        if (code && wishlistBtn) {
            const inWishlist = wishlist.some(item => item.code === code);
            wishlistBtn.innerHTML = inWishlist ? '♥' : '♡';
            wishlistBtn.classList.toggle('active', inWishlist);
        }
    });
}

function trackRecentlyViewed(product) {
    if (!product || !product.code) return;
    recentlyViewed = recentlyViewed.filter(p => p.code !== product.code);
    recentlyViewed.unshift(product);
    if (recentlyViewed.length > 8) recentlyViewed = recentlyViewed.slice(0, 8);
    localStorage.setItem('kalamkariRecentlyViewed', JSON.stringify(recentlyViewed));
}

function renderRecentlyViewed(currentProduct) {
    const recentSection = document.getElementById('recently-viewed-section');
    const recentGrid = document.getElementById('recently-viewed-grid');
    if (!recentSection || !recentGrid) return;

    const list = recentlyViewed.filter(p => p.code !== currentProduct.code);
    if (list.length > 0) {
        recentSection.style.display = 'block';
        renderProducts(list, recentGrid, true);
    } else {
        recentSection.style.display = 'none';
    }
}

function renderFabricProducts(currentProduct) {
    const fabricSection = document.getElementById('fabric-products-section');
    const fabricContainer = document.getElementById('fabric-products-grid');
    if (!fabricSection || !fabricContainer) return;

    const list = allProducts.filter(p => 
        p.departmentKey === currentProduct.departmentKey &&
        p.code !== currentProduct.code && 
        p.fabric.toLowerCase().trim() === currentProduct.fabric.toLowerCase().trim()
    );

    if (list.length > 0) {
        fabricSection.style.display = 'block';
        renderProducts(sortProductsByPrice(list, currentSortStrategy).slice(0, 8), fabricContainer, true);
    } else {
        fabricSection.style.display = 'none';
    }
}

function renderSimilarProducts(currentProduct) {
    const similarSection = document.getElementById('similar-products-section');
    const similarContainer = document.getElementById('similar-products-grid');
    if (!similarSection || !similarContainer) return;

    const currentPrice = currentProduct.price || currentProduct.mrp;
    const currentFabric = (currentProduct.fabric || '').toLowerCase().trim();

    let list = allProducts.filter(p => 
        p.departmentKey === currentProduct.departmentKey &&
        p.code !== currentProduct.code &&
        p.fabric.toLowerCase().trim() !== currentFabric &&
        (currentPrice > 0 ? Math.abs((p.price || p.mrp) - currentPrice) / currentPrice <= 0.25 : true)
    );

    list.sort((a, b) => Math.abs((a.price || a.mrp) - currentPrice) - Math.abs((b.price || b.mrp) - currentPrice));

    if (list.length === 0) {
        list = allProducts.filter(p => 
            p.departmentKey === currentProduct.departmentKey &&
            p.code !== currentProduct.code &&
            p.fabric.toLowerCase().trim() !== currentFabric
        ).sort((a, b) => Math.abs((a.price || a.mrp) - currentPrice) - Math.abs((b.price || b.mrp) - currentPrice));
    }

    if (list.length > 0) {
        similarSection.style.display = 'block';
        renderProducts(list.slice(0, 8), similarContainer, true); 
    } else {
        similarSection.style.display = 'none';
    }
}

function renderQuickCategoryPills(currentProd = currentProduct) {
    const section = document.getElementById('category-browse-section');
    const container = document.getElementById('quick-category-pills');
    if (!section || !container) return;

    container.innerHTML = '';
    const targetDept = currentProd ? currentProd.departmentKey : currentDepartment;
    const deptProducts = allProducts.filter(p => p.departmentKey === targetDept);

    const fabricMap = new Map();
    deptProducts.forEach(product => {
        const fabric = (product.fabric || '').trim();
        if (!fabric) return;
        const key = fabric.toLowerCase().replace(/\s+/g, ' ').trim();

        if (!fabricMap.has(key)) {
            const isPluralFabric = fabric.toLowerCase().includes('saree') || fabric.toLowerCase().includes('sari') || fabric.toLowerCase().includes('dupatta');
            
            fabricMap.set(key, {
                key: key,
                fabricName: fabric,
                label: isPluralFabric ? fabric : `${fabric} Kalamkari Sarees`,
                products: []
            });
        }
        fabricMap.get(key).products.push(product);
    });

    if (fabricMap.size === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    const gridsWrapper = document.createElement('div');
    gridsWrapper.className = 'fabric-grids-wrapper';

    fabricMap.forEach((item) => {
        const block = document.createElement('div');
        block.className = 'fabric-collection-block';

        const blockTitle = document.createElement('h3');
        blockTitle.className = 'fabric-block-title';
        blockTitle.innerHTML = `
            <span>${item.label}</span>
            <button class="view-all-fabric-btn">View All (${item.products.length}) &rarr;</button>
        `;
        
        const viewAllBtn = blockTitle.querySelector('.view-all-fabric-btn');
        viewAllBtn.onclick = () => {
            setDepartment(targetDept, { pushState: false });
            navigateToState(targetDept, item.key, '', true);
            syncFabricFilterUI(item.key);
            showView('catalogue');
            scrollToDepartment(true);
        };

        const grid = document.createElement('div');
        grid.className = 'product-grid horizontal-scroll-grid';

        const sortedFabricItems = sortProductsByPrice(item.products, currentSortStrategy);
        renderProducts(sortedFabricItems.slice(0, 8), grid, true);

        block.appendChild(blockTitle);
        block.appendChild(grid);
        gridsWrapper.appendChild(block);
    });

    container.appendChild(gridsWrapper);
}

function showView(viewName) {
    Object.values(views).forEach(v => v?.classList.remove('active'));
    views[viewName]?.classList.add('active');
    
    if (viewName === 'details') {
        document.body.classList.add('details-mode');
        if (elements.mobileStickyBar) elements.mobileStickyBar.style.display = 'flex';
    } else {
        document.body.classList.remove('details-mode');
        if (elements.mobileStickyBar) elements.mobileStickyBar.style.display = 'none';
        if (viewName === 'catalogue') {
            scrollToDepartment(true);
            document.title = "Kalamkari Sarees — Hand-Painted Srikalahasti Pen Kalamkari Silk Sarees | Dhanalakshmi Kalamkari";
        } else {
            window.scrollTo(0, 0);
        }
    }
}

function renderFilterButtons() {
    if (!elements.filtersContainer) return;
    const departmentProducts = getDepartmentProducts();
    const fabricMap = new Map();

    departmentProducts.forEach(product => {
        const fabric = (product.fabric || 'Unknown').trim();
        if (!fabric) return;
        const key = fabric.toLowerCase().replace(/\s+/g, ' ').trim();
        if (!fabricMap.has(key)) {
            fabricMap.set(key, { label: fabric, prices: [] });
        }
        const effectivePrice = product.price || product.mrp;
        if (effectivePrice > 0) fabricMap.get(key).prices.push(effectivePrice);
    });

    elements.filtersContainer.innerHTML = '';
    const activeDepartment = getDepartmentConfig();
    
    const allButton = document.createElement('button');
    allButton.className = 'filter-btn active';
    allButton.dataset.filter = 'all';
    allButton.innerHTML = `<span class="filter-title">ALL ${activeDepartment.label.toUpperCase()}</span>`;
    elements.filtersContainer.appendChild(allButton);

    fabricMap.forEach((entry, key) => {
        const prices = entry.prices.filter(price => price > 0);
        const priceText = prices.length > 0 ? formatPriceRange(prices) : 'Price on Request';

        const button = document.createElement('button');
        button.className = 'filter-btn';
        button.dataset.filter = key;
        button.innerHTML = `
            <span class="filter-title">${entry.label.toUpperCase()} KALAMKARI</span>
            <span class="filter-price">${priceText}</span>
        `;
        elements.filtersContainer.appendChild(button);
    });

    attachFilterHandlers();
}

function attachFilterHandlers() {
    if (!elements.filtersContainer) return;
    const buttons = elements.filtersContainer.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            navigateToState(currentDepartment, btn.dataset.filter, '', true);
            filterAndSearchProducts();
            showView('catalogue');
            scrollToDepartment(true);
        });
    });
}

function syncFabricFilterUI(fabricParam) {
    if (!elements.filtersContainer) return;
    const buttons = elements.filtersContainer.querySelectorAll('.filter-btn');
    if (!buttons.length) return;

    let matched = false;
    const cleanParam = String(fabricParam || 'all').toLowerCase().replace(/\s+/g, ' ').trim();

    buttons.forEach(btn => {
        const btnFilter = String(btn.dataset.filter || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if (btnFilter === cleanParam) {
            btn.classList.add('active');
            matched = true;
        } else {
            btn.classList.remove('active');
        }
    });

    if (!matched) {
        buttons.forEach(btn => {
            const btnFilter = String(btn.dataset.filter || '').toLowerCase().replace(/\s+/g, ' ').trim();
            if (cleanParam !== 'all' && (btnFilter.includes(cleanParam) || cleanParam.includes(btnFilter))) {
                btn.classList.add('active');
                matched = true;
            }
        });
    }

    if (!matched && buttons.length > 0) {
        const allBtn = Array.from(buttons).find(b => b.dataset.filter === 'all');
        if (allBtn) allBtn.classList.add('active');
    }

    filterAndSearchProducts();
}

function formatPriceRange(prices) {
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const opts = { style: 'currency', currency: 'INR', maximumFractionDigits: 0 };
    const formattedMin = new Intl.NumberFormat('en-IN', opts).format(minPrice);
    const formattedMax = new Intl.NumberFormat('en-IN', opts).format(maxPrice);
    return minPrice === maxPrice ? formattedMin : `${formattedMin} to ${formattedMax}`;
}

function showProductDetails(product) {
    currentProduct = product;
    trackRecentlyViewed(product);

    if (product.departmentKey && product.departmentKey !== currentDepartment) {
        currentDepartment = product.departmentKey;
        updateDepartmentUI();
        renderFilterButtons();
    } else if (!elements.filtersContainer || !elements.filtersContainer.children.length) {
        renderFilterButtons();
    }

    const params = new URLSearchParams(window.location.search);
    const fabricParam = params.get('fabric') || (product.fabric ? product.fabric.toLowerCase().replace(/\s+/g, ' ').trim() : 'all');
    syncFabricFilterUI(fabricParam);

    if (elements.detailCode) elements.detailCode.textContent = product.code || '';

    if (elements.detailImage) {
        delete elements.detailImage.dataset.fallbackAttempted;
        const detailPrimaryUrl = getProductImageUrl(product, 1200);
        elements.detailImage.src = detailPrimaryUrl;
        elements.detailImage.alt = `Dhanalakshmi Kalamkari Hand-Painted Srikalahasti Pen Kalamkari ${product.title} Code ${product.code} (${product.fabric} Pure Silk Saree)`;
        elements.detailImage.title = `${product.title} - Click to Zoom Artwork Details`;
        setupImageFallback(elements.detailImage, product, 1200);
    }

    const displayPrice = product.price;
    const displayMrp = product.mrp;
    const hasDiscount = displayMrp > displayPrice && displayPrice > 0;
    const discountPct = hasDiscount ? Math.round(((displayMrp - displayPrice) / displayMrp) * 100) : 0;

    const detailImgBadge = document.getElementById('detail-image-discount-badge');
    if (detailImgBadge) {
        if (hasDiscount && discountPct > 0) {
            detailImgBadge.textContent = `${discountPct}% OFF`;
            detailImgBadge.style.display = 'block';
        } else {
            detailImgBadge.style.display = 'none';
        }
    }
    
    if (elements.detailTitle) elements.detailTitle.textContent = product.title;
    
    if (elements.detailDescription) {
        if (product.description) {
            elements.detailDescription.textContent = product.description;
            elements.detailDescription.style.display = 'block';
        } else {
            elements.detailDescription.style.display = 'none';
        }
    }
    
    if (elements.detailPrice) {
        elements.detailPrice.textContent = new Intl.NumberFormat('en-IN').format(displayPrice);
    }
    
    if (elements.detailUsdPrice) {
        if (displayPrice > 0) {
            const usdVal = Math.round(displayPrice / USD_EXCHANGE_RATE);
            elements.detailUsdPrice.textContent = `(Approx. $${usdVal} USD / Worldwide Delivery)`;
            elements.detailUsdPrice.style.display = 'inline-block';
        } else {
            elements.detailUsdPrice.style.display = 'none';
        }
    }

    if (elements.detailMrp) {
        if (hasDiscount) {
            elements.detailMrp.textContent = `INR ${new Intl.NumberFormat('en-IN').format(displayMrp)}`;
            elements.detailMrp.style.display = 'inline-flex';
        } else {
            elements.detailMrp.style.display = 'none';
        }
    }
    
    updateGoogleImageSchemaAndMeta(product);
    updateWishlistButtonState();
    renderFabricProducts(product);
    renderSimilarProducts(product);
    renderQuickCategoryPills(product);
    renderRecentlyViewed(product);

    showView('details');
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
}

function openFullScreenImage(product) {
    if (!product || !elements.overlay || !elements.overlayImage) return;
    delete elements.overlayImage.dataset.fallbackAttempted;

    const overlayPrimaryUrl = getProductImageUrl(product, 1600);
    elements.overlayImage.src = overlayPrimaryUrl;
    elements.overlayImage.alt = `Dhanalakshmi Kalamkari Srikalahasti Pen Kalamkari ${product.title} Detail`;
    elements.overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    setupImageFallback(elements.overlayImage, product, 1600);
}

function closeOverlay() {
    if (!elements.overlay) return;
    elements.overlay.classList.add('hidden');
    if (elements.overlayImage) {
        elements.overlayImage.src = ''; 
    }
    document.body.style.overflow = '';
}

function toggleWishlist(product = currentProduct) {
    if (!product) return;
    const index = wishlist.findIndex(item => item.code === product.code);
    
    if (index === -1) {
        wishlist.push(product);
        showToast(`Added to Kalamkari Gallery Vault!`);
    } else {
        wishlist.splice(index, 1);
        showToast(`Removed from Kalamkari Gallery Vault.`);
    }
    
    localStorage.setItem('kalamkariWishlist', JSON.stringify(wishlist));
    updateWishlistCount();
    updateWishlistButtonState();
    syncAllCardWishlistButtons();

    if (views.wishlist && views.wishlist.classList.contains('active')) {
        renderWishlist();
    }
}

function renderWishlist() {
    if (!elements.wishlistGrid) return;
    if (wishlist.length === 0) {
        elements.wishlistGrid.style.display = 'none';
        if (elements.emptyWishlistMsg) elements.emptyWishlistMsg.style.display = 'block';
    } else {
        elements.wishlistGrid.style.display = 'grid';
        if (elements.emptyWishlistMsg) elements.emptyWishlistMsg.style.display = 'none';
        renderProducts(sortProductsByPrice(wishlist, currentSortStrategy), elements.wishlistGrid);
    }
}

function filterAndSearchProducts() {
    const searchTerm = elements.searchInput ? elements.searchInput.value.toLowerCase().trim() : '';
    const activeFilterBtn = document.querySelector('.filter-btn.active');
    const filterTerm = activeFilterBtn ? activeFilterBtn.dataset.filter.toLowerCase().trim() : 'all';
    
    let matches = getDepartmentProducts().filter(product => {
        const matchesSearch = !searchTerm ? true : (
            (product.code && product.code.toLowerCase().includes(searchTerm)) ||
            (product.title && product.title.toLowerCase().includes(searchTerm)) ||
            (product.fabric && product.fabric.toLowerCase().includes(searchTerm)) ||
            (product.category && product.category.toLowerCase().includes(searchTerm)) ||
            (product.description && product.description.toLowerCase().includes(searchTerm))
        );
            
        let matchesFilter = true;
        if (filterTerm !== 'all') {
            const prodFabric = (product.fabric || '').toLowerCase().replace(/\s+/g, ' ').trim();
            matchesFilter = prodFabric.includes(filterTerm.replace(/\s+/g, ' ').trim());
        }
        
        return matchesSearch && matchesFilter;
    });

    filteredProducts = sortProductsByPrice(matches, currentSortStrategy);
    renderProducts(filteredProducts, elements.productGrid);
}

function updateWishlistCount() {
    if (elements.wishlistCount) elements.wishlistCount.textContent = wishlist.length;
}

// 💬 HIGH CONVERTING WHATSAPP CLOSING MESSAGE
function buyNow(product = currentProduct) {
    if (!product) return;
    const productUrl = `https://www.dhanalakshmi-kalamkari.com/#dhanalakshmi-kalamkari-srikalahasthi-pen-kalamkari-${product.code}`;
    const effectivePrice = product.price;
    const formattedPrice = new Intl.NumberFormat('en-IN').format(effectivePrice);
    
    const text = `Namaste Dhanalakshmi Kalamkari Workshop 🙏

I want to ORDER this authentic hand-painted Kalamkari Saree:

• Product Code: ${product.code}
• Fabric: ${product.fabric}
• Price: ₹${formattedPrice}
• Artwork Link: ${productUrl}

Please confirm availability and share your UPI / Bank payment details for booking.`;
    
    window.open(`https://wa.me/${CONTACT_PHONE_NUMBER}?text=${encodeURIComponent(text)}`, '_blank');
}

function bookVideoCall(product = currentProduct) {
    if (!product) return;
    const productUrl = `https://www.dhanalakshmi-kalamkari.com/#dhanalakshmi-kalamkari-srikalahasthi-pen-kalamkari-${product.code}`;
    const effectivePrice = product.price;
    const formattedPrice = new Intl.NumberFormat('en-IN').format(effectivePrice);

    const text = `Namaste Dhanalakshmi Kalamkari Workshop 🙏

I would like to BOOK A LIVE VIDEO CALL inspection for this Saree:

• Product Code: ${product.code}
• Fabric: ${product.fabric}
• Price: ₹${formattedPrice}
• Link: ${productUrl}

Please let me know your available time slot to inspect the pallu, borders & artwork over video call.`;
    
    window.open(`https://wa.me/${CONTACT_PHONE_NUMBER}?text=${encodeURIComponent(text)}`, '_blank');
}

function setupEventListeners() {
    if (elements.backToCatalogueBtn) elements.backToCatalogueBtn.addEventListener('click', goBack);
    if (elements.backFromWishlistBtn) elements.backFromWishlistBtn.addEventListener('click', goBack);
    
    if (elements.viewWishlistBtn) {
        elements.viewWishlistBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            sessionPushedStates++;
            window.location.hash = '#wishlist';
            renderWishlist();
            showView('wishlist');
        });
    }
    
    if (elements.addToWishlistBtn) elements.addToWishlistBtn.addEventListener('click', () => toggleWishlist(currentProduct));
    if (elements.videoCallBtn) elements.videoCallBtn.addEventListener('click', () => bookVideoCall(currentProduct));
    if (elements.detailBuyBtn) elements.detailBuyBtn.addEventListener('click', () => buyNow(currentProduct));

    if (elements.mobileStickyVideoBtn) elements.mobileStickyVideoBtn.addEventListener('click', () => bookVideoCall(currentProduct));
    if (elements.mobileStickyBuyBtn) elements.mobileStickyBuyBtn.addEventListener('click', () => buyNow(currentProduct));

    const floatingWishlistBtn = document.getElementById('detail-floating-wishlist-btn');
    if (floatingWishlistBtn) floatingWishlistBtn.addEventListener('click', () => toggleWishlist(currentProduct));

    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', () => {
            if (views.details && views.details.classList.contains('active')) {
                showView('catalogue');
            }
            filterAndSearchProducts();
        });
    }

    if (elements.sortSelect) {
        elements.sortSelect.addEventListener('change', (e) => {
            currentSortStrategy = e.target.value;
            filterAndSearchProducts();
        });
    }

    document.querySelectorAll('.collection-card, .department-btn').forEach(element => {
        element.addEventListener('click', () => {
            if (element.id === 'wishlist-trigger') return;
            setDepartment(element.dataset.department, { pushState: true }); 
            showView('catalogue');
        });
    });
    
    if (elements.detailImage) elements.detailImage.addEventListener('click', () => openFullScreenImage(currentProduct));
    
    if (elements.overlay) {
        elements.overlay.addEventListener('click', event => {
            if (event.target === elements.overlay || event.target === elements.overlayClose) {
                closeOverlay();
            }
        });
    }
    
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeOverlay();
    });

    window.addEventListener('popstate', handlePopState); 
}

function handlePopState() {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    const departmentParam = normalizeDepartment(params.get('department')) || 'saree';
    const fabricParam = params.get('fabric') || 'all';

    currentDepartment = departmentParam;
    updateDepartmentUI();

    if (hash.includes('kalamkari') || hash.startsWith('#product/')) {
        const codeMatch = hash.match(/(?:[A-Za-z0-9_-]+-)?([A-Za-z0-9]+)$/);
        const productCode = codeMatch ? codeMatch[1] : hash.split('/').pop();

        if (allProducts.length === 0) {
            fetchProducts().then(() => {
                const product = allProducts.find(p => p.code === productCode);
                if (product) showProductDetails(product);
                else showView('catalogue'); 
            });
        } else {
            const product = allProducts.find(p => p.code === productCode);
            if (product) showProductDetails(product);
            else showView('catalogue');
        }
    } else if (hash === '#wishlist') {
        renderWishlist();
        showView('wishlist');
    } else {
        renderFilterButtons();
        syncFabricFilterUI(fabricParam);
        showView('catalogue'); 
    }
}

function updateWishlistButtonState() {
    if (!elements.addToWishlistBtn) return;
    
    const prod = currentProduct;
    const isInWishlist = prod ? wishlist.some(item => item.code === prod.code) : false;
    
    if (isInWishlist) {
        elements.addToWishlistBtn.classList.add('active');
        if (elements.wishlistBtnText) elements.wishlistBtnText.textContent = 'In Gallery Vault';
        if (elements.wishlistBtnIcon) elements.wishlistBtnIcon.textContent = '♥';
    } else {
        elements.addToWishlistBtn.classList.remove('active');
        if (elements.wishlistBtnText) elements.wishlistBtnText.textContent = 'Add to Gallery Vault';
        if (elements.wishlistBtnIcon) elements.wishlistBtnIcon.textContent = '❤️';
    }

    const floatingWishlistBtn = document.getElementById('detail-floating-wishlist-btn');
    if (floatingWishlistBtn) {
        floatingWishlistBtn.classList.toggle('active', isInWishlist);
        floatingWishlistBtn.innerHTML = isInWishlist ? '♥' : '♡';
    }
}

document.addEventListener('DOMContentLoaded', init);