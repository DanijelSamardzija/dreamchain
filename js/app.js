// ============================================================
//  Dream-Chain AI — Main Application Logic
// ============================================================

// ── Pi SDK Init ───────────────────────────────────────────────
Pi.init({ version: "2.0", sandbox: true });

// ── Constants ────────────────────────────────────────────────
const STORAGE_KEY  = 'dreamchain_dreams';
const USER_KEY     = 'dreamchain_user';
const SORT_KEY     = 'dreamchain_sort';
const SEARCH_KEY   = 'dreamchain_search';

// ── Mock Pi usernames (used during simulated login) ──────────
const MOCK_USERNAMES = [
    'DreamPilot', 'StarWeaver', 'NeonDreamer',
    'CosmicSoul', 'LunarArtist', 'VoidWalker', 'AstralMind'
];

// ── Gradient palette for user-submitted dreams ───────────────
const gradientPalette = [
    'linear-gradient(135deg, #667eea, #764ba2)',
    'linear-gradient(135deg, #f093fb, #f5576c)',
    'linear-gradient(135deg, #4facfe, #00f2fe)',
    'linear-gradient(135deg, #43e97b, #38f9d7)',
    'linear-gradient(135deg, #fa709a, #fee140)',
    'linear-gradient(135deg, #a18cd1, #fbc2eb)',
    'linear-gradient(135deg, #ff9a9e, #fad0c4)',
    'linear-gradient(135deg, #a1c4fd, #c2e9fb)',
];

// ── Default seed dreams (shown when localStorage is empty) ───
const defaultDreams = [
    {
        id: 'seed-1',
        label: 'Deep Space',
        quote: '"Beskrajni svemir"',
        gradient: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)'
    },
    {
        id: 'seed-2',
        label: 'Neon Forest',
        quote: '"Svetleća šuma"',
        gradient: 'linear-gradient(135deg, #0f2027, #1a5c2a, #00ff87 200%)'
    },
    {
        id: 'seed-3',
        label: 'Flying City',
        quote: '"Grad u oblacima"',
        gradient: 'linear-gradient(135deg, #1c3f6e, #4a90d9, #c0e0ff 200%)'
    }
];

// ── Runtime state ────────────────────────────────────────────
let currentLang      = 'sr';
let pendingDreamText = '';
let currentUser      = null;     // { uid, username } | null
let activeFilter     = 'all';   // 'all' | 'mine'
let activeSort       = 'newest'; // 'newest' | 'popular'
let activeSearch     = '';       // current search query

// ── localStorage — dreams ────────────────────────────────────
function loadDreams() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function saveDreams(dreams) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dreams));
    } catch (e) { console.warn('localStorage write failed:', e); }
}

// ── localStorage — user ───────────────────────────────────────
function loadUser() {
    try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function saveUser(user) {
    try {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) { console.warn('localStorage write failed:', e); }
}

function clearUser() {
    try { localStorage.removeItem(USER_KEY); } catch {}
}

// ── localStorage — sort preference ───────────────────────────
function loadSort() {
    try { return localStorage.getItem(SORT_KEY) || 'newest'; } catch { return 'newest'; }
}

function saveSort(sort) {
    try { localStorage.setItem(SORT_KEY, sort); } catch {}
}

// ── localStorage — search query ───────────────────────────────
function loadSearch() {
    try { return localStorage.getItem(SEARCH_KEY) || ''; } catch { return ''; }
}

function saveSearch(q) {
    try { localStorage.setItem(SEARCH_KEY, q); } catch {}
}

// ── Auth — render login bar ───────────────────────────────────
function renderAuthUI() {
    const bar = document.getElementById('authBar');
    const t   = translations[currentLang] || translations['sr'];

    if (currentUser) {
        const initial = currentUser.username.charAt(0).toUpperCase();
        bar.innerHTML = `
            <div class="user-pill">
                <div class="user-avatar">${initial}</div>
                <span class="user-name">π ${currentUser.username}</span>
            </div>
            <button class="btn-logout" id="logoutBtn">${t.logoutBtn}</button>
        `;
        document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    } else {
        bar.innerHTML = `
            <button class="btn-login" id="loginBtn">
                <span class="pi-logo">π</span>${t.loginBtn}
            </button>
        `;
        document.getElementById('loginBtn').addEventListener('click', handleLogin);
    }
}

// ── Auth — Pi login ───────────────────────────────────────────
function handleLogin() {
    const btn = document.getElementById('loginBtn');
    if (!btn) return;
    btn.disabled    = true;
    btn.textContent = '✦ ✦ ✦';

    Pi.authenticate(['username', 'payments'], onIncompletePaymentFound)
        .then(auth => {
            currentUser = { uid: auth.user.uid, username: auth.user.username };
            saveUser(currentUser);
            renderAuthUI();
            renderFilteredGallery();
        })
        .catch(err => {
            console.error('[Pi] auth error:', err);
            btn.disabled    = false;
            btn.textContent = translations[currentLang]?.loginBtn || 'Prijavi se';
        });
}

// ── Handle incomplete payment on login ───────────────────────
function onIncompletePaymentFound(payment) {
    console.warn('[Pi] Incomplete payment found:', payment.identifier);
    // Complete the dangling payment so the user can make new ones
    fetch('https://dreamchain-hod0.onrender.com/api/payments/complete', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ paymentId: payment.identifier, txid: payment.transaction && payment.transaction.txid })
    }).catch(err => console.warn('[Pi] Could not complete incomplete payment:', err.message));
}

// ── Auth — logout ─────────────────────────────────────────────
function handleLogout() {
    currentUser  = null;
    activeFilter = 'all';
    clearUser();
    renderAuthUI();
    updateFilterButtons();
    renderFilteredGallery();
}

// ── Like helpers ──────────────────────────────────────────────
function getLikes(dream)    { return Array.isArray(dream.likes) ? dream.likes : []; }
function isLiked(dream)     { return currentUser ? getLikes(dream).includes(currentUser.uid) : false; }
function likeCount(dream)   { return getLikes(dream).length; }

// ── Build a card DOM element (data stored as attributes) ──────
function createCardEl(dream, extraClass = '') {
    const card = document.createElement('div');
    card.className = 'dream-card' + (extraClass ? ' ' + extraClass : '');
    card.dataset.id         = dream.id         || '';
    card.dataset.label      = dream.label;
    card.dataset.quote      = dream.quote;
    card.dataset.gradient   = dream.gradient;
    card.dataset.authorName = dream.authorName || '';
    card.dataset.authorUid  = dream.authorUid  || '';

    const t        = translations[currentLang] || translations['sr'];
    const liked    = isLiked(dream);
    const count    = likeCount(dream);
    const heart    = liked ? '♥' : '♡';
    const likedCls = liked ? ' liked' : '';
    const ariaLbl  = liked ? t.unlikeLabel : t.likeLabel;

    const authorBadge = dream.authorName
        ? `<div class="card-author">${dream.authorName}</div>`
        : '';

    card.innerHTML = `
        <div class="dream-img" style="background: ${dream.gradient}">${dream.label}</div>
        <div class="dream-info">${dream.quote}</div>
        ${authorBadge}
        <div class="card-footer">
            <button class="like-btn${likedCls}" data-dream-id="${dream.id}" aria-label="${ariaLbl}">
                <span class="like-heart">${heart}</span>
                <span class="like-count">${count}</span>
            </button>
        </div>
    `;
    return card;
}

// ── Render full gallery ───────────────────────────────────────
function renderGallery(dreams) {
    const grid = document.getElementById('dreamGrid');
    grid.innerHTML = '';
    if (!dreams.length) {
        const t = translations[currentLang] || translations['sr'];
        const msg = activeSearch.trim() ? t.noSearchResults : t.noMyDreams;
        grid.innerHTML = `<div class="empty-state">${msg}</div>`;
        return;
    }
    dreams.forEach(dream => grid.appendChild(createCardEl(dream)));
}

// ── Sort a dream array by activeSort ─────────────────────────
function sortDreams(dreams) {
    return [...dreams].sort((a, b) => {
        if (activeSort === 'popular') {
            const diff = likeCount(b) - likeCount(a);
            if (diff !== 0) return diff;
        }
        // newest (or tie-break): higher id = newer
        return Number(b.id) - Number(a.id);
    });
}

// ── Search filter ─────────────────────────────────────────────
function searchDreams(dreams) {
    const q = activeSearch.trim().toLowerCase();
    if (!q) return dreams;
    return dreams.filter(d => {
        const text   = (d.quote  || '').toLowerCase();
        const label  = (d.label  || '').toLowerCase();
        const author = (d.authorName || '').toLowerCase();
        return text.includes(q) || label.includes(q) || author.includes(q);
    });
}

// ── Render gallery respecting filter → search → sort ─────────
function renderFilteredGallery() {
    const all      = loadDreams() || defaultDreams;
    const filtered = activeFilter === 'mine' && currentUser
        ? all.filter(d => d.authorUid === currentUser.uid)
        : all;
    renderGallery(sortDreams(searchDreams(filtered)));
}

// ── Search input wiring ───────────────────────────────────────
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');

function applySearch(q) {
    activeSearch = q;
    saveSearch(q);
    searchClear.style.display = q ? 'block' : 'none';
    renderFilteredGallery();
}

searchInput.addEventListener('input', () => applySearch(searchInput.value));

searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchInput.focus();
    applySearch('');
});

// ── Sort button state ─────────────────────────────────────────
function updateSortButtons() {
    document.getElementById('sortNewest').classList.toggle('active', activeSort === 'newest');
    document.getElementById('sortPopular').classList.toggle('active', activeSort === 'popular');
}

function setSort(sort) {
    activeSort = sort;
    saveSort(sort);
    updateSortButtons();
    renderFilteredGallery();
}

document.getElementById('sortNewest').addEventListener('click',  () => setSort('newest'));
document.getElementById('sortPopular').addEventListener('click', () => setSort('popular'));

// ── Prepend a single new card with slide-in animation ────────
function prependCard(dream) {
    const grid = document.getElementById('dreamGrid');

    // Remove empty-state placeholder if present
    const empty = grid.querySelector('.empty-state');
    if (empty) empty.remove();

    const card = createCardEl(dream, 'card-enter');
    grid.prepend(card);
    card.getBoundingClientRect(); // force reflow
    card.classList.add('card-visible');
}

// ── Filter toggle logic ───────────────────────────────────────
function updateFilterButtons() {
    document.getElementById('filterAll').classList.toggle('active', activeFilter === 'all');
    document.getElementById('filterMine').classList.toggle('active', activeFilter === 'mine');
}

function setFilter(filter) {
    if (filter === 'mine' && !currentUser) {
        openLoginRequired();
        return;
    }
    activeFilter = filter;
    updateFilterButtons();
    renderFilteredGallery();
}

document.getElementById('filterAll').addEventListener('click',  () => setFilter('all'));
document.getElementById('filterMine').addEventListener('click', () => setFilter('mine'));

// ── Translations ─────────────────────────────────────────────
const translations = {
    sr: {
        sub:           "Pretvori svoje snove u AI umetnost",
        btn:           "Vizualizuj san (Pi 0.5)",
        gal:           "Nedavni snovi zajednice",
        ph:            "Opiši svoj san ovde...",
        flag:          "rs",
        modalTitle:    "Potvrdi generaciju sna",
        modalLabel:    "Cena vizualizacije",
        modalDesc:     "Potvrdite plaćanje da biste generisali AI vizualizaciju vašeg sna na Dream-Chain mreži.",
        modalCancel:   "Otkaži",
        modalConfirm:  "Potvrdi",
        dreamMeta:     "San zajednice",
        dreamAuthorLabel: "Autor",
        loginBtn:      "Prijavi se",
        logoutBtn:     "Odjavi se",
        loginReqTitle: "Prijavljivanje obavezno",
        loginReqDesc:  "Morate biti prijavljeni putem Pi mreže da biste generisali vizualizaciju sna.",
        loginReqClose: "Zatvori",
        loginReqBtn:   "Prijavi se",
        filterAll:     "Svi snovi",
        filterMine:    "Moji snovi",
        noMyDreams:    "Nemate sačuvanih snova. Dodajte prvi!",
        deleteBtn:          "Obriši san",
        deleteModalTitle:   "Obriši san",
        deleteModalDesc:    "Da li ste sigurni da želite da obrišete ovaj san? Ova akcija se ne može poništiti.",
        deleteModalCancel:  "Otkaži",
        deleteModalConfirm: "Obriši",
        editBtn:            "Izmeni san",
        editModalTitle:     "Izmeni san",
        editModalSave:      "Sačuvaj izmene",
        editModalCancel:    "Otkaži",
        editedLabel:        "✎ izmenjeno",
        likeLabel:          "Sviđa mi se",
        unlikeLabel:        "Ne sviđa mi se više",
        sortLabel:          "Sortiraj:",
        sortNewest:         "Najnoviji",
        sortPopular:        "Najpopularniji",
        searchPh:           "Pretraži snove...",
        noSearchResults:    "Nema rezultata za tu pretragu.",
        genLoading:         "Generišem AI sliku...",
        genError:           "Greška pri generaciji",
        genRetry:           "Pokušaj ponovo",
        genStatusLoading:   "⏳ U obradi...",
        genStatusDone:      "✦ AI generisano",
        genStatusError:     "⚠ Greška"
    },
    en: {
        sub:           "Turn your dreams into AI art",
        btn:           "Visualize dream (Pi 0.5)",
        gal:           "Recent community dreams",
        ph:            "Describe your dream here...",
        flag:          "us",
        modalTitle:    "Confirm dream generation",
        modalLabel:    "Visualization cost",
        modalDesc:     "Confirm the payment to generate an AI visualization of your dream on the Dream-Chain network.",
        modalCancel:   "Cancel",
        modalConfirm:  "Confirm",
        dreamMeta:     "Community dream",
        dreamAuthorLabel: "Author",
        loginBtn:      "Login with Pi",
        logoutBtn:     "Logout",
        loginReqTitle: "Login required",
        loginReqDesc:  "You must be logged in with your Pi account to generate a dream visualization.",
        loginReqClose: "Close",
        loginReqBtn:   "Login with Pi",
        filterAll:     "All dreams",
        filterMine:    "My dreams",
        noMyDreams:    "No saved dreams yet. Add your first!",
        deleteBtn:          "Delete dream",
        deleteModalTitle:   "Delete dream",
        deleteModalDesc:    "Are you sure you want to delete this dream? This action cannot be undone.",
        deleteModalCancel:  "Cancel",
        deleteModalConfirm: "Delete",
        editBtn:            "Edit dream",
        editModalTitle:     "Edit dream",
        editModalSave:      "Save changes",
        editModalCancel:    "Cancel",
        editedLabel:        "✎ edited",
        likeLabel:          "Like",
        unlikeLabel:        "Unlike",
        sortLabel:          "Sort:",
        sortNewest:         "Newest",
        sortPopular:        "Most popular",
        searchPh:           "Search dreams...",
        noSearchResults:    "No results found for that search.",
        genLoading:         "Generating AI image...",
        genError:           "Generation failed",
        genRetry:           "Try again",
        genStatusLoading:   "⏳ Processing...",
        genStatusDone:      "✦ AI generated",
        genStatusError:     "⚠ Error"
    },
    de: {
        sub:           "Verwandle deine Träume in AI-Kunst",
        btn:           "Traum visualisieren (Pi 0.5)",
        gal:           "Neueste Träume der Gemeinschaft",
        ph:            "Beschreibe deinen Traum hier...",
        flag:          "de",
        modalTitle:    "Traumgenerierung bestätigen",
        modalLabel:    "Visualisierungskosten",
        modalDesc:     "Bestätige die Zahlung, um eine KI-Visualisierung deines Traums im Dream-Chain-Netzwerk zu erstellen.",
        modalCancel:   "Abbrechen",
        modalConfirm:  "Bestätigen",
        dreamMeta:     "Gemeinschaftstraum",
        dreamAuthorLabel: "Autor",
        loginBtn:      "Mit Pi anmelden",
        logoutBtn:     "Abmelden",
        loginReqTitle: "Anmeldung erforderlich",
        loginReqDesc:  "Du musst mit deinem Pi-Konto angemeldet sein, um eine Traumvisualisierung zu erstellen.",
        loginReqClose: "Schließen",
        loginReqBtn:   "Mit Pi anmelden",
        filterAll:     "Alle Träume",
        filterMine:    "Meine Träume",
        noMyDreams:    "Noch keine gespeicherten Träume. Füge deinen ersten hinzu!",
        deleteBtn:          "Traum löschen",
        deleteModalTitle:   "Traum löschen",
        deleteModalDesc:    "Bist du sicher, dass du diesen Traum löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.",
        deleteModalCancel:  "Abbrechen",
        deleteModalConfirm: "Löschen",
        editBtn:            "Traum bearbeiten",
        editModalTitle:     "Traum bearbeiten",
        editModalSave:      "Änderungen speichern",
        editModalCancel:    "Abbrechen",
        editedLabel:        "✎ bearbeitet",
        likeLabel:          "Gefällt mir",
        unlikeLabel:        "Gefällt mir nicht mehr",
        sortLabel:          "Sortieren:",
        sortNewest:         "Neueste",
        sortPopular:        "Beliebteste",
        searchPh:           "Träume suchen...",
        noSearchResults:    "Keine Ergebnisse für diese Suche.",
        genLoading:         "KI-Bild wird generiert...",
        genError:           "Generierung fehlgeschlagen",
        genRetry:           "Erneut versuchen",
        genStatusLoading:   "⏳ Wird verarbeitet...",
        genStatusDone:      "✦ KI-generiert",
        genStatusError:     "⚠ Fehler"
    },
    es: {
        sub:           "Convierte tus sueños en arte IA",
        btn:           "Visualizar sueño (Pi 0.5)",
        gal:           "Sueños recientes de la comunidad",
        ph:            "Describe tu sueño aquí...",
        flag:          "es",
        modalTitle:    "Confirmar generación del sueño",
        modalLabel:    "Costo de visualización",
        modalDesc:     "Confirma el pago para generar una visualización de IA de tu sueño en la red Dream-Chain.",
        modalCancel:   "Cancelar",
        modalConfirm:  "Confirmar",
        dreamMeta:     "Sueño comunitario",
        dreamAuthorLabel: "Autor",
        loginBtn:      "Iniciar sesión con Pi",
        logoutBtn:     "Cerrar sesión",
        loginReqTitle: "Inicio de sesión requerido",
        loginReqDesc:  "Debes iniciar sesión con tu cuenta Pi para generar una visualización de sueño.",
        loginReqClose: "Cerrar",
        loginReqBtn:   "Iniciar sesión con Pi",
        filterAll:     "Todos los sueños",
        filterMine:    "Mis sueños",
        noMyDreams:    "Aún no tienes sueños guardados. ¡Añade el primero!",
        deleteBtn:          "Eliminar sueño",
        deleteModalTitle:   "Eliminar sueño",
        deleteModalDesc:    "¿Estás seguro de que deseas eliminar este sueño? Esta acción no se puede deshacer.",
        deleteModalCancel:  "Cancelar",
        deleteModalConfirm: "Eliminar",
        editBtn:            "Editar sueño",
        editModalTitle:     "Editar sueño",
        editModalSave:      "Guardar cambios",
        editModalCancel:    "Cancelar",
        editedLabel:        "✎ editado",
        likeLabel:          "Me gusta",
        unlikeLabel:        "Ya no me gusta",
        sortLabel:          "Ordenar:",
        sortNewest:         "Más recientes",
        sortPopular:        "Más populares",
        searchPh:           "Buscar sueños...",
        noSearchResults:    "No se encontraron resultados.",
        genLoading:         "Generando imagen IA...",
        genError:           "Error en la generación",
        genRetry:           "Reintentar",
        genStatusLoading:   "⏳ Procesando...",
        genStatusDone:      "✦ Generado por IA",
        genStatusError:     "⚠ Error"
    },
    it: {
        sub:           "Trasforma i tuoi sogni in arte AI",
        btn:           "Visualizza sogno (Pi 0.5)",
        gal:           "Sogni recenti della comunità",
        ph:            "Descrivi il tuo sogno qui...",
        flag:          "it",
        modalTitle:    "Conferma la generazione del sogno",
        modalLabel:    "Costo di visualizzazione",
        modalDesc:     "Conferma il pagamento per generare una visualizzazione AI del tuo sogno sulla rete Dream-Chain.",
        modalCancel:   "Annulla",
        modalConfirm:  "Conferma",
        dreamMeta:     "Sogno della comunità",
        dreamAuthorLabel: "Autore",
        loginBtn:      "Accedi con Pi",
        logoutBtn:     "Esci",
        loginReqTitle: "Accesso richiesto",
        loginReqDesc:  "Devi accedere con il tuo account Pi per generare una visualizzazione del sogno.",
        loginReqClose: "Chiudi",
        loginReqBtn:   "Accedi con Pi",
        filterAll:     "Tutti i sogni",
        filterMine:    "I miei sogni",
        noMyDreams:    "Nessun sogno salvato. Aggiungi il primo!",
        deleteBtn:          "Elimina sogno",
        deleteModalTitle:   "Elimina sogno",
        deleteModalDesc:    "Sei sicuro di voler eliminare questo sogno? Questa azione non può essere annullata.",
        deleteModalCancel:  "Annulla",
        deleteModalConfirm: "Elimina",
        editBtn:            "Modifica sogno",
        editModalTitle:     "Modifica sogno",
        editModalSave:      "Salva modifiche",
        editModalCancel:    "Annulla",
        editedLabel:        "✎ modificato",
        likeLabel:          "Mi piace",
        unlikeLabel:        "Non mi piace più",
        sortLabel:          "Ordina:",
        sortNewest:         "Più recenti",
        sortPopular:        "Più popolari",
        searchPh:           "Cerca sogni...",
        noSearchResults:    "Nessun risultato trovato.",
        genLoading:         "Generazione immagine IA...",
        genError:           "Generazione fallita",
        genRetry:           "Riprova",
        genStatusLoading:   "⏳ In elaborazione...",
        genStatusDone:      "✦ Generato dall'IA",
        genStatusError:     "⚠ Errore"
    },
    ru: {
        sub:           "Превратите свои мечты в ИИ-искусство",
        btn:           "Визуализировать сон (Pi 0.5)",
        gal:           "Последние сны сообщества",
        ph:            "Опишите свой сон здесь...",
        flag:          "ru",
        modalTitle:    "Подтвердите генерацию сна",
        modalLabel:    "Стоимость визуализации",
        modalDesc:     "Подтвердите оплату для создания ИИ-визуализации вашего сна в сети Dream-Chain.",
        modalCancel:   "Отмена",
        modalConfirm:  "Подтвердить",
        dreamMeta:     "Сон сообщества",
        dreamAuthorLabel: "Автор",
        loginBtn:      "Войти через Pi",
        logoutBtn:     "Выйти",
        loginReqTitle: "Требуется вход",
        loginReqDesc:  "Вы должны войти через свой аккаунт Pi, чтобы создать визуализацию сна.",
        loginReqClose: "Закрыть",
        loginReqBtn:   "Войти через Pi",
        filterAll:     "Все сны",
        filterMine:    "Мои сны",
        noMyDreams:    "Сохранённых снов пока нет. Добавьте первый!",
        deleteBtn:          "Удалить сон",
        deleteModalTitle:   "Удалить сон",
        deleteModalDesc:    "Вы уверены, что хотите удалить этот сон? Это действие нельзя отменить.",
        deleteModalCancel:  "Отмена",
        deleteModalConfirm: "Удалить",
        editBtn:            "Изменить сон",
        editModalTitle:     "Изменить сон",
        editModalSave:      "Сохранить изменения",
        editModalCancel:    "Отмена",
        editedLabel:        "✎ изменено",
        likeLabel:          "Нравится",
        unlikeLabel:        "Больше не нравится",
        sortLabel:          "Сортировка:",
        sortNewest:         "Новые",
        sortPopular:        "Популярные",
        searchPh:           "Поиск снов...",
        noSearchResults:    "Результатов не найдено.",
        genLoading:         "Генерация ИИ-изображения...",
        genError:           "Ошибка генерации",
        genRetry:           "Попробовать снова",
        genStatusLoading:   "⏳ Обработка...",
        genStatusDone:      "✦ Создано ИИ",
        genStatusError:     "⚠ Ошибка"
    },
    zh: {
        sub:           "将你的梦想转化为人工智能艺术",
        btn:           "梦境可视化 (Pi 0.5)",
        gal:           "最近的社区梦境",
        ph:            "在这里描述你的梦境...",
        flag:          "cn",
        modalTitle:    "确认梦境生成",
        modalLabel:    "可视化费用",
        modalDesc:     "确认支付，在 Dream-Chain 网络上生成您梦境的 AI 可视化图像。",
        modalCancel:   "取消",
        modalConfirm:  "确认",
        dreamMeta:     "社区梦境",
        dreamAuthorLabel: "作者",
        loginBtn:      "用 Pi 登录",
        logoutBtn:     "退出登录",
        loginReqTitle: "需要登录",
        loginReqDesc:  "您必须使用 Pi 账号登录才能生成梦境可视化图像。",
        loginReqClose: "关闭",
        loginReqBtn:   "用 Pi 登录",
        filterAll:     "所有梦境",
        filterMine:    "我的梦境",
        noMyDreams:    "暂无保存的梦境，添加你的第一个！",
        deleteBtn:          "删除梦境",
        deleteModalTitle:   "删除梦境",
        deleteModalDesc:    "您确定要删除此梦境吗？此操作无法撤销。",
        deleteModalCancel:  "取消",
        deleteModalConfirm: "删除",
        editBtn:            "编辑梦境",
        editModalTitle:     "编辑梦境",
        editModalSave:      "保存更改",
        editModalCancel:    "取消",
        editedLabel:        "✎ 已编辑",
        likeLabel:          "点赞",
        unlikeLabel:        "取消点赞",
        sortLabel:          "排序：",
        sortNewest:         "最新",
        sortPopular:        "最热门",
        searchPh:           "搜索梦境...",
        noSearchResults:    "未找到相关结果。",
        genLoading:         "正在生成 AI 图像...",
        genError:           "生成失败",
        genRetry:           "重试",
        genStatusLoading:   "⏳ 处理中...",
        genStatusDone:      "✦ AI 已生成",
        genStatusError:     "⚠ 错误"
    },
    fr: {
        sub:           "Transformez vos rêves en art IA",
        btn:           "Visualiser le rêve (Pi 0.5)",
        gal:           "Rêves récents de la communauté",
        ph:            "Décrivez votre rêve ici...",
        flag:          "fr",
        modalTitle:    "Confirmer la génération du rêve",
        modalLabel:    "Coût de la visualisation",
        modalDesc:     "Confirmez le paiement pour générer une visualisation IA de votre rêve sur le réseau Dream-Chain.",
        modalCancel:   "Annuler",
        modalConfirm:  "Confirmer",
        dreamMeta:     "Rêve de la communauté",
        dreamAuthorLabel: "Auteur",
        loginBtn:      "Se connecter avec Pi",
        logoutBtn:     "Se déconnecter",
        loginReqTitle: "Connexion requise",
        loginReqDesc:  "Vous devez être connecté avec votre compte Pi pour générer une visualisation de rêve.",
        loginReqClose: "Fermer",
        loginReqBtn:   "Se connecter avec Pi",
        filterAll:     "Tous les rêves",
        filterMine:    "Mes rêves",
        noMyDreams:    "Aucun rêve sauvegardé. Ajoutez le premier !",
        deleteBtn:          "Supprimer le rêve",
        deleteModalTitle:   "Supprimer le rêve",
        deleteModalDesc:    "Êtes-vous sûr de vouloir supprimer ce rêve ? Cette action est irréversible.",
        deleteModalCancel:  "Annuler",
        deleteModalConfirm: "Supprimer",
        editBtn:            "Modifier le rêve",
        editModalTitle:     "Modifier le rêve",
        editModalSave:      "Enregistrer les modifications",
        editModalCancel:    "Annuler",
        editedLabel:        "✎ modifié",
        likeLabel:          "J'aime",
        unlikeLabel:        "Je n'aime plus",
        sortLabel:          "Trier :",
        sortNewest:         "Plus récents",
        sortPopular:        "Plus populaires",
        searchPh:           "Rechercher des rêves...",
        noSearchResults:    "Aucun résultat pour cette recherche."
    }
};

// ── Apply language to all UI text ────────────────────────────
function applyLanguage(lang) {
    const data = translations[lang] || translations['sr'];
    currentLang = lang;

    document.getElementById('subTitle').innerText       = data.sub;
    document.getElementById('genBtn').innerText         = data.btn;
    document.getElementById('galTitle').innerText       = data.gal;
    document.getElementById('dreamText').placeholder    = data.ph;
    document.getElementById('currentFlag').src          = `https://flagcdn.com/20x15/${data.flag}.png`;

    // Payment modal
    document.getElementById('modalTitle').innerText     = data.modalTitle;
    document.getElementById('modalLabel').innerText     = data.modalLabel;
    document.getElementById('modalDesc').innerText      = data.modalDesc;
    document.getElementById('modalCancel').innerText    = data.modalCancel;
    document.getElementById('modalConfirm').innerText   = data.modalConfirm;

    // Dream detail modal
    document.getElementById('dreamModalMeta').innerText = data.dreamMeta;

    // Login required modal
    document.getElementById('loginReqTitle').innerText  = data.loginReqTitle;
    document.getElementById('loginReqDesc').innerText   = data.loginReqDesc;
    document.getElementById('loginReqClose').innerText  = data.loginReqClose;
    document.getElementById('loginReqBtn').innerText    = data.loginReqBtn;

    // Filter toggle labels
    document.getElementById('filterAll').innerText      = data.filterAll;
    document.getElementById('filterMine').innerText     = data.filterMine;

    // Sort toggle labels
    document.getElementById('sortLabel').innerText      = data.sortLabel;
    document.getElementById('sortNewest').innerText     = data.sortNewest;
    document.getElementById('sortPopular').innerText    = data.sortPopular;

    // Search placeholder
    document.getElementById('searchInput').placeholder = data.searchPh;

    // Delete confirm modal
    document.getElementById('deleteModalTitle').innerText   = data.deleteModalTitle;
    document.getElementById('deleteModalDesc').innerText    = data.deleteModalDesc;
    document.getElementById('deleteModalCancel').innerText  = data.deleteModalCancel;
    document.getElementById('deleteModalConfirm').innerText = data.deleteModalConfirm;

    // Edit modal
    document.getElementById('editModalTitle').innerText  = data.editModalTitle;
    document.getElementById('editModalSave').innerText   = data.editModalSave;
    document.getElementById('editModalCancel').innerText = data.editModalCancel;

    // Buttons inside dream detail modal
    document.getElementById('dreamDeleteBtn').innerText = data.deleteBtn;
    document.getElementById('dreamEditBtn').innerText   = data.editBtn;

    // Re-render auth bar so button labels update in place
    renderAuthUI();
}

document.getElementById('langSelect').addEventListener('change', (e) => {
    applyLanguage(e.target.value);
});

// ── Generic modal open/close helpers ─────────────────────────
function openOverlay(el) {
    el.classList.remove('closing');
    el.classList.add('open');
}

function closeOverlay(el, callback) {
    el.classList.add('closing');
    el.addEventListener('transitionend', () => {
        el.classList.remove('open', 'closing');
        if (callback) callback();
    }, { once: true });
}

// ── Payment Modal ─────────────────────────────────────────────
const modalOverlay = document.getElementById('paymentModal');

function openModal()    { openOverlay(modalOverlay); }
function closeModal(cb) { closeOverlay(modalOverlay, cb); }

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

document.getElementById('modalCancel').addEventListener('click', () => closeModal());

document.getElementById('modalConfirm').addEventListener('click', () => {
    closeModal(() => {
        const btn = document.getElementById('genBtn');
        btn.disabled    = true;
        btn.classList.add('loading');
        btn.textContent = '✦ ✦ ✦';

        fetch('https://dreamchain-hod0.onrender.com/health').catch(() => {});

        Pi.createPayment({
            amount:   0.5,
            memo:     'Dream-Chain AI visualization',
            metadata: { dream: pendingDreamText }
        }, {
            onReadyForServerApproval: (paymentId) => {
                fetch('https://dreamchain-hod0.onrender.com/health').catch(() => {});
                console.log('[Pi] onReadyForServerApproval:', paymentId);
                fetch('https://dreamchain-hod0.onrender.com/api/payments/approve', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ paymentId })
                })
                .then(r => r.json())
                .then(d => console.log('[Pi] approve response:', JSON.stringify(d)))
                .catch(err => console.error('[Pi] approval FETCH ERROR:', err.message));
            },
            onReadyForServerCompletion: (paymentId, txid) => {
                fetch('https://dreamchain-hod0.onrender.com/health').catch(() => {});
                console.log('[Pi] onReadyForServerCompletion:', paymentId, txid);
                fetch('https://dreamchain-hod0.onrender.com/api/payments/complete', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ paymentId, txid })
                })
                .then(r => r.json())
                .then(d => { console.log('[Pi] complete response:', JSON.stringify(d)); processDream(pendingDreamText); })
                .catch(err => { console.error('[Pi] completion FETCH ERROR:', err.message); resetButton(); });
            },
            onCancel: (paymentId) => {
                console.log('[Pi] Payment cancelled:', paymentId);
                resetButton();
            },
            onError: (error, payment) => {
                console.error('[Pi] Payment error:', error, payment);
                const msg = typeof error === 'string' ? error : (error && error.message) ? error.message : JSON.stringify(error);
                alert('Pi payment error: ' + msg);
                resetButton();
            }
        });
    });
});

// ── Login Required Modal ──────────────────────────────────────
const loginReqOverlay = document.getElementById('loginRequiredModal');

function openLoginRequired()    { openOverlay(loginReqOverlay); }
function closeLoginRequired(cb) { closeOverlay(loginReqOverlay, cb); }

loginReqOverlay.addEventListener('click', (e) => {
    if (e.target === loginReqOverlay) closeLoginRequired();
});

document.getElementById('loginReqClose').addEventListener('click', () => closeLoginRequired());

document.getElementById('loginReqBtn').addEventListener('click', () => {
    closeLoginRequired(() => {
        renderAuthUI(); // ensure btn-login is in DOM
        const btn = document.getElementById('loginBtn');
        if (btn) btn.click();
    });
});

// ── Loading / processing flow ─────────────────────────────────
function simulateProcessing(text) {
    const btn = document.getElementById('genBtn');
    btn.disabled    = true;
    btn.classList.add('loading');
    btn.textContent = '✦ ✦ ✦';

    setTimeout(() => {
        processDream(text);
        resetButton();
    }, 1500);
}

async function processDream(text) {
    const textarea = document.getElementById('dreamText');
    const label    = text.length > 22 ? text.substring(0, 22).trimEnd() + '…' : text;
    const fallback = gradientPalette[Math.floor(Math.random() * gradientPalette.length)];

    const newDream = {
        id:         Date.now(),
        label,
        quote:      `"${text}"`,
        gradient:   fallback,
        imageUrl:   null,
        authorUid:  currentUser ? currentUser.uid      : null,
        authorName: currentUser ? currentUser.username : null
    };

    prependCard(newDream);
    const stored = loadDreams() || defaultDreams;
    saveDreams([newDream, ...stored]);

    if (db) {
        db.from('dreams').insert(newDream)
            .then(({ error }) => { if (error) console.warn('[Supabase] insert failed:', error); });
    }

    textarea.value   = '';
    pendingDreamText = '';
    resetButton();

    // Generate AI image in background
    try {
        const res  = await fetch('https://dreamchain-hod0.onrender.com/api/generate-image', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ prompt: text })
        });
        const data = await res.json();
        if (data.imageUrl) {
            newDream.imageUrl = data.imageUrl;
            // Update card in DOM
            const card = document.querySelector(`[data-id="${newDream.id}"]`);
            if (card) {
                const imgEl = card.querySelector('.dream-img');
                if (imgEl) imgEl.style.background = `url('${data.imageUrl}') center/cover no-repeat`;
            }
            // Update localStorage
            const dreams = loadDreams() || [];
            const idx = dreams.findIndex(d => d.id === newDream.id);
            if (idx !== -1) { dreams[idx].imageUrl = data.imageUrl; saveDreams(dreams); }
            // Update Supabase
            if (db) {
                db.from('dreams').update({ imageUrl: data.imageUrl }).eq('id', newDream.id)
                    .then(({ error }) => { if (error) console.warn('[Supabase] update imageUrl failed:', error); });
            }
        }
    } catch (err) {
        console.warn('[AI] Image generation failed, keeping gradient:', err.message);
    }
}

function resetButton() {
    const btn = document.getElementById('genBtn');
    btn.disabled = false;
    btn.classList.remove('loading');
    applyLanguage(currentLang);
}

// ── Dream Detail Modal ────────────────────────────────────────
const dreamModal      = document.getElementById('dreamModal');
const dreamModalClose = document.getElementById('dreamModalClose');

let activeDreamId = null; // tracks the dream being viewed

function openDreamModal(label, quote, gradient, authorName, dreamId) {
    const t           = translations[currentLang] || translations['sr'];
    const displayText = quote.replace(/^"|"$/g, '');

    activeDreamId = dreamId || null;

    document.getElementById('dreamModalTitle').innerText          = label;
    document.getElementById('dreamModalText').innerText           = displayText;
    document.getElementById('dreamModalPreview').style.background = gradient;
    document.getElementById('dreamModalMeta').innerText           = t.dreamMeta;

    const authorEl = document.getElementById('dreamModalAuthor');
    if (authorName) {
        authorEl.innerText     = `${t.dreamAuthorLabel}: ${authorName}`;
        authorEl.style.display = '';
    } else {
        authorEl.style.display = 'none';
    }

    // Show edit/delete buttons only if this dream belongs to the current user
    const isOwner = currentUser && authorName === currentUser.username && dreamId;
    document.getElementById('dreamDeleteBtn').style.display = isOwner ? 'block' : 'none';
    document.getElementById('dreamEditBtn').style.display   = isOwner ? 'block' : 'none';

    // Show edited note if dream was modified
    const all   = loadDreams() || defaultDreams;
    const dream = dreamId ? all.find(d => String(d.id) === String(dreamId)) : null;
    let editedNote = document.getElementById('dreamModalEdited');
    if (dream && dream.edited) {
        if (!editedNote) {
            editedNote    = document.createElement('p');
            editedNote.id = 'dreamModalEdited';
            editedNote.className = 'dream-modal-edited';
            document.getElementById('dreamModalAuthor').after(editedNote);
        }
        editedNote.textContent = t.editedLabel;
    } else if (editedNote) {
        editedNote.textContent = '';
    }

    // Sync modal like button
    const allDreams    = loadDreams() || defaultDreams;
    const dreamForLike = dreamId ? allDreams.find(d => String(d.id) === String(dreamId)) : null;
    if (dreamForLike) {
        syncModalLikeBtn(isLiked(dreamForLike), likeCount(dreamForLike));
        document.getElementById('dreamModalLikeBtn').style.display = '';
    } else {
        document.getElementById('dreamModalLikeBtn').style.display = 'none';
    }

    openOverlay(dreamModal);
}

function closeDreamModal() { closeOverlay(dreamModal); }

dreamModalClose.addEventListener('click', closeDreamModal);
dreamModal.addEventListener('click', (e) => {
    if (e.target === dreamModal) closeDreamModal();
});

// Edit button in detail modal → open edit modal
document.getElementById('dreamEditBtn').addEventListener('click', () => {
    openEditModal();
});

// Delete button in detail modal → open confirm modal
document.getElementById('dreamDeleteBtn').addEventListener('click', () => {
    openDeleteModal();
});


// ── Edit Dream Modal ──────────────────────────────────────────
const editModal        = document.getElementById('editModal');
const editTextarea     = document.getElementById('editDreamText');
const editCharCount    = document.getElementById('editCharCount');

editTextarea.addEventListener('input', () => {
    editCharCount.textContent = editTextarea.value.length;
});

function openEditModal() {
    // Pre-fill with current raw text (strip wrapping quotes)
    const all     = loadDreams() || defaultDreams;
    const dream   = all.find(d => String(d.id) === String(activeDreamId));
    const rawText = dream ? dream.quote.replace(/^"|"$/g, '') : '';

    editTextarea.value        = rawText;
    editCharCount.textContent = rawText.length;
    editTextarea.classList.remove('shake');

    openOverlay(editModal);
    setTimeout(() => editTextarea.focus(), 300);
}

function closeEditModal(cb) { closeOverlay(editModal, cb); }

editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
});

document.getElementById('editModalCancel').addEventListener('click', () => closeEditModal());

document.getElementById('editModalSave').addEventListener('click', () => {
    const newText = editTextarea.value.trim();

    if (!newText) {
        editTextarea.classList.add('shake');
        editTextarea.addEventListener('animationend', () => editTextarea.classList.remove('shake'), { once: true });
        return;
    }

    // Update localStorage
    const all   = loadDreams() || defaultDreams;
    const idx   = all.findIndex(d => String(d.id) === String(activeDreamId));
    if (idx === -1) { closeEditModal(); return; }

    const newLabel = newText.length > 22 ? newText.substring(0, 22).trimEnd() + '…' : newText;
    all[idx].quote      = `"${newText}"`;
    all[idx].label      = newLabel;
    all[idx].edited     = true;
    all[idx].updatedAt  = Date.now();
    saveDreams(all);

    if (db) {
        db.from('dreams')
            .update({ quote: all[idx].quote, label: newLabel, edited: true, updated_at: new Date().toISOString() })
            .eq('id', activeDreamId)
            .then(({ error }) => { if (error) console.warn('[Supabase] update failed:', error); });
    }

    const t = translations[currentLang] || translations['sr'];

    // Update the card in the grid
    const card = document.querySelector(`.dream-card[data-id="${activeDreamId}"]`);
    if (card) {
        card.dataset.label = newLabel;
        card.dataset.quote = `"${newText}"`;
        const imgEl  = card.querySelector('.dream-img');
        const infoEl = card.querySelector('.dream-info');
        if (imgEl)  imgEl.textContent  = newLabel;
        if (infoEl) infoEl.textContent = `"${newText}"`;

        // Add or update edited badge
        let badge = card.querySelector('.card-edited-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'card-edited-badge';
            card.appendChild(badge);
        }
        badge.textContent = t.editedLabel;
    }

    // Update detail modal content in place
    document.getElementById('dreamModalTitle').innerText = newLabel;
    document.getElementById('dreamModalText').innerText  = newText;

    // Add/update edited note in detail modal
    let editedNote = document.getElementById('dreamModalEdited');
    if (!editedNote) {
        editedNote    = document.createElement('p');
        editedNote.id = 'dreamModalEdited';
        editedNote.className = 'dream-modal-edited';
        document.getElementById('dreamModalAuthor').after(editedNote);
    }
    editedNote.textContent = t.editedLabel;

    closeEditModal();
});

// ── Delete Confirm Modal ──────────────────────────────────────
const deleteModal = document.getElementById('deleteModal');

function openDeleteModal()    { openOverlay(deleteModal); }
function closeDeleteModal(cb) { closeOverlay(deleteModal, cb); }

deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
});

document.getElementById('deleteModalCancel').addEventListener('click', () => closeDeleteModal());

document.getElementById('deleteModalConfirm').addEventListener('click', () => {
    if (!activeDreamId) { closeDeleteModal(); return; }

    // Remove from localStorage
    const all     = loadDreams() || defaultDreams;
    const updated = all.filter(d => String(d.id) !== String(activeDreamId));
    saveDreams(updated);

    if (db) {
        db.from('dreams').delete().eq('id', activeDreamId)
            .then(({ error }) => { if (error) console.warn('[Supabase] delete failed:', error); });
    }

    activeDreamId = null;

    // Close both modals then refresh gallery
    closeDeleteModal(() => {
        closeDreamModal();
        renderFilteredGallery();
    });
});

// ── Like toggle logic ─────────────────────────────────────────
function toggleLike(dreamId) {
    if (!currentUser) { openLoginRequired(); return; }

    const all   = loadDreams() || defaultDreams;
    const idx   = all.findIndex(d => String(d.id) === String(dreamId));
    if (idx === -1) return;

    const dream = all[idx];
    const likes = getLikes(dream);
    const uid   = currentUser.uid;
    const nowLiked = !likes.includes(uid);

    all[idx].likes = nowLiked
        ? [...likes, uid]
        : likes.filter(id => id !== uid);

    saveDreams(all);

    if (db) {
        db.from('dreams')
            .update({ likes: all[idx].likes })
            .eq('id', dreamId)
            .then(({ error }) => { if (error) console.warn('[Supabase] like update failed:', error); });
    }

    const newCount  = all[idx].likes.length;
    const t         = translations[currentLang] || translations['sr'];

    // Update every card in the grid matching this dream
    document.querySelectorAll(`.like-btn[data-dream-id="${dreamId}"]`).forEach(btn => {
        btn.classList.toggle('liked', nowLiked);
        btn.setAttribute('aria-label', nowLiked ? t.unlikeLabel : t.likeLabel);
        btn.querySelector('.like-heart').textContent  = nowLiked ? '♥' : '♡';
        btn.querySelector('.like-count').textContent  = newCount;
    });

    // Update detail modal like button if the same dream is open
    if (String(activeDreamId) === String(dreamId)) {
        syncModalLikeBtn(nowLiked, newCount);
    }
}

function syncModalLikeBtn(liked, count) {
    const t   = translations[currentLang] || translations['sr'];
    const btn = document.getElementById('dreamModalLikeBtn');
    if (!btn) return;
    btn.classList.toggle('liked', liked);
    btn.setAttribute('aria-label', liked ? t.unlikeLabel : t.likeLabel);
    btn.querySelector('.modal-like-heart').textContent = liked ? '♥' : '♡';
    btn.querySelector('.modal-like-count').textContent = count;
}

// Event delegation — grid: like buttons AND card open (single listener)
document.getElementById('dreamGrid').addEventListener('click', (e) => {
    const likeBtn = e.target.closest('.like-btn');
    if (likeBtn) {
        toggleLike(likeBtn.dataset.dreamId);
        return; // stop — do not open modal
    }
    const card = e.target.closest('.dream-card');
    if (!card) return;
    openDreamModal(
        card.dataset.label,
        card.dataset.quote,
        card.dataset.gradient,
        card.dataset.authorName || null,
        card.dataset.id         || null
    );
});

// Detail modal like button
document.getElementById('dreamModalLikeBtn').addEventListener('click', () => {
    if (!activeDreamId) return;
    toggleLike(activeDreamId);
});

// ── Main submit handler ───────────────────────────────────────
function handleSubmit() {
    const textarea = document.getElementById('dreamText');
    const text     = textarea.value.trim();

    if (!text) {
        textarea.classList.add('shake');
        textarea.addEventListener('animationend', () => textarea.classList.remove('shake'), { once: true });
        return;
    }

    if (!currentUser) {
        openLoginRequired();
        return;
    }

    pendingDreamText = text;
    openModal();
}

document.getElementById('genBtn').addEventListener('click', handleSubmit);

// ── Init ─────────────────────────────────────────────────────
currentUser  = loadUser();
activeSort   = loadSort();
activeSearch = loadSearch();

// Restore search input UI state
if (activeSearch) {
    searchInput.value         = activeSearch;
    searchClear.style.display = 'block';
}

applyLanguage('sr'); // sets all text + renderAuthUI()
updateFilterButtons();
updateSortButtons();
renderFilteredGallery();

// ── Wake up Render backend on page load ──────────────────────
fetch('https://dreamchain-hod0.onrender.com/health').catch(() => {});

// ── Supabase: load community dreams on start ──────────────────
(async function syncFromSupabase() {
    if (!db) return;
    try {
        const { data, error } = await db
            .from('dreams')
            .select('*')
            .order('id', { ascending: false })
            .limit(200);
        if (error) throw error;
        if (data && data.length > 0) {
            saveDreams(data);
            renderFilteredGallery();
        }
    } catch (e) {
        console.warn('[Supabase] sync failed:', e);
    }
})();
