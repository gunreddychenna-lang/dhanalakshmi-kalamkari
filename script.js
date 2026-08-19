// =========================================================================
// DHANALAKSHMI KALAMKARI E-COMMERCE ENGINE
// =========================================================================
const SORT_STRATEGY = 'PRICE_HIGH_TO_LOW'; 
const TARGET_MIDDLE_PRICE = 26500;
const FEATURED_FABRIC_FIRST = 'Kanchipuram';
const GLOBAL_DISCOUNT_PERCENTAGE = 10; 

// IMAGEKIT PRODUCTION CDN ENDPOINT
const IMAGEKIT_ENDPOINT = 'https://ik.imagekit.io/phuzcbamt';

// GOOGLE APPS SCRIPT WEB APP JSON API (Primary) & CSV URL (Backup Fallback)
const CATALOG_API_URL = 'https://script.google.com/macros/s/AKfycbzAXbuROmepx2ZwMM3vyj3wOivE5EOVlbsn59KAosQZPn3qoB0mFIgVWu-TeuJht3j1ng/exec';
const PRIMARY_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQVgsqxAaO2_LUzSAxUz_2P_WhdreXSnASw7x30UJFRiCHX4i6WR0yIkhtDuF0wrNTDydZfLPZHRfhx/pub?gid=100332201&single=true&output=csv';
const BACKUP_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQVgsqxAaO2_LUzSAxUz_2P_WhdreXSnASw7x30UJFRiCHX4i6WR0yIkhtDuF0wrNTDydZfLPZHRfhx/pub?output=csv';

const CONTACT_PHONE_NUMBER = '918688025096';
const DEFAULT_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960"%3E%3Crect width="720" height="960" fill="%23F5EFE6"/%3E%3Ctext x="50%25" y="48%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="%23A67D5A"%3EImage+Not+Available%3C/text%3E%3C/svg%3E';

const SHARE_ICON_SVG = '<svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7 0-.24-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>';

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
let currentZoomScale = 1;
let isInitialLoad = true; 
let sessionPushedStates = 0;
let pendingShareData = null;

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
    filtersContainer: document.getElementById('category-filters'),
    wishlistCount: document.getElementById('wishlist-count'),
    viewWishlistBtn: document.getElementById('wishlist-trigger'),
    backToCatalogueBtn: document.getElementById('back-to-catalogue'),
    backFromWishlistBtn: document.getElementById('back-from-wishlist'),
    emptyWishlistMsg: document.getElementById('wishlist-empty'),
    
    detailImage: document.getElementById('detail-image'),
    overlay: document.getElementById('image-overlay'),
    overlayImage: document.getElementById('overlay-image'),
    overlayClose: document.getElementById('overlay-close'),
    detailTitle: document.getElementById('detail-title'),
    detailCode: document.getElementById('detail-code'),
    detailDescription: document.getElementById('detail-description'),
    detailPrice: document.getElementById('detail-price'),
    detailMrp: document.getElementById('detail-mrp'),
    
    addToWishlistBtn: document.getElementById('wishlist-btn'),
    wishlistBtnText: document.getElementById('wishlist-btn-text'),
    wishlistBtnIcon: document.getElementById('wishlist-btn-icon'),
    shareBtn: document.getElementById('share-btn'),
    videoCallBtn: document.getElementById('video-call-btn'),
    detailBuyNowBtn: document.getElementById('detail-buy-now-btn')
};

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// 1. EXTRACT DRIVE FILE ID
function extractDriveFileId(str) {
    if (!str || typeof str !== 'string') return null;
    const trimmed = str.trim();
    if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/(?:id=|file\/d\/|\/d\/|document\/d\/)([a-zA-Z0-9_-]{25,50})/);
    return match && match[1] ? match[1] : null;
}

// 2. ULTRA-FAST IMAGE GENERATOR (ImageKit / Google CDN)
function getProductImageUrl(product, width) {
    const targetWidth = width || 800;
    if (!product) return DEFAULT_IMAGE;
    
    const fileId = extractDriveFileId(product.imageId) || 
                   extractDriveFileId(product['image id']) ||
                   extractDriveFileId(product.imageLink) || 
                   extractDriveFileId(product['image link']) ||
                   extractDriveFileId(product['thumbnail link']) ||
                   extractDriveFileId(product.thumbnail);

    if (fileId) {
        if (IMAGEKIT_ENDPOINT) {
            return IMAGEKIT_ENDPOINT + '/tr:w-' + targetWidth + ',f-auto,q-80/uc?export=view&id=' + fileId;
        }
        return 'https://lh3.googleusercontent.com/d/' + fileId + '=w' + targetWidth;
    }
    
    const rawUrl = (product.imageLink || product['image link'] || product.thumbnail || '').trim();
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        if (IMAGEKIT_ENDPOINT) {
            return IMAGEKIT_ENDPOINT + '/tr:w-' + targetWidth + ',f-auto,q-80/' + rawUrl;
        }
        return rawUrl;
    }

    return DEFAULT_IMAGE;
}

// 3. MULTI-TIER IMAGE FALLBACK
function setupImageFallback(imgElement, product, width) {
    const targetWidth = width || 800;
    const fileId = extractDriveFileId(product.imageId) || 
                   extractDriveFileId(product['image id']) ||
                   extractDriveFileId(product.imageLink) || 
                   extractDriveFileId(product['image link']) ||
                   extractDriveFileId(product['thumbnail link']) ||
                   extractDriveFileId(product.thumbnail);

    if (!fileId) return;

    imgElement.onerror = function() {
        if (!imgElement.dataset.fallbackAttempted) {
            imgElement.dataset.fallbackAttempted = "1";
            imgElement.src = 'https://lh3.googleusercontent.com/d/' + fileId + '=w' + targetWidth;
        } else if (imgElement.dataset.fallbackAttempted === "1") {
            imgElement.dataset.fallbackAttempted = "2";
            imgElement.src = 'https://drive.google.com/uc?export=view&id=' + fileId;
        } else {
            imgElement.src = DEFAULT_IMAGE;
        }
    };
}

function updateGoogleImageSchemaAndMeta(product) {
    if (!product) return;
    const pageTitle = product.title + ' (Code: ' + product.code + ') — Srikalahasti Pen Kalamkari | Dhanalakshmi Kalamkari';
    const pageDesc = 'Buy authentic hand-painted ' + product.fabric + ' Kalamkari artwork (' + product.title + ') with natural organic mineral dyes. Code: ' + product.code + '. Offer Price: ₹' + new Intl.NumberFormat('en-IN').format(product.price) + '. Direct from Dhanalakshmi Kalamkari master artisans in Srikalahasti.';
    const imageUrl = getProductImageUrl(product, 2000);
    const productUrl = 'https://www.dhanalakshmi-kalamkari.com/#kalamkari-' + product.code;

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

    const twitterTitle = document.getElementById('twitter-title');
    if (twitterTitle) twitterTitle.setAttribute('content', pageTitle);
    const twitterDesc = document.getElementById('twitter-desc');
    if (twitterDesc) twitterDesc.setAttribute('content', pageDesc);
    const twitterImage = document.getElementById('twitter-image');
    if (twitterImage) twitterImage.setAttribute('content', imageUrl);

    const schemaScript = document.getElementById('dynamic-product-schema');
    if (schemaScript) {
        const schemaData = {
            "@context": "https://schema.org/",
            "@type": "Product",
            "name": "Dhanalakshmi Kalamkari " + product.title,
            "image": [imageUrl, getProductImageUrl(product, 1000)],
            "description": product.description || pageDesc,
            "sku": product.code,
            "mpn": product.code,
            "brand": { "@type": "Brand", "name": "Dhanalakshmi Kalamkari" },
            "offers": {
                "@type": "Offer",
                "url": productUrl,
                "priceCurrency": "INR",
                "price": product.price,
                "availability": product.qty > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
            }
        };
        schemaScript.textContent = JSON.stringify(schemaData);
    }
}

function sortProductsByPrice(products) {
    return [...products].sort((a, b) => {
        if (FEATURED_FABRIC_FIRST && FEATURED_FABRIC_FIRST.toLowerCase() !== 'none') {
            const featuredKey = FEATURED_FABRIC_FIRST.toLowerCase().trim();
            const aIsFeatured = (a.fabric || '').toLowerCase().includes(featuredKey) || (a.title || '').toLowerCase().includes(featuredKey);
            const bIsFeatured = (b.fabric || '').toLowerCase().includes(featuredKey) || (b.title || '').toLowerCase().includes(featuredKey);

            if (aIsFeatured && !bIsFeatured) return -1;
            if (!aIsFeatured && bIsFeatured) return 1;
        }

        if (SORT_STRATEGY === 'PRICE_LOW_TO_HIGH') {
            return (a.price || 0) - (b.price || 0);
        } else if (SORT_STRATEGY === 'MIDDLE_BUDGET_FIRST') {
            const distA = Math.abs((a.price || 0) - TARGET_MIDDLE_PRICE);
            const distB = Math.abs((b.price || 0) - TARGET_MIDDLE_PRICE);
            return distA - distB;
        } else {
            return (b.price || 0) - (a.price || 0);
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

function getDepartmentConfig(departmentKey) {
    const targetKey = departmentKey || currentDepartment;
    return DEPARTMENTS.find(department => department.key === targetKey) || DEPARTMENTS[0];
}

function getDepartmentProducts(departmentKey) {
    const targetKey = departmentKey || currentDepartment;
    return allProducts.filter(product => product.departmentKey === targetKey);
}

function inferDepartmentFromText(...values) {
    const combined = values.filter(Boolean).map(value => String(value)).join(' ');
    return normalizeDepartment(combined);
}

function navigateToState(department, fabric, hash, push) {
    const shouldPush = push !== undefined ? push : true;
    const targetHash = hash || '';
    const url = new URL(window.location.href);
    
    if (department) url.searchParams.set('department', department);
    else url.searchParams.delete('department');
    
    if (fabric && fabric !== 'all') url.searchParams.set('fabric', fabric);
    else url.searchParams.delete('fabric');
    
    url.hash = targetHash;
    if (shouldPush) window.history.pushState({ department, fabric, hash: targetHash }, '', url);
    else window.history.replaceState({ department, fabric, hash: targetHash }, '', url);
}

function updateDepartmentUI() {
    const activeDepartment = getDepartmentConfig();
    document.querySelectorAll('.department-btn').forEach(element => {
        if (element.id === 'wishlist-trigger') return;
        const departmentKey = normalizeDepartment(element.dataset.department);
        element.classList.toggle('active', departmentKey === currentDepartment);
    });

    if (elements.searchInput) {
        elements.searchInput.placeholder = 'Search ' + activeDepartment.label.toLowerCase() + ' by code, fabric or motif...';
    }
}

function setDepartment(department, options) {
    const pushState = (options && options.pushState !== undefined) ? options.pushState : true;
    currentDepartment = normalizeDepartment(department) || 'saree';
    if (elements.searchInput) elements.searchInput.value = '';
    updateDepartmentUI();
    renderFilterButtons();
    if (pushState) navigateToState(currentDepartment, 'all', '', true);
    filterAndSearchProducts();
}

function scrollToDepartment(smooth) {
    const isSmooth = smooth !== undefined ? smooth : true;
    if (isInitialLoad) return;
    const target = document.querySelector('.sticky-nav-container') || document.querySelector('.department-bar-container');
    if (target) {
        window.scrollTo({ top: target.offsetTop, behavior: isSmooth ? 'smooth' : 'auto' });
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

// FETCH PRODUCTS WITH CSV PARSER & CACHE
async function fetchProducts() {
    try {
        if (elements.spinner) elements.spinner.style.display = 'block';

        const CACHE_KEY = 'dhanalakshmi_catalog_cache';
        const CACHE_TIME_KEY = 'dhanalakshmi_catalog_time';
        const CACHE_TTL = 3 * 60 * 1000;

        const cachedData = sessionStorage.getItem(CACHE_KEY);
        const cachedTime = sessionStorage.getItem(CACHE_TIME_KEY);
        const isCacheValid = cachedData && cachedTime && (Date.now() - Number(cachedTime) < CACHE_TTL);

        let rawData = [];

        if (isCacheValid) {
            try {
                rawData = JSON.parse(cachedData);
            } catch (e) {
                sessionStorage.removeItem(CACHE_KEY);
            }
        }

        if (!rawData || !rawData.length) {
            try {
                const apiRes = await fetch(CATALOG_API_URL, { cache: 'no-cache' });
                if (apiRes.ok) rawData = await apiRes.json();
            } catch (e) {
                console.warn('API load failed, falling back to published CSV...', e);
            }

            if (!rawData || !rawData.length) {
                let csvText = '';
                try {
                    const response = await fetch(PRIMARY_CSV_URL);
                    if (!response.ok) throw new Error('Primary CSV failed');
                    csvText = await response.text();
                } catch (e) {
                    const backupResp = await fetch(BACKUP_CSV_URL);
                    if (!backupResp.ok) throw new Error('Backup CSV failed');
                    csvText = await backupResp.text();
                }

                if (window.Papa && csvText) {
                    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
                    rawData = parsed.data || [];
                }
            }

            if (rawData && rawData.length > 0) {
                sessionStorage.setItem(CACHE_KEY, JSON.stringify(rawData));
                sessionStorage.setItem(CACHE_TIME_KEY, String(Date.now()));
            }
        }

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

        allProducts = rawData.map(item => {
            function parsePrice(val) {
                if (!val) return 0;
                const cleaned = String(val).replace(/[^0-9.\-]/g, '');
                const n = Number(cleaned);
                return isNaN(n) ? 0 : n;
            }

            const code = String(getFieldValue(item, ['code', 'style code', 'stylecode', 'item code', 'barcode', 'sku'])).trim();
            let fabric = String(getFieldValue(item, ['fabric', 'material', 'fabric name']) || 'Pure Silk').trim();
            if (fabric.toLowerCase().includes('http')) fabric = 'Pure Silk';

            const category = String(getFieldValue(item, ['category', 'type']) || 'Uncategorized').trim();
            const department = String(getFieldValue(item, ['department', 'dept', 'collection'])).trim();
            const departmentKey = normalizeDepartment(department) || inferDepartmentFromText(fabric, category, code) || 'saree';
            
            const imageLink = String(getFieldValue(item, ['image link', 'drive link', 'thumbnail link', 'imagelink', 'image', 'photo link', 'image url', 'photo'])).trim();
            const thumbnail = String(getFieldValue(item, ['thumbnail', 'thumbnail link', 'thumb'])).trim() || imageLink;
            const imageId = String(getFieldValue(item, ['image id', 'file id', 'fileid', 'imageid', 'drive id'])).trim();

            let rawQty = getFieldValue(item, ['qty', 'quantity', 'stock', 'available', 'count']);
            let qty = rawQty !== '' ? Number(rawQty) : 1;
            if (isNaN(qty)) qty = 1;

            let sellingPrice = parsePrice(getFieldValue(item, ['price', 'selling price', 'rate', 'amount', 'offer price', 'cost']));
            let mrpFromSheet = parsePrice(getFieldValue(item, ['mrp', 'm.r.p', 'original price', 'mrp price', 'list price']));

            let rawMrp = mrpFromSheet || sellingPrice;
            if (sellingPrice === 0) {
                sellingPrice = 14500;
                rawMrp = 16000;
            } else if (GLOBAL_DISCOUNT_PERCENTAGE > 0 && GLOBAL_DISCOUNT_PERCENTAGE < 100) {
                if (rawMrp <= sellingPrice) rawMrp = sellingPrice;
                sellingPrice = Math.round(rawMrp * (1 - GLOBAL_DISCOUNT_PERCENTAGE / 100));
            }

            const description = String(getFieldValue(item, ['description', 'product description', 'desc', 'details'])).trim();
            const customTitle = String(getFieldValue(item, ['product name', 'saree name', 'dupatta name', 'item name', 'name', 'title'])).trim();

            let baseFabric = fabric.trim()
                .replace(/\s+(sarees|saree|saris|sari|dupattas|dupatta)\s*$/i, '')
                .replace(/^pure\s+/i, '')
                .trim();
            if (baseFabric.toLowerCase().includes('silk')) {
                baseFabric = baseFabric.replace(/\s+silk\s*$/i, '').trim();
            }
            const deptSingular = departmentKey === 'dupatta' ? 'Dupatta' : 'Saree';
            const title = customTitle || ('Pure ' + (baseFabric || 'Silk') + ' Silk Srikalahasthi Pen Kalamkari ' + deptSingular);

            return {
                code, title, fabric, category, department, departmentKey,
                price: sellingPrice, mrp: rawMrp,
                qty, imageLink, thumbnail, imageId, description
            };
        }).filter(item => item.code && (item.imageId || item.imageLink || item.thumbnail));

        allProducts = sortProductsByPrice(allProducts);
        if (!getDepartmentProducts(currentDepartment).length && allProducts.length) {
            currentDepartment = allProducts[0].departmentKey || 'saree';
        }
        filteredProducts = sortProductsByPrice(getDepartmentProducts());

        wishlist = wishlist.map(savedItem => {
            const freshItem = allProducts.find(p => p.code === savedItem.code);
            return freshItem || savedItem;
        });
        localStorage.setItem('kalamkariWishlist', JSON.stringify(wishlist));
        updateWishlistCount();

        if (elements.spinner) elements.spinner.style.display = 'none';
        updateDepartmentUI();
        renderFilterButtons();
        filterAndSearchProducts();
    } catch (error) {
        console.error('Catalogue Load Error:', error);
    }
}

// RENDER PRODUCTS GRID WITH STYLE CODE & ACTIONS
function renderProducts(products, container, isHorizontal) {
    if (!container) return;
    container.innerHTML = '';
    
    if (products.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-imperial-gold); padding: 3rem 0; font-family: var(--font-heritage); font-size: 1.1rem;">No authentic hand-painted Kalamkari artworks found matching your criteria.</p>';
        return;
    }
    
    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.dataset.code = product.code;
        if (product.qty <= 0) card.classList.add('sold-out');

        const keywordSlug = '#kalamkari-' + product.code;

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

        const formattedPrice = new Intl.NumberFormat('en-IN').format(product.price);
        const formattedMrp = new Intl.NumberFormat('en-IN').format(product.mrp);
        const discountPct = product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;

        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'product-image-wrapper';

        const img = document.createElement('img');
        img.alt = 'Dhanalakshmi Kalamkari ' + product.title + ' Code ' + product.code + ' (' + product.fabric + ')';
        img.title = 'Dhanalakshmi Kalamkari Srikalahasti — ' + product.title;
        img.loading = 'lazy';
        img.src = getProductImageUrl(product, 800);
        setupImageFallback(img, product, 800);
        imageWrapper.appendChild(img);

        if (discountPct > 0) {
            const discountBadge = document.createElement('span');
            discountBadge.className = 'card-discount-badge';
            discountBadge.textContent = discountPct + '% OFF';
            imageWrapper.appendChild(discountBadge);
        }

        if (product.code) {
            const codeBadge = document.createElement('span');
            codeBadge.className = 'card-code-badge';
            codeBadge.textContent = product.code;
            imageWrapper.appendChild(codeBadge);
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
        cardWishlistBtn.className = 'card-action-btn card-wishlist-btn ' + (isInWishlist ? 'active' : '');
        cardWishlistBtn.innerHTML = isInWishlist ? '♥' : '♡';
        cardWishlistBtn.title = 'Add to Kalamkari Gallery Vault';
        cardWishlistBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(product);
        };

        const cardShareBtn = document.createElement('button');
        cardShareBtn.className = 'card-action-btn card-share-btn';
        cardShareBtn.innerHTML = SHARE_ICON_SVG;
        cardShareBtn.title = 'Share Saree Artwork';
        cardShareBtn.onclick = (e) => {
            e.stopPropagation();
            shareProduct(product);
        };

        quickActions.appendChild(cardWishlistBtn);
        quickActions.appendChild(cardShareBtn);
        imageWrapper.appendChild(quickActions);

        const info = document.createElement('div');
        info.className = 'product-info';
        const shortDescription = product.description ? (String(product.description).trim().slice(0, 100) + (product.description.length > 100 ? '...' : '')) : '';
        
        info.innerHTML = `
            <div class="product-code-tag">CODE: ${product.code}</div>
            <h3 class="product-title">${product.title}</h3>
            ${shortDescription ? `<p class="product-card-description">${shortDescription}</p>` : ''}
            <div class="product-price-row">
                ${product.mrp > product.price ? `<span class="mrp-price">₹${formattedMrp}</span>` : ''}
                <span class="product-price">₹${formattedPrice}</span>
            </div>
            <div class="card-actions-row">
                <button class="card-video-btn">📹 VIDEO CALL</button>
                <button class="card-buy-btn">🛍️ BUY NOW</button>
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
        renderProducts(list.slice(0, 8), fabricContainer, true);
    } else {
        fabricSection.style.display = 'none';
    }
}

function renderSimilarProducts(currentProduct) {
    const similarSection = document.getElementById('similar-products-section');
    const similarContainer = document.getElementById('similar-products-grid');
    if (!similarSection || !similarContainer) return;

    const currentPrice = currentProduct.price;
    const currentFabric = (currentProduct.fabric || '').toLowerCase().trim();

    let list = allProducts.filter(p => 
        p.departmentKey === currentProduct.departmentKey &&
        p.code !== currentProduct.code &&
        p.fabric.toLowerCase().trim() !== currentFabric &&
        Math.abs(p.price - currentPrice) / currentPrice <= 0.25
    );

    list.sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice));

    if (list.length === 0) {
        list = allProducts.filter(p => 
            p.departmentKey === currentProduct.departmentKey &&
            p.code !== currentProduct.code &&
            p.fabric.toLowerCase().trim() !== currentFabric
        ).sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice));
    }

    if (list.length > 0) {
        similarSection.style.display = 'block';
        renderProducts(list.slice(0, 8), similarContainer, true); 
    } else {
        similarSection.style.display = 'none';
    }
}

function renderQuickCategoryPills(currentProd) {
    const targetProd = currentProd || currentProduct;
    const section = document.getElementById('category-browse-section');
    const container = document.getElementById('quick-category-pills');
    if (!section || !container) return;

    container.innerHTML = '';
    const targetDept = targetProd ? targetProd.departmentKey : currentDepartment;
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
                label: isPluralFabric ? fabric : (fabric + ' Kalamkari Sarees'),
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

        renderProducts(item.products.slice(0, 8), grid, true);

        block.appendChild(blockTitle);
        block.appendChild(grid);
        gridsWrapper.appendChild(block);
    });

    container.appendChild(gridsWrapper);
}

function showView(viewName) {
    Object.values(views).forEach(v => v?.classList.remove('active'));
    views[viewName]?.classList.add('active');
    
    const stickyBar = document.getElementById('mobile-sticky-bar');

    if (viewName === 'details') {
        document.body.classList.add('details-mode');
        if (stickyBar) stickyBar.classList.add('visible');
    } else {
        document.body.classList.remove('details-mode');
        if (stickyBar) stickyBar.classList.remove('visible');

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
        let fabric = (product.fabric || 'Pure Silk').trim();
        if (!fabric || fabric.toLowerCase().includes('http')) return;
        
        let displayLabel = fabric
            .replace(/\s+(sarees|saree|saris|sari|dupattas|dupatta)\s*$/i, '')
            .trim();

        const key = displayLabel.toLowerCase().replace(/\s+/g, ' ').trim();
        if (!fabricMap.has(key)) {
            fabricMap.set(key, { label: displayLabel, prices: [] });
        }
        if (product.price > 0) fabricMap.get(key).prices.push(product.price);
    });

    elements.filtersContainer.innerHTML = '';
    const activeDepartment = getDepartmentConfig();
    
    const allButton = document.createElement('button');
    allButton.className = 'filter-btn active';
    allButton.dataset.filter = 'all';
    allButton.innerHTML = '<span class="filter-title">ALL ' + activeDepartment.label.toUpperCase() + '</span>';
    elements.filtersContainer.appendChild(allButton);

    fabricMap.forEach((entry, key) => {
        const prices = entry.prices.filter(price => price > 0);
        const minPrice = prices.length ? Math.min(...prices) : 0;
        const maxPrice = prices.length ? Math.max(...prices) : 0;
        const priceText = minPrice === maxPrice 
            ? ('₹' + new Intl.NumberFormat('en-IN').format(minPrice))
            : ('₹' + new Intl.NumberFormat('en-IN').format(minPrice) + ' - ₹' + new Intl.NumberFormat('en-IN').format(maxPrice));

        const button = document.createElement('button');
        button.className = 'filter-btn';
        button.dataset.filter = key;
        button.innerHTML = `
            <span class="filter-title">${entry.label.toUpperCase()}</span>
            <span class="filter-price">${priceText}</span>
        `;
        elements.filtersContainer.appendChild(button);
    });

    elements.filtersContainer.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            elements.filtersContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
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

    if (!matched && buttons.length > 0) {
        const allBtn = Array.from(buttons).find(b => b.dataset.filter === 'all');
        if (allBtn) allBtn.classList.add('active');
    }

    filterAndSearchProducts();
}

function showProductDetails(product) {
    currentProduct = product;
    trackRecentlyViewed(product);

    if (product.departmentKey && product.departmentKey !== currentDepartment) {
        currentDepartment = product.departmentKey;
        updateDepartmentUI();
        renderFilterButtons();
    }

    if (elements.detailImage) {
        delete elements.detailImage.dataset.fallbackAttempted;
        elements.detailImage.src = getProductImageUrl(product, 2000);
        elements.detailImage.alt = 'Dhanalakshmi Kalamkari ' + product.title;
        setupImageFallback(elements.detailImage, product, 2000);
    }

    const detailImgBadge = document.getElementById('detail-image-discount-badge');
    if (detailImgBadge) {
        const discountPct = product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
        detailImgBadge.style.display = discountPct > 0 ? 'block' : 'none';
        if (discountPct > 0) detailImgBadge.textContent = discountPct + '% OFF';
    }
    
    if (elements.detailTitle) elements.detailTitle.textContent = product.title;
    if (elements.detailCode) elements.detailCode.textContent = product.code || 'N/A';
    
    if (elements.detailDescription) {
        elements.detailDescription.textContent = product.description || '';
        elements.detailDescription.style.display = product.description ? 'block' : 'none';
    }
    
    if (elements.detailPrice) elements.detailPrice.textContent = new Intl.NumberFormat('en-IN').format(product.price);
    
    if (elements.detailMrp) {
        if (product.mrp && product.mrp > product.price) {
            elements.detailMrp.textContent = 'INR ' + new Intl.NumberFormat('en-IN').format(product.mrp);
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

// 🔍 INTERACTIVE ZOOM MODAL CONTROLLER
function applyImageZoomScale() {
    if (!elements.overlayImage) return;
    elements.overlayImage.style.transform = 'scale(' + currentZoomScale + ')';
}

function openFullScreenImage(product) {
    if (!product || !elements.overlay || !elements.overlayImage) return;
    elements.overlayImage.src = getProductImageUrl(product, 2000);
    currentZoomScale = 1;
    applyImageZoomScale();
    elements.overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeOverlay() {
    if (!elements.overlay) return;
    elements.overlay.classList.add('hidden');
    document.body.style.overflow = '';
    currentZoomScale = 1;
    applyImageZoomScale();
}

function toggleWishlist(product) {
    const targetProduct = product || currentProduct;
    if (!targetProduct) return;
    const index = wishlist.findIndex(item => item.code === targetProduct.code);
    
    if (index === -1) {
        wishlist.push(targetProduct);
        showToast('Added to Gallery Vault!');
    } else {
        wishlist.splice(index, 1);
        showToast('Removed from Gallery Vault.');
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
        renderProducts(wishlist, elements.wishlistGrid);
    }
}

function filterAndSearchProducts() {
    const searchTerm = elements.searchInput ? elements.searchInput.value.toLowerCase().trim() : '';
    const activeFilterBtn = document.querySelector('.filter-btn.active');
    const filterTerm = activeFilterBtn ? activeFilterBtn.dataset.filter.toLowerCase().trim() : 'all';
    
    filteredProducts = getDepartmentProducts().filter(product => {
        const matchesSearch = !searchTerm ? true : (
            (product.code && product.code.toLowerCase().includes(searchTerm)) ||
            (product.fabric && product.fabric.toLowerCase().includes(searchTerm)) ||
            (product.title && product.title.toLowerCase().includes(searchTerm)) ||
            (product.description && product.description.toLowerCase().includes(searchTerm))
        );
            
        let matchesFilter = true;
        if (filterTerm !== 'all') {
            const prodFabric = (product.fabric || '').toLowerCase().replace(/\s+/g, ' ').trim();
            matchesFilter = prodFabric.includes(filterTerm.replace(/\s+/g, ' ').trim());
        }
        
        return matchesSearch && matchesFilter;
    });
    
    renderProducts(filteredProducts, elements.productGrid);
}

function updateWishlistCount() {
    if (elements.wishlistCount) elements.wishlistCount.textContent = wishlist.length;
}

function buyNow(product) {
    const targetProduct = product || currentProduct;
    if (!targetProduct) return;
    const visitorId = localStorage.getItem('crm_visitor_id') || localStorage.getItem('kalamkari_crm_vid') || 'New';
    const productUrl = 'https://www.dhanalakshmi-kalamkari.com/#kalamkari-' + targetProduct.code;
    const text = 'Namaste Dhanalakshmi Kalamkari Workshop,\n\nI want to BUY this hand-painted Kalamkari masterpiece:\n\n• Code: ' + targetProduct.code + '\n• Title: ' + targetProduct.title + '\n• Fabric: ' + targetProduct.fabric + '\n• Offer Price: INR ' + new Intl.NumberFormat('en-IN').format(targetProduct.price) + '\n• Web Link: ' + productUrl + '\n\n• Ref ID: ' + visitorId + '\n\nPlease share payment details and shipping process.';
    
    window.open('https://wa.me/' + CONTACT_PHONE_NUMBER + '?text=' + encodeURIComponent(text), '_blank');
}

function bookVideoCall(product) {
    const targetProduct = product || currentProduct;
    if (!targetProduct) return;
    const visitorId = localStorage.getItem('crm_visitor_id') || localStorage.getItem('kalamkari_crm_vid') || 'New';
    const productUrl = 'https://www.dhanalakshmi-kalamkari.com/#kalamkari-' + targetProduct.code;
    const text = 'Namaste Dhanalakshmi Kalamkari Workshop,\n\nI would like to BOOK A LIVE VIDEO CALL to inspect this hand-painted Kalamkari saree artwork:\n\n• Code: ' + targetProduct.code + '\n• Title: ' + targetProduct.title + '\n• Fabric: ' + targetProduct.fabric + '\n• Offer Price: INR ' + new Intl.NumberFormat('en-IN').format(targetProduct.price) + '\n• Web Link: ' + productUrl + '\n\n• Ref ID: ' + visitorId + '\n\nPlease let me know your available time slots.';
    
    window.open('https://wa.me/' + CONTACT_PHONE_NUMBER + '?text=' + encodeURIComponent(text), '_blank');
}

function shareProduct(product) {
    const targetProduct = product || currentProduct;
    if (!targetProduct) return;
    const shareUrl = 'https://www.dhanalakshmi-kalamkari.com/#kalamkari-' + targetProduct.code;
    const shareText = 'Explore this authentic hand-painted Dhanalakshmi Kalamkari artwork: "' + targetProduct.title + '" (Code: ' + targetProduct.code + ')';
    
    pendingShareData = { title: targetProduct.title, text: shareText, url: shareUrl };

    if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
        navigator.share({ title: targetProduct.title, text: shareText, url: shareUrl }).catch(() => {});
    } else {
        const modal = document.getElementById('share-modal');
        if (modal) modal.classList.remove('hidden');
    }
}

function setupEventListeners() {
    if (elements.backToCatalogueBtn) elements.backToCatalogueBtn.addEventListener('click', goBack);
    if (elements.backFromWishlistBtn) elements.backFromWishlistBtn.addEventListener('click', goBack);
    
    if (elements.viewWishlistBtn) {
        elements.viewWishlistBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sessionPushedStates++;
            window.location.hash = '#wishlist';
            renderWishlist();
            showView('wishlist');
        });
    }
    
    if (elements.addToWishlistBtn) elements.addToWishlistBtn.addEventListener('click', () => toggleWishlist(currentProduct));
    if (elements.shareBtn) elements.shareBtn.addEventListener('click', () => shareProduct(currentProduct));
    if (elements.videoCallBtn) elements.videoCallBtn.addEventListener('click', () => bookVideoCall(currentProduct));
    if (elements.detailBuyNowBtn) elements.detailBuyNowBtn.addEventListener('click', () => buyNow(currentProduct));

    // MOBILE STICKY BOTTOM BAR EVENT HANDLERS
    const mobileBuyBtn = document.getElementById('mobile-sticky-buy-btn');
    const mobileVideoBtn = document.getElementById('mobile-sticky-video-btn');
    const mobileShareBtn = document.getElementById('mobile-sticky-share-btn');

    if (mobileBuyBtn) mobileBuyBtn.addEventListener('click', () => buyNow(currentProduct));
    if (mobileVideoBtn) mobileVideoBtn.addEventListener('click', () => bookVideoCall(currentProduct));
    if (mobileShareBtn) mobileShareBtn.addEventListener('click', () => shareProduct(currentProduct));

    // ZOOM MODAL BUTTON HANDLERS
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');

    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentZoomScale = Math.min(currentZoomScale + 0.35, 3.5);
            applyImageZoomScale();
        });
    }

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentZoomScale = Math.max(currentZoomScale - 0.35, 0.8);
            applyImageZoomScale();
        });
    }

    if (zoomResetBtn) {
        zoomResetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentZoomScale = 1;
            applyImageZoomScale();
        });
    }

    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', () => filterAndSearchProducts());
    }

    const floatingWishlistBtn = document.getElementById('detail-floating-wishlist-btn');
    if (floatingWishlistBtn) floatingWishlistBtn.addEventListener('click', () => toggleWishlist(currentProduct));
    
    const floatingShareBtn = document.getElementById('detail-floating-share-btn');
    if (floatingShareBtn) floatingShareBtn.addEventListener('click', () => shareProduct(currentProduct));

    const shareCloseBtn = document.getElementById('share-modal-close');
    const shareBackdrop = document.getElementById('share-modal-backdrop');
    if (shareCloseBtn) shareCloseBtn.addEventListener('click', () => document.getElementById('share-modal')?.classList.add('hidden'));
    if (shareBackdrop) shareBackdrop.addEventListener('click', () => document.getElementById('share-modal')?.classList.add('hidden'));

    const shareWhatsappBtn = document.getElementById('share-whatsapp-btn');
    if (shareWhatsappBtn) {
        shareWhatsappBtn.addEventListener('click', () => {
            if (!pendingShareData) return;
            window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(pendingShareData.text + '\n' + pendingShareData.url), '_blank');
        });
    }

    const shareCopyBtn = document.getElementById('share-copy-btn');
    if (shareCopyBtn) {
        shareCopyBtn.addEventListener('click', async () => {
            if (!pendingShareData) return;
            await navigator.clipboard.writeText(pendingShareData.url);
            showToast('Masterpiece link copied to clipboard!');
            document.getElementById('share-modal')?.classList.add('hidden');
        });
    }

    document.querySelectorAll('.department-btn').forEach(element => {
        element.addEventListener('click', () => {
            if (element.id === 'wishlist-trigger') return;
            setDepartment(element.dataset.department, { pushState: true }); 
            showView('catalogue');
        });
    });
    
    if (elements.detailImage) elements.detailImage.addEventListener('click', () => openFullScreenImage(currentProduct));
    if (elements.overlay) elements.overlay.addEventListener('click', closeOverlay);

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
        const product = allProducts.find(p => p.code === productCode);
        if (product) showProductDetails(product);
        else showView('catalogue');
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
    const isInWishlist = currentProduct ? wishlist.some(item => item.code === currentProduct.code) : false;
    
    elements.addToWishlistBtn.classList.toggle('active', isInWishlist);
    if (elements.wishlistBtnText) elements.wishlistBtnText.textContent = isInWishlist ? 'In Gallery Vault' : 'Add to Gallery Vault';
    if (elements.wishlistBtnIcon) elements.wishlistBtnIcon.textContent = isInWishlist ? '♥' : '❤️';
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

document.addEventListener('DOMContentLoaded', init);